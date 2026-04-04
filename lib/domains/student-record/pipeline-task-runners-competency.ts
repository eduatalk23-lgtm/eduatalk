// ============================================
// 역량 분석 태스크 러너 (Grade Pipeline P1-P3)
// G1-a: runCompetencySetekForGrade / runCompetencySetekChunkForGrade
// G1-b: runCompetencyChangcheForGrade / runCompetencyChangcheChunkForGrade
// G1-c: runCompetencyHaengteukForGrade / runCompetencyHaengteukChunkForGrade
// G1(legacy): runCompetencyAnalysisForGrade
// G2-G4: runSetekGuideForGrade, runChangcheGuideForGrade, runHaengteukGuideForGrade
// G5: runSlotGenerationForGrade
// ============================================

import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { updatePipelineState } from "./pipeline-executor";
import type {
  PipelineContext,
  TaskRunnerOutput,
  ScoreRowWithSubject,
} from "./pipeline-types";
import * as competencyRepo from "./competency-repository";
import type { ActivityTagInsert, CompetencyScoreInsert } from "./types";
import type { HighlightAnalysisResult, HighlightAnalysisInput } from "./llm/types";
import { runWithConcurrency, collectAnalysisContext } from "./pipeline-task-runners-shared";

const LOG_CTX = { domain: "student-record", action: "pipeline" };

// ============================================
// G0-shared. 역량 분석 공통 헬퍼
// ============================================

/** 진행 상황 콜백 옵션 */
interface CompetencyProgressOptions {
  /** 진행 상황을 저장할 태스크 키 (e.g. "competency_setek") */
  taskKey?: string;
  /** DB 업데이트 간격 (레코드 수 기준, 기본 3) */
  flushEvery?: number;
}

/**
 * 특정 영역(setek/changche/haengteuk)의 레코드들에 대해 역량 분석을 수행하고 결과를 저장한다.
 * runCompetencySetekForGrade, runCompetencyChangcheForGrade, runCompetencyHaengteukForGrade에서 공통 사용.
 */
async function runCompetencyForRecords(
  ctx: PipelineContext,
  targetGrade: number,
  recordType: "setek" | "changche" | "haengteuk",
  analysisRecords: Array<{ type: "setek" | "changche" | "haengteuk"; id: string; content: string; grade: number; subjectName?: string }>,
  progressOpts?: CompetencyProgressOptions,
  chunkOpts?: { chunkSize: number },
): Promise<{ succeeded: number; failed: number; skipped: number; allResults: Map<string, HighlightAnalysisResult>; hasMore: boolean; totalUncached: number }> {
  const { supabase, studentId, tenantId, studentGrade, snapshot } = ctx;

  const { analyzeSetekWithHighlight } = await import("./llm/actions/analyzeWithHighlight");
  const { computeRecordContentHash } = await import("./content-hash");
  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const allResults = new Map<string, HighlightAnalysisResult>();

  // 진로 역량 평가용 이수/성적 컨텍스트
  const tgtMajor = (snapshot?.target_major as string) ?? null;
  let careerContext: HighlightAnalysisInput["careerContext"] = undefined;

  if (tgtMajor) {
    const { data: scoreRows } = await supabase
      .from("student_internal_scores")
      .select("subject:subject_id(name), rank_grade, grade, semester")
      .eq("student_id", studentId)
      .order("grade")
      .order("semester");
    const careerScoreRows = (scoreRows ?? []) as ScoreRowWithSubject[];
    const subjectScores = careerScoreRows
      .map((s) => ({ subjectName: s.subject?.name ?? "", rankGrade: s.rank_grade ?? 5 }))
      .filter((s) => s.subjectName);
    const takenNames = [...new Set(subjectScores.map((s) => s.subjectName))];
    const gradeTrend = careerScoreRows
      .filter((s) => s.rank_grade != null)
      .map((s) => ({
        grade: s.grade ?? 1,
        semester: s.semester ?? 1,
        subjectName: s.subject?.name ?? "",
        rankGrade: s.rank_grade as number,
      }));
    careerContext = { targetMajor: tgtMajor, takenSubjects: takenNames, relevantScores: subjectScores, gradeTrend };
  }

  const careerHashCtx = careerContext
    ? { targetMajor: careerContext.targetMajor, takenSubjects: careerContext.takenSubjects }
    : null;

  if (analysisRecords.length === 0) {
    return { succeeded, failed, skipped, allResults, hasMore: false, totalUncached: 0 };
  }

  // 증분 분석: 배치 캐시 조회
  const cachedEntries = await competencyRepo.findAnalysisCacheByRecordIds(
    analysisRecords.map((r) => r.id), tenantId, "ai",
  );
  const cacheMap = new Map(cachedEntries.map((e) => [e.record_id, e]));

  // 캐시 히트 분리 + 미히트 레코드 AI 태그 삭제
  const uncachedRecords: typeof analysisRecords = [];
  for (const rec of analysisRecords) {
    const currentHash = computeRecordContentHash(rec.content, careerHashCtx);
    const cached = cacheMap.get(rec.id);
    if (cached?.content_hash && cached.content_hash === currentHash) {
      allResults.set(rec.id, cached.analysis_result as HighlightAnalysisResult);
      skipped++;
    } else {
      uncachedRecords.push(rec);
    }
  }
  // 청크 슬라이싱: chunkSize가 지정되면 첫 N개 미캐시 레코드만 처리
  const totalUncached = uncachedRecords.length;
  let effectiveUncached = uncachedRecords;
  let hasMore = false;
  if (chunkOpts?.chunkSize != null && uncachedRecords.length > chunkOpts.chunkSize) {
    effectiveUncached = uncachedRecords.slice(0, chunkOpts.chunkSize);
    hasMore = true;
  }

  if (effectiveUncached.length > 0) {
    await competencyRepo.deleteAiActivityTagsByRecordIds(effectiveUncached.map((r) => r.id), tenantId);
  }

  // 분석 결과 저장 헬퍼
  async function saveResult(
    recType: "setek" | "personal_setek" | "changche" | "haengteuk",
    recordId: string,
    content: string,
    data: HighlightAnalysisResult,
  ) {
    const tagInputs: ActivityTagInsert[] = [];
    for (const section of data.sections) {
      for (const tag of section.tags) {
        tagInputs.push({
          tenant_id: tenantId,
          student_id: studentId,
          record_type: recType,
          record_id: recordId,
          competency_item: tag.competencyItem,
          evaluation: tag.evaluation,
          evidence_summary: `[AI] ${tag.reasoning}\n근거: "${tag.highlight}"`,
          source: "ai",
          status: "suggested",
        });
      }
    }
    if (tagInputs.length > 0) {
      await competencyRepo.insertActivityTags(tagInputs);
    }

    const currentHash = computeRecordContentHash(content, careerHashCtx);
    await competencyRepo.upsertAnalysisCache({
      tenant_id: tenantId,
      student_id: studentId,
      record_type: recType,
      record_id: recordId,
      source: "ai",
      analysis_result: data,
      content_hash: currentHash,
    });

    if (data.contentQuality) {
      const cq = data.contentQuality;
      await supabase
        .from("student_record_content_quality")
        .upsert(
          {
            tenant_id: tenantId,
            student_id: studentId,
            record_type: recType,
            record_id: recordId,
            school_year: targetSchoolYear,
            specificity: cq.specificity,
            coherence: cq.coherence,
            depth: cq.depth,
            grammar: cq.grammar,
            scientific_validity: cq.scientificValidity ?? null,
            overall_score: cq.overallScore,
            issues: cq.issues,
            feedback: cq.feedback,
            source: "ai",
          },
          { onConflict: "tenant_id,student_id,record_id,source" },
        )
        .then(({ error }) => {
          if (error) {
            logActionDebug(LOG_CTX, `contentQuality upsert failed: ${recordId} — ${error.message}`);
          }
        });
    }

    allResults.set(recordId, data);
    succeeded++;
  }

  // 진행 상황 추적
  const taskKey = progressOpts?.taskKey;
  const flushEvery = progressOpts?.flushEvery ?? 3;
  const total = analysisRecords.length; // 캐시 포함 전체
  let processed = skipped; // 캐시 히트는 이미 처리 완료
  let lastFlush = 0;
  const startMs = Date.now();

  /** 진행 상황을 ctx + DB에 반영 */
  async function flushProgress(force = false) {
    if (!taskKey) return;
    processed = succeeded + skipped + failed;
    // 매 flushEvery 건마다, 또는 강제 플러시
    if (!force && processed - lastFlush < flushEvery) return;
    lastFlush = processed;

    const progressText = `${processed}/${total} 진행 (${succeeded}건 완료${failed > 0 ? `, ${failed}건 실패` : ""}${skipped > 0 ? `, ${skipped}건 캐시` : ""})`;
    ctx.previews[taskKey] = progressText;
    ctx.results[taskKey] = {
      ...(typeof ctx.results[taskKey] === "object" && ctx.results[taskKey] != null
        ? ctx.results[taskKey] as Record<string, unknown>
        : {}),
      progress: { total, completed: succeeded, failed, skipped, processed },
      elapsedMs: Date.now() - startMs,
    };

    await updatePipelineState(
      ctx.supabase as import("@/lib/supabase/admin").SupabaseAdminClient,
      ctx.pipelineId,
      "running",
      ctx.tasks,
      ctx.previews,
      ctx.results,
      ctx.errors,
    );
  }

  // 캐시 히트가 있으면 초기 진행 상황 플러시
  if (skipped > 0 && taskKey) {
    await flushProgress(true);
  }

  // 개별 LLM 호출 (동시성 3)
  if (effectiveUncached.length > 0) {
    const failedRecords: typeof effectiveUncached = [];

    await runWithConcurrency(effectiveUncached, 3, async (rec) => {
      try {
        const result = await analyzeSetekWithHighlight({
          recordType: rec.type,
          content: rec.content,
          subjectName: rec.subjectName,
          grade: rec.grade,
          careerContext,
        });
        if (result.success) {
          await saveResult(rec.type, rec.id, rec.content, result.data);
          await flushProgress();
        } else {
          failedRecords.push(rec);
          logActionDebug(LOG_CTX, `competency_${recordType}[g${targetGrade}]: ${rec.id} failed — ${result.error}`);
        }
      } catch (err) {
        failedRecords.push(rec);
        logActionError({ ...LOG_CTX, action: `pipeline.competency.grade${targetGrade}.${recordType}` }, err, { recordId: rec.id });
      }
    });

    // 실패 레코드 재시도 (동시성 1, 10초 대기)
    if (failedRecords.length > 0) {
      logActionDebug(LOG_CTX, `competency_${recordType}[g${targetGrade}]: ${failedRecords.length}건 재시도 대기 (10초)`);
      await new Promise((r) => setTimeout(r, 10_000));
      for (const rec of failedRecords) {
        try {
          const result = await analyzeSetekWithHighlight({
            recordType: rec.type,
            content: rec.content,
            subjectName: rec.subjectName,
            grade: rec.grade,
            careerContext,
          });
          if (result.success) {
            await saveResult(rec.type, rec.id, rec.content, result.data);
          } else {
            failed++;
            logActionDebug(LOG_CTX, `competency_${recordType}[g${targetGrade}]: retry ${rec.id} failed — ${result.error}`);
          }
        } catch (err) {
          failed++;
          logActionError({ ...LOG_CTX, action: `pipeline.competency.grade${targetGrade}.${recordType}.retry` }, err, { recordId: rec.id });
        }
      }
    }
  }

  // 최종 진행 상황 플러시
  await flushProgress(true);

  return { succeeded, failed, skipped, allResults, hasMore, totalUncached };
}

/**
 * 학년별 집계 (aggregateCompetencyGrades + 교과 이수/성취 등급).
 * runCompetencyHaengteukForGrade 완료 시 호출 (마지막 영역).
 */
async function runAggregateForGrade(
  ctx: PipelineContext,
  targetGrade: number,
  allResults: Map<string, HighlightAnalysisResult>,
): Promise<void> {
  const { supabase, studentId, tenantId, studentGrade, snapshot } = ctx;
  const {
    aggregateCompetencyGrades,
    computeCourseEffortGrades,
    computeCourseAchievementGrades,
  } = await import("./rubric-matcher");
  const { calculateCourseAdequacy: calcAdequacy } = await import("./course-adequacy");
  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");

  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;
  const tgtMajor = (snapshot?.target_major as string) ?? null;

  const allGrades: Array<{ item: string; grade: string; reasoning?: string; rubricScores?: { questionIndex: number; grade: string; reasoning: string }[] }> =
    [...allResults.values()].flatMap((d) => d.competencyGrades);

  let careerScoreRows: ScoreRowWithSubject[] = [];

  if (tgtMajor) {
    const { data: scoreRows } = await supabase
      .from("student_internal_scores")
      .select("subject:subject_id(name), rank_grade, grade, semester")
      .eq("student_id", studentId)
      .order("grade")
      .order("semester");
    careerScoreRows = (scoreRows ?? []) as ScoreRowWithSubject[];
    const subjectScores = careerScoreRows
      .map((s) => ({ subjectName: s.subject?.name ?? "", rankGrade: s.rank_grade ?? 5 }))
      .filter((s) => s.subjectName);
    const takenNames = [...new Set(subjectScores.map((s) => s.subjectName))];

    const { getCurriculumYear: getCurYearFn } = await import("@/lib/utils/schoolYear");
    const enrollYear = currentSchoolYear - studentGrade + 1;
    const curYear = getCurYearFn(enrollYear);
    const adequacy = calcAdequacy(tgtMajor, takenNames, null, curYear);

    if (adequacy) {
      const gradedSubjects = careerScoreRows
        .filter((s) => s.subject?.name && s.grade != null && s.semester != null)
        .map((s) => ({ subjectName: s.subject!.name, grade: s.grade as number, semester: s.semester as number }));
      allGrades.push(computeCourseEffortGrades(adequacy, gradedSubjects));
      allGrades.push(computeCourseAchievementGrades(adequacy.taken, subjectScores, adequacy));
    }
  }

  if (allGrades.length > 0) {
    const aggregated = aggregateCompetencyGrades(allGrades);

    await runWithConcurrency(aggregated, 5, async (ag) => {
      const narrative = ag.rubricScores
        ?.filter((rs) => rs.reasoning)
        .map((rs) => rs.reasoning)
        .join(" ") || null;

      await competencyRepo.upsertCompetencyScore({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: targetSchoolYear,
        scope: "yearly",
        competency_area: ag.area,
        competency_item: ag.item,
        grade_value: ag.finalGrade,
        narrative,
        notes: `[AI] ${ag.recordCount}건 ${ag.method === "rubric" ? "루브릭 기반" : "레코드"} 종합 (${targetGrade}학년)`,
        rubric_scores: ag.rubricScores as unknown as CompetencyScoreInsert["rubric_scores"],
        source: "ai",
        status: "suggested",
      } as CompetencyScoreInsert);
    });
  }
}

// ============================================
// G1 (legacy). 학년별 역량 분석 (전체 세특+창체+행특 통합)
// ============================================

export async function runCompetencyAnalysisForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { supabase, studentId, tenantId, studentGrade, snapshot, targetGrade } = ctx;

  if (targetGrade == null) {
    throw new Error("runCompetencyAnalysisForGrade: targetGrade가 설정되지 않았습니다");
  }

  // 해당 학년의 NEIS 레코드 여부 확인
  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  if (!gradeResolved?.hasAnyNeis) {
    return `${targetGrade}학년 NEIS 기록 없음 — 역량 분석 건너뜀`;
  }

  const { analyzeSetekWithHighlight } = await import("./llm/actions/analyzeWithHighlight");
  const { calculateCourseAdequacy: calcAdequacy } = await import("./course-adequacy");
  const { computeRecordContentHash } = await import("./content-hash");
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const allResults = new Map<string, HighlightAnalysisResult>();

  // 학년 school_year 계산 (현재 school_year 기준으로 targetGrade의 school_year 역산)
  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  // 진로 역량 평가용 이수/성적 컨텍스트 사전 조회
  const tgtMajor = (snapshot?.target_major as string) ?? null;
  let careerContext: HighlightAnalysisInput["careerContext"] = undefined;
  let careerScoreRows: ScoreRowWithSubject[] = [];

  if (tgtMajor) {
    const { data: scoreRows } = await supabase
      .from("student_internal_scores")
      .select("subject:subject_id(name), rank_grade, grade, semester")
      .eq("student_id", studentId)
      .order("grade")
      .order("semester");
    careerScoreRows = (scoreRows ?? []) as ScoreRowWithSubject[];
    const subjectScores = careerScoreRows
      .map((s) => ({
        subjectName: s.subject?.name ?? "",
        rankGrade: s.rank_grade ?? 5,
      }))
      .filter((s) => s.subjectName);
    const takenNames = [...new Set(subjectScores.map((s) => s.subjectName))];
    const gradeTrend = careerScoreRows
      .filter((s) => s.rank_grade != null)
      .map((s) => ({
        grade: s.grade ?? 1,
        semester: s.semester ?? 1,
        subjectName: s.subject?.name ?? "",
        rankGrade: s.rank_grade as number,
      }));
    careerContext = {
      targetMajor: tgtMajor,
      takenSubjects: takenNames,
      relevantScores: subjectScores,
      gradeTrend,
    };
  }

  const careerHashCtx = careerContext
    ? { targetMajor: careerContext.targetMajor, takenSubjects: careerContext.takenSubjects }
    : null;

  // 캐시 맵
  let cacheMap = new Map<string, { analysis_result: unknown; content_hash: string | null }>();

  // 분석 결과 저장 헬퍼 (기존 runCompetencyAnalysis와 동일 패턴)
  async function saveAnalysisResultForGrade(
    recordType: "setek" | "personal_setek" | "changche" | "haengteuk",
    recordId: string,
    content: string,
    data: HighlightAnalysisResult,
  ) {
    const tagInputs: ActivityTagInsert[] = [];
    for (const section of data.sections) {
      for (const tag of section.tags) {
        tagInputs.push({
          tenant_id: tenantId,
          student_id: studentId,
          record_type: recordType,
          record_id: recordId,
          competency_item: tag.competencyItem,
          evaluation: tag.evaluation,
          evidence_summary: `[AI] ${tag.reasoning}\n근거: "${tag.highlight}"`,
          source: "ai",
          status: "suggested",
        });
      }
    }
    if (tagInputs.length > 0) {
      await competencyRepo.insertActivityTags(tagInputs);
    }

    const currentHash = computeRecordContentHash(content, careerHashCtx);
    await competencyRepo.upsertAnalysisCache({
      tenant_id: tenantId,
      student_id: studentId,
      record_type: recordType,
      record_id: recordId,
      source: "ai",
      analysis_result: data,
      content_hash: currentHash,
    });

    if (data.contentQuality) {
      const cq = data.contentQuality;
      await supabase
        .from("student_record_content_quality")
        .upsert(
          {
            tenant_id: tenantId,
            student_id: studentId,
            record_type: recordType,
            record_id: recordId,
            school_year: targetSchoolYear,
            specificity: cq.specificity,
            coherence: cq.coherence,
            depth: cq.depth,
            grammar: cq.grammar,
            scientific_validity: cq.scientificValidity ?? null,
            overall_score: cq.overallScore,
            issues: cq.issues,
            feedback: cq.feedback,
            source: "ai",
          },
          { onConflict: "tenant_id,student_id,record_id,source" },
        )
        .then(({ error }) => {
          if (error) {
            logActionDebug(LOG_CTX, `contentQuality upsert failed: ${recordId} — ${error.message}`);
          }
        });
    }

    allResults.set(recordId, data);
    succeeded++;
  }

  // 해당 학년 레코드만 분석 대상으로 필터 (NEIS 있는 것만)
  type AnalysisRecord = { type: "setek" | "changche" | "haengteuk"; id: string; content: string; grade: number; subjectName?: string };
  const analysisRecords: AnalysisRecord[] = [];

  for (const s of (ctx.cachedSeteks ?? [])) {
    if (s.grade !== targetGrade) continue;
    const effectiveContent = s.imported_content?.trim() ? s.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    analysisRecords.push({ type: "setek", id: s.id, content: effectiveContent, grade: s.grade, subjectName: s.subject?.name });
  }
  for (const c of (ctx.cachedChangche ?? [])) {
    if (c.grade !== targetGrade) continue;
    const effectiveContent = c.imported_content?.trim() ? c.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    analysisRecords.push({ type: "changche", id: c.id, content: effectiveContent, grade: c.grade });
  }
  for (const h of (ctx.cachedHaengteuk ?? [])) {
    if (h.grade !== targetGrade) continue;
    const effectiveContent = h.imported_content?.trim() ? h.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    analysisRecords.push({ type: "haengteuk", id: h.id, content: effectiveContent, grade: h.grade });
  }

  if (analysisRecords.length === 0) {
    return `${targetGrade}학년 분석 대상 레코드 없음`;
  }

  // 증분 분석: 배치 캐시 조회
  {
    const cachedEntries = await competencyRepo.findAnalysisCacheByRecordIds(
      analysisRecords.map((r) => r.id), tenantId, "ai",
    );
    cacheMap = new Map(cachedEntries.map((e) => [e.record_id, e]));
  }

  // 캐시 히트 분리 + 미히트 레코드의 AI 태그 배치 삭제
  const uncachedRecords: AnalysisRecord[] = [];
  for (const rec of analysisRecords) {
    const currentHash = computeRecordContentHash(rec.content, careerHashCtx);
    const cached = cacheMap.get(rec.id);
    if (cached?.content_hash && cached.content_hash === currentHash) {
      allResults.set(rec.id, cached.analysis_result as HighlightAnalysisResult);
      skipped++;
    } else {
      uncachedRecords.push(rec);
    }
  }
  if (uncachedRecords.length > 0) {
    await competencyRepo.deleteAiActivityTagsByRecordIds(uncachedRecords.map((r) => r.id), tenantId);
  }

  // 개별 LLM 호출 (동시성 3, 캐시 미히트 레코드만)
  if (uncachedRecords.length > 0) {
    const failedRecords: AnalysisRecord[] = [];

    await runWithConcurrency(uncachedRecords, 3, async (rec) => {
      try {
        const result = await analyzeSetekWithHighlight({
          recordType: rec.type,
          content: rec.content,
          subjectName: rec.subjectName,
          grade: rec.grade,
          careerContext,
        });
        if (result.success) {
          await saveAnalysisResultForGrade(rec.type, rec.id, rec.content, result.data);
        } else {
          failedRecords.push(rec);
          logActionDebug(LOG_CTX, `competency_analysis[g${targetGrade}]: ${rec.type} ${rec.id} failed — ${result.error}`);
        }
      } catch (err) {
        failedRecords.push(rec);
        logActionError({ ...LOG_CTX, action: `pipeline.competency.grade${targetGrade}.${rec.type}` }, err, { recordId: rec.id });
      }
    });

    // 실패 레코드 재시도 (동시성 1, 10초 대기)
    if (failedRecords.length > 0) {
      logActionDebug(LOG_CTX, `competency_analysis[g${targetGrade}]: ${failedRecords.length}건 재시도 대기 (10초)`);
      await new Promise((r) => setTimeout(r, 10_000));
      for (const rec of failedRecords) {
        try {
          const result = await analyzeSetekWithHighlight({
            recordType: rec.type,
            content: rec.content,
            subjectName: rec.subjectName,
            grade: rec.grade,
            careerContext,
          });
          if (result.success) {
            await saveAnalysisResultForGrade(rec.type, rec.id, rec.content, result.data);
          } else {
            failed++;
            logActionDebug(LOG_CTX, `competency_analysis[g${targetGrade}]: retry ${rec.type} ${rec.id} failed — ${result.error}`);
          }
        } catch (err) {
          failed++;
          logActionError({ ...LOG_CTX, action: `pipeline.competency.grade${targetGrade}.retry.${rec.type}` }, err, { recordId: rec.id });
        }
      }
    }
  }

  // 루브릭 기반 종합 등급 저장 (해당 학년만 대상)
  {
    const {
      aggregateCompetencyGrades,
      computeCourseEffortGrades,
      computeCourseAchievementGrades,
    } = await import("./rubric-matcher");

    const allGrades: Array<{ item: string; grade: string; reasoning?: string; rubricScores?: { questionIndex: number; grade: string; reasoning: string }[] }> =
      [...allResults.values()].flatMap((d) => d.competencyGrades);

    if (tgtMajor) {
      const subjectScores = careerScoreRows
        .map((s) => ({
          subjectName: s.subject?.name ?? "",
          rankGrade: s.rank_grade ?? 5,
        }))
        .filter((s) => s.subjectName);
      const takenNames = [...new Set(subjectScores.map((s) => s.subjectName))];

      const { getCurriculumYear: getCurYearFn } = await import("@/lib/utils/schoolYear");
      const enrollYear = currentSchoolYear - studentGrade + 1;
      const curYear = getCurYearFn(enrollYear);
      const adequacy = calcAdequacy(tgtMajor, takenNames, null, curYear);

      if (adequacy) {
        const gradedSubjects = careerScoreRows
          .filter((s) => s.subject?.name && s.grade != null && s.semester != null)
          .map((s) => ({
            subjectName: s.subject!.name,
            grade: s.grade as number,
            semester: s.semester as number,
          }));
        allGrades.push(computeCourseEffortGrades(adequacy, gradedSubjects));
        allGrades.push(computeCourseAchievementGrades(adequacy.taken, subjectScores, adequacy));
      }
    }

    if (allGrades.length > 0) {
      const aggregated = aggregateCompetencyGrades(allGrades);

      await runWithConcurrency(aggregated, 5, async (ag) => {
        const narrative = ag.rubricScores
          ?.filter((rs) => rs.reasoning)
          .map((rs) => rs.reasoning)
          .join(" ") || null;

        await competencyRepo.upsertCompetencyScore({
          tenant_id: tenantId,
          student_id: studentId,
          school_year: targetSchoolYear,
          scope: "yearly",
          competency_area: ag.area,
          competency_item: ag.item,
          grade_value: ag.finalGrade,
          narrative,
          notes: `[AI] ${ag.recordCount}건 ${ag.method === "rubric" ? "루브릭 기반" : "레코드"} 종합 (${targetGrade}학년)`,
          rubric_scores: ag.rubricScores as unknown as CompetencyScoreInsert["rubric_scores"],
          source: "ai",
          status: "suggested",
        } as CompetencyScoreInsert);
      });
    }
  }

  const total = succeeded + skipped + failed;
  const allCached = total > 0 && skipped === total;
  const parts = [`${succeeded}건 분석`];
  if (skipped > 0) parts.push(`${skipped}건 캐시`);
  if (failed > 0) parts.push(`${failed}건 실패`);
  return {
    preview: `${targetGrade}학년 역량 분석 ${parts.join(", ")}`,
    result: { allCached },
  };
}

// ============================================
// G2. 학년별 세특 방향 가이드
// ============================================

export async function runSetekGuideForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { studentId, tenantId, studentGrade, targetGrade } = ctx;

  if (targetGrade == null) {
    throw new Error("runSetekGuideForGrade: targetGrade가 설정되지 않았습니다");
  }

  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  // 해당 학년이 NEIS 학년인지 컨설팅 학년인지 판별
  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  const isNeisGrade = gradeResolved?.hasAnyNeis ?? false;
  const isConsultingGrade = !isNeisGrade;

  if (!gradeResolved) {
    return `${targetGrade}학년 레코드 없음 — 세특 방향 건너뜀`;
  }

  // 캐시 체크: 상위 역량 분석이 모두 캐시 + 기존 AI 가이드 존재 → LLM 스킵
  const setekUpstream = ctx.results["competency_setek"] as Record<string, unknown> | undefined;
  if (setekUpstream?.allCached === true) {
    const { count } = await ctx.supabase
      .from("student_record_setek_guides")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", targetSchoolYear)
      .eq("source", "ai");

    if (count && count > 0) {
      return {
        preview: `${targetGrade}학년 세특 방향 ${count}과목 (캐시)`,
        result: { cached: true },
      };
    }
  }

  const { buildGuideContextSection } = await import("./guide-context");
  const guideContextSection = await buildGuideContextSection(studentId, "guide");

  let improvementsSection: string | undefined;
  const diagForGuide = await (await import("./diagnosis-repository")).findDiagnosis(studentId, currentSchoolYear, tenantId, "ai");
  if (diagForGuide && Array.isArray(diagForGuide.improvements) && (diagForGuide.improvements as unknown[]).length > 0) {
    const imps = diagForGuide.improvements as Array<{ priority: string; area: string; action: string }>;
    improvementsSection = `## 개선 우선순위 (세특 방향에 반영)\n${imps.map((i) => `- [${i.priority}] ${i.area}: ${i.action}`).join("\n")}`;
  }

  const extraSections = [guideContextSection, improvementsSection].filter(Boolean).join("\n") || undefined;

  if (isNeisGrade) {
    // NEIS 학년 → 분석형 세특 가이드
    const { analyzeSetekGuide } = await import("./llm/actions/guide-modules");
    const result = await analyzeSetekGuide(studentId, [targetGrade], extraSections);
    if (!result.success) throw new Error(result.error);
    const guides = (result.data as { guides?: Array<{ subjectName: string }> })?.guides;
    return guides ? `${targetGrade}학년 NEIS 세특 ${guides.length}과목` : `${targetGrade}학년 세특 방향 생성 완료`;
  }

  if (isConsultingGrade) {
    // 컨설팅 학년 → 수강계획 기반 세특 방향
    const { generateSetekDirection } = await import("./llm/actions/guide-modules");
    const result = await generateSetekDirection(studentId, [targetGrade], extraSections, targetSchoolYear);
    if (!result.success) throw new Error(result.error);
    const guides = (result.data as { guides?: Array<{ subjectName: string }> })?.guides;
    return guides ? `${targetGrade}학년 세특 방향 ${guides.length}과목` : `${targetGrade}학년 세특 방향 생성 완료`;
  }

  return `${targetGrade}학년 세특 방향 건너뜀`;
}

// ============================================
// G3. 학년별 창체 방향 가이드
// ============================================

export async function runChangcheGuideForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { studentId, tenantId, studentGrade, coursePlanData, targetGrade } = ctx;

  if (targetGrade == null) {
    throw new Error("runChangcheGuideForGrade: targetGrade가 설정되지 않았습니다");
  }

  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  const isNeisGrade = gradeResolved?.hasAnyNeis ?? false;

  if (!gradeResolved) {
    return `${targetGrade}학년 레코드 없음 — 창체 방향 건너뜀`;
  }

  // 캐시 체크: 상위 역량 분석 캐시 + 세특 방향 안정 + 기존 AI 가이드 존재 → LLM 스킵
  const changcheUpstream = ctx.results["competency_changche"] as Record<string, unknown> | undefined;
  const setekGuideStable = (ctx.results["setek_guide"] as Record<string, unknown> | undefined)?.cached === true;
  if (changcheUpstream?.allCached === true && setekGuideStable) {
    const { count } = await ctx.supabase
      .from("student_record_changche_guides")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", targetSchoolYear)
      .eq("source", "ai");

    if (count && count > 0) {
      return {
        preview: `${targetGrade}학년 창체 ${count}개 활동유형 방향 (캐시)`,
        result: { cached: true },
      };
    }
  }

  if (isNeisGrade) {
    // NEIS 학년 → 분석형 창체 가이드
    const { analyzeChangcheGuide } = await import("./llm/actions/guide-modules");
    const result = await analyzeChangcheGuide(studentId, [targetGrade]);
    if (!result.success) throw new Error(result.error);
    const guides = (result.data as { guides?: Array<{ activityType: string }> })?.guides;
    return guides ? `${targetGrade}학년 창체 ${guides.length}개 활동유형 방향 생성` : `${targetGrade}학년 창체 방향 생성 완료`;
  }

  // 컨설팅 학년 → 수강계획 기반 창체 방향
  const { generateChangcheDirection } = await import("./llm/actions/guide-modules");
  const { fetchReportData: fetchReport } = await import("./actions/report");
  const { requireAdminOrConsultant: reqAuth } = await import("@/lib/auth/guards");
  const { userId: guideUserId } = await reqAuth();

  const reportResult = await fetchReport(studentId);
  if (!reportResult.success || !reportResult.data) {
    throw new Error(reportResult.success === false ? reportResult.error : `${targetGrade}학년 리포트 데이터 수집 실패`);
  }

  // 세특 방향 컨텍스트 (해당 학년 school_year 기준)
  const { data: setekCtxRows } = await ctx.supabase
    .from("student_record_setek_guides")
    .select("direction, keywords")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", targetSchoolYear)
    .eq("source", "ai")
    .limit(4);
  const setekCtx = setekCtxRows?.length
    ? `## 세특 방향 요약\n${setekCtxRows.map((r) => `- ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`).join("\n")}`
    : undefined;

  await generateChangcheDirection(
    studentId, tenantId, guideUserId,
    reportResult.data, coursePlanData ?? null, undefined, setekCtx, targetSchoolYear,
  );

  return `${targetGrade}학년 창체 방향 생성 완료 (예비)`;
}

// ============================================
// G4. 학년별 행특 방향 가이드
// ============================================

export async function runHaengteukGuideForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { studentId, tenantId, studentGrade, coursePlanData, targetGrade } = ctx;

  if (targetGrade == null) {
    throw new Error("runHaengteukGuideForGrade: targetGrade가 설정되지 않았습니다");
  }

  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  const isNeisGrade = gradeResolved?.hasAnyNeis ?? false;

  if (!gradeResolved) {
    return `${targetGrade}학년 레코드 없음 — 행특 방향 건너뜀`;
  }

  // 캐시 체크: 상위 역량 분석 캐시 + 창체 방향 안정 + 기존 AI 가이드 존재 → LLM 스킵
  const haengteukUpstream = ctx.results["competency_haengteuk"] as Record<string, unknown> | undefined;
  const changcheGuideStable = (ctx.results["changche_guide"] as Record<string, unknown> | undefined)?.cached === true;
  if (haengteukUpstream?.allCached === true && changcheGuideStable) {
    const { count } = await ctx.supabase
      .from("student_record_haengteuk_guides")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", targetSchoolYear)
      .eq("source", "ai");

    if (count && count > 0) {
      return {
        preview: `${targetGrade}학년 행특 방향 (캐시)`,
        result: { cached: true },
      };
    }
  }

  if (isNeisGrade) {
    // NEIS 학년 → 분석형 행특 가이드
    const { analyzeHaengteukGuide } = await import("./llm/actions/guide-modules");
    const result = await analyzeHaengteukGuide(studentId, [targetGrade]);
    if (!result.success) throw new Error(result.error);
    return `${targetGrade}학년 행특 방향 생성 완료`;
  }

  // 컨설팅 학년 → 수강계획 기반 행특 방향
  const { generateHaengteukDirection } = await import("./llm/actions/guide-modules");
  const { fetchReportData: fetchReport } = await import("./actions/report");
  const { requireAdminOrConsultant: reqAuth } = await import("@/lib/auth/guards");
  const { userId: guideUserId } = await reqAuth();

  const reportResult = await fetchReport(studentId);
  if (!reportResult.success || !reportResult.data) {
    throw new Error(reportResult.success === false ? reportResult.error : `${targetGrade}학년 리포트 데이터 수집 실패`);
  }

  // 창체 방향 컨텍스트 (해당 학년 school_year 기준)
  const ACTIVITY_LABELS: Record<string, string> = { autonomy: "자율", club: "동아리", career: "진로" };
  const { data: changcheCtxRows } = await ctx.supabase
    .from("student_record_changche_guides")
    .select("activity_type, direction, keywords")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", targetSchoolYear)
    .eq("source", "ai")
    .limit(3);
  const changcheCtx = changcheCtxRows?.length
    ? `## 창체 방향 요약\n${changcheCtxRows.map((r) => `- ${ACTIVITY_LABELS[r.activity_type] ?? r.activity_type}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`).join("\n")}`
    : undefined;

  await generateHaengteukDirection(
    studentId, tenantId, guideUserId,
    reportResult.data, coursePlanData ?? null, undefined, changcheCtx, targetSchoolYear,
  );

  return `${targetGrade}학년 행특 방향 생성 완료 (예비)`;
}

// ============================================
// G1-a. 학년별 세특 역량 분석
// ============================================

export async function runCompetencySetekForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { targetGrade } = ctx;

  if (targetGrade == null) {
    throw new Error("runCompetencySetekForGrade: targetGrade가 설정되지 않았습니다");
  }

  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  if (!gradeResolved?.hasAnyNeis) {
    return `${targetGrade}학년 NEIS 기록 없음 — 세특 역량 분석 건너뜀`;
  }

  type AnalysisRecord = { type: "setek" | "changche" | "haengteuk"; id: string; content: string; grade: number; subjectName?: string };
  const analysisRecords: AnalysisRecord[] = [];
  for (const s of (ctx.cachedSeteks ?? [])) {
    if (s.grade !== targetGrade) continue;
    const effectiveContent = s.imported_content?.trim() ? s.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    analysisRecords.push({ type: "setek", id: s.id, content: effectiveContent, grade: s.grade, subjectName: s.subject?.name });
  }

  const { succeeded, failed, skipped, allResults } = await runCompetencyForRecords(ctx, targetGrade, "setek", analysisRecords, { taskKey: "competency_setek" });

  // Phase 간 맥락 전달: 분석 결과를 ctx.analysisContext에 축적
  collectAnalysisContext(ctx, targetGrade, "setek", analysisRecords, allResults);

  const total = succeeded + skipped + failed;
  const parts = [`${succeeded}건 분석`];
  if (skipped > 0) parts.push(`${skipped}건 캐시`);
  if (failed > 0) parts.push(`${failed}건 실패`);
  return {
    preview: `${targetGrade}학년 세특 역량 분석 ${total === 0 ? "대상 없음" : parts.join(", ")}`,
    result: { allCached: total > 0 && skipped === total },
  };
}

// ============================================
// G1-a-chunk. 학년별 세특 역량 분석 (청크 단위)
// ============================================

export async function runCompetencySetekChunkForGrade(
  ctx: PipelineContext,
  chunkSize: number,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number }> {
  const { targetGrade } = ctx;

  if (targetGrade == null) {
    throw new Error("runCompetencySetekChunkForGrade: targetGrade가 설정되지 않았습니다");
  }

  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  if (!gradeResolved?.hasAnyNeis) {
    return {
      preview: `${targetGrade}학년 NEIS 기록 없음 — 세특 역량 분석 건너뜀`,
      result: { allCached: false },
      hasMore: false,
      totalUncached: 0,
      chunkProcessed: 0,
    };
  }

  type AnalysisRecord = { type: "setek" | "changche" | "haengteuk"; id: string; content: string; grade: number; subjectName?: string };
  const analysisRecords: AnalysisRecord[] = [];
  for (const s of (ctx.cachedSeteks ?? [])) {
    if (s.grade !== targetGrade) continue;
    const effectiveContent = s.imported_content?.trim() ? s.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    analysisRecords.push({ type: "setek", id: s.id, content: effectiveContent, grade: s.grade, subjectName: s.subject?.name });
  }

  const { succeeded, failed, skipped, allResults, hasMore, totalUncached } = await runCompetencyForRecords(
    ctx, targetGrade, "setek", analysisRecords,
    { taskKey: "competency_setek" },
    { chunkSize },
  );

  // Phase 간 맥락 전달: 청크 결과도 ctx.analysisContext에 축적
  collectAnalysisContext(ctx, targetGrade, "setek", analysisRecords, allResults);

  const total = succeeded + skipped + failed;
  const parts = [`${succeeded}건 분석`];
  if (skipped > 0) parts.push(`${skipped}건 캐시`);
  if (failed > 0) parts.push(`${failed}건 실패`);
  if (hasMore) parts.push(`잔여 ${totalUncached - chunkSize}건`);

  return {
    preview: `${targetGrade}학년 세특 역량 ${total === 0 ? "대상 없음" : parts.join(", ")}`,
    result: { allCached: total > 0 && skipped === total },
    hasMore,
    totalUncached,
    chunkProcessed: succeeded + failed,
  };
}

// ============================================
// G1-b. 학년별 창체 역량 분석
// ============================================

export async function runCompetencyChangcheForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { targetGrade } = ctx;

  if (targetGrade == null) {
    throw new Error("runCompetencyChangcheForGrade: targetGrade가 설정되지 않았습니다");
  }

  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  if (!gradeResolved?.hasAnyNeis) {
    return `${targetGrade}학년 NEIS 기록 없음 — 창체 역량 분석 건너뜀`;
  }

  type AnalysisRecord = { type: "setek" | "changche" | "haengteuk"; id: string; content: string; grade: number; subjectName?: string };
  const analysisRecords: AnalysisRecord[] = [];
  for (const c of (ctx.cachedChangche ?? [])) {
    if (c.grade !== targetGrade) continue;
    const effectiveContent = c.imported_content?.trim() ? c.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    analysisRecords.push({ type: "changche", id: c.id, content: effectiveContent, grade: c.grade });
  }

  const { succeeded, failed, skipped, allResults: changcheResults } = await runCompetencyForRecords(ctx, targetGrade, "changche", analysisRecords, { taskKey: "competency_changche" });

  // Phase 간 맥락 전달
  collectAnalysisContext(ctx, targetGrade, "changche", analysisRecords, changcheResults);

  const total = succeeded + skipped + failed;
  const parts = [`${succeeded}건 분석`];
  if (skipped > 0) parts.push(`${skipped}건 캐시`);
  if (failed > 0) parts.push(`${failed}건 실패`);
  return {
    preview: `${targetGrade}학년 창체 역량 분석 ${total === 0 ? "대상 없음" : parts.join(", ")}`,
    result: { allCached: total > 0 && skipped === total },
  };
}

// ============================================
// G1-b-chunk. 학년별 창체 역량 분석 (청크 단위)
// ============================================

export async function runCompetencyChangcheChunkForGrade(
  ctx: PipelineContext,
  chunkSize: number,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number }> {
  const { targetGrade } = ctx;

  if (targetGrade == null) {
    throw new Error("runCompetencyChangcheChunkForGrade: targetGrade가 설정되지 않았습니다");
  }

  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  if (!gradeResolved?.hasAnyNeis) {
    return {
      preview: `${targetGrade}학년 NEIS 기록 없음 — 창체 역량 분석 건너뜀`,
      result: { allCached: false },
      hasMore: false, totalUncached: 0, chunkProcessed: 0,
    };
  }

  type AnalysisRecord = { type: "setek" | "changche" | "haengteuk"; id: string; content: string; grade: number; subjectName?: string };
  const analysisRecords: AnalysisRecord[] = [];
  for (const c of (ctx.cachedChangche ?? [])) {
    if (c.grade !== targetGrade) continue;
    const effectiveContent = c.imported_content?.trim() ? c.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    analysisRecords.push({ type: "changche", id: c.id, content: effectiveContent, grade: c.grade });
  }

  const { succeeded, failed, skipped, allResults: changcheChunkResults, hasMore, totalUncached } = await runCompetencyForRecords(
    ctx, targetGrade, "changche", analysisRecords,
    { taskKey: "competency_changche" },
    { chunkSize },
  );

  // Phase 간 맥락 전달
  collectAnalysisContext(ctx, targetGrade, "changche", analysisRecords, changcheChunkResults);

  const total = succeeded + skipped + failed;
  const parts = [`${succeeded}건 분석`];
  if (skipped > 0) parts.push(`${skipped}건 캐시`);
  if (failed > 0) parts.push(`${failed}건 실패`);
  if (hasMore) parts.push(`잔여 ${totalUncached - chunkSize}건`);

  return {
    preview: `${targetGrade}학년 창체 역량 ${total === 0 ? "대상 없음" : parts.join(", ")}`,
    result: { allCached: total > 0 && skipped === total },
    hasMore, totalUncached, chunkProcessed: succeeded + failed,
  };
}

// ============================================
// G1-c. 학년별 행특 역량 분석 (+ 집계)
// ============================================

export async function runCompetencyHaengteukForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { targetGrade } = ctx;

  if (targetGrade == null) {
    throw new Error("runCompetencyHaengteukForGrade: targetGrade가 설정되지 않았습니다");
  }

  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  if (!gradeResolved?.hasAnyNeis) {
    return `${targetGrade}학년 NEIS 기록 없음 — 행특 역량 분석 건너뜀`;
  }

  type AnalysisRecord = { type: "setek" | "changche" | "haengteuk"; id: string; content: string; grade: number; subjectName?: string };
  const analysisRecords: AnalysisRecord[] = [];
  for (const h of (ctx.cachedHaengteuk ?? [])) {
    if (h.grade !== targetGrade) continue;
    const effectiveContent = h.imported_content?.trim() ? h.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    analysisRecords.push({ type: "haengteuk", id: h.id, content: effectiveContent, grade: h.grade });
  }

  const { succeeded, failed, skipped, allResults } = await runCompetencyForRecords(ctx, targetGrade, "haengteuk", analysisRecords, { taskKey: "competency_haengteuk" });

  // 모든 영역(세특+창체+행특) 분석 완료 후 종합 집계
  // 행특이 마지막 역량 분석 Phase이므로 여기서 집계를 실행
  // allResults에는 행특 결과만 있으므로 전체 allResults를 수집해 집계
  const allForAggregate = new Map<string, HighlightAnalysisResult>();

  // 전체 학년 레코드에서 캐시된 분석 결과 수집 (집계용)
  {
    const { computeRecordContentHash } = await import("./content-hash");
    const allRecordIds: string[] = [];
    for (const s of (ctx.cachedSeteks ?? [])) {
      if (s.grade === targetGrade && (s.imported_content?.trim()?.length ?? 0) >= 20) allRecordIds.push(s.id);
    }
    for (const c of (ctx.cachedChangche ?? [])) {
      if (c.grade === targetGrade && (c.imported_content?.trim()?.length ?? 0) >= 20) allRecordIds.push(c.id);
    }
    for (const h of (ctx.cachedHaengteuk ?? [])) {
      if (h.grade === targetGrade && (h.imported_content?.trim()?.length ?? 0) >= 20) allRecordIds.push(h.id);
    }

    if (allRecordIds.length > 0) {
      const cached = await competencyRepo.findAnalysisCacheByRecordIds(allRecordIds, ctx.tenantId, "ai");
      for (const entry of cached) {
        if (entry.analysis_result) {
          allForAggregate.set(entry.record_id, entry.analysis_result as HighlightAnalysisResult);
        }
      }
    }
    // 방금 분석한 행특 결과도 포함
    for (const [id, result] of allResults) {
      allForAggregate.set(id, result);
    }
    void computeRecordContentHash; // 사용됨을 lint에 알림
  }

  await runAggregateForGrade(ctx, targetGrade, allForAggregate);

  // Phase 간 맥락 전달: 행특 결과 + 전체 집계 결과를 ctx.analysisContext에 축적
  collectAnalysisContext(ctx, targetGrade, "haengteuk", analysisRecords, allResults);

  const total = succeeded + skipped + failed;
  const parts = [`${succeeded}건 분석`];
  if (skipped > 0) parts.push(`${skipped}건 캐시`);
  if (failed > 0) parts.push(`${failed}건 실패`);
  return {
    preview: `${targetGrade}학년 행특 역량 분석 ${total === 0 ? "대상 없음" : parts.join(", ")} (집계 완료)`,
    result: { allCached: total > 0 && skipped === total },
  };
}

// ============================================
// G1-c-chunk. 학년별 행특 역량 분석 (청크 단위 + 마지막 청크에서 집계)
// ============================================

export async function runCompetencyHaengteukChunkForGrade(
  ctx: PipelineContext,
  chunkSize: number,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number }> {
  const { targetGrade } = ctx;

  if (targetGrade == null) {
    throw new Error("runCompetencyHaengteukChunkForGrade: targetGrade가 설정되지 않았습니다");
  }

  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  if (!gradeResolved?.hasAnyNeis) {
    return {
      preview: `${targetGrade}학년 NEIS 기록 없음 — 행특 역량 분석 건너뜀`,
      result: { allCached: false },
      hasMore: false, totalUncached: 0, chunkProcessed: 0,
    };
  }

  type AnalysisRecord = { type: "setek" | "changche" | "haengteuk"; id: string; content: string; grade: number; subjectName?: string };
  const analysisRecords: AnalysisRecord[] = [];
  for (const h of (ctx.cachedHaengteuk ?? [])) {
    if (h.grade !== targetGrade) continue;
    const effectiveContent = h.imported_content?.trim() ? h.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    analysisRecords.push({ type: "haengteuk", id: h.id, content: effectiveContent, grade: h.grade });
  }

  const { succeeded, failed, skipped, allResults, hasMore, totalUncached } = await runCompetencyForRecords(
    ctx, targetGrade, "haengteuk", analysisRecords,
    { taskKey: "competency_haengteuk" },
    { chunkSize },
  );

  // 마지막 청크에서만 집계 실행
  if (!hasMore) {
    const allForAggregate = new Map<string, HighlightAnalysisResult>();
    const allRecordIds: string[] = [];
    for (const s of (ctx.cachedSeteks ?? [])) {
      if (s.grade === targetGrade && (s.imported_content?.trim()?.length ?? 0) >= 20) allRecordIds.push(s.id);
    }
    for (const c of (ctx.cachedChangche ?? [])) {
      if (c.grade === targetGrade && (c.imported_content?.trim()?.length ?? 0) >= 20) allRecordIds.push(c.id);
    }
    for (const h of (ctx.cachedHaengteuk ?? [])) {
      if (h.grade === targetGrade && (h.imported_content?.trim()?.length ?? 0) >= 20) allRecordIds.push(h.id);
    }
    if (allRecordIds.length > 0) {
      const cached = await competencyRepo.findAnalysisCacheByRecordIds(allRecordIds, ctx.tenantId, "ai");
      for (const entry of cached) {
        if (entry.analysis_result) {
          allForAggregate.set(entry.record_id, entry.analysis_result as HighlightAnalysisResult);
        }
      }
    }
    for (const [id, result] of allResults) {
      allForAggregate.set(id, result);
    }
    await runAggregateForGrade(ctx, targetGrade, allForAggregate);
  }

  const total = succeeded + skipped + failed;
  const parts = [`${succeeded}건 분석`];
  if (skipped > 0) parts.push(`${skipped}건 캐시`);
  if (failed > 0) parts.push(`${failed}건 실패`);
  if (!hasMore) parts.push("집계 완료");
  if (hasMore) parts.push(`잔여 ${totalUncached - chunkSize}건`);

  return {
    preview: `${targetGrade}학년 행특 역량 ${total === 0 ? "대상 없음" : parts.join(", ")}`,
    result: { allCached: total > 0 && skipped === total },
    hasMore, totalUncached, chunkProcessed: succeeded + failed,
  };
}

// ============================================
// G5. 학년별 슬롯 생성 (컨설팅 학년만)
// ============================================

export async function runSlotGenerationForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { studentId, tenantId, studentGrade, coursePlanData, supabase, targetGrade } = ctx;

  if (targetGrade == null) {
    throw new Error("runSlotGenerationForGrade: targetGrade가 설정되지 않았습니다");
  }

  // 해당 학년이 NEIS 학년이면 슬롯 생성 불필요 (임포트된 데이터 이미 있음)
  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  if (gradeResolved?.hasAnyNeis) {
    return `${targetGrade}학년 NEIS 확보 — 슬롯 생성 불필요`;
  }

  const { ensureConsultingGradeSlots } = await import("./pipeline-slot-generator");
  const result = await ensureConsultingGradeSlots({
    studentId,
    tenantId,
    studentGrade,
    consultingGrades: [targetGrade],
    coursePlanData: coursePlanData ?? null,
    supabase,
  });

  return `${targetGrade}학년 슬롯: 세특 ${result.setekCount}과목, 창체 ${result.changcheCount}영역, 행특 ${result.haengteukCount}건`;
}

