// ============================================
// 역량 분석 태스크 러너 (Grade Pipeline P1-P3)
// G1-a: runCompetencySetekForGrade / runCompetencySetekChunkForGrade
// G1-b: runCompetencyChangcheForGrade / runCompetencyChangcheChunkForGrade
// G1-c: runCompetencyHaengteukForGrade / runCompetencyHaengteukChunkForGrade
// G1(legacy): runCompetencyAnalysisForGrade
// ============================================

import { logActionError, logActionDebug, logActionWarn } from "@/lib/logging/actionLogger";
import { updatePipelineState } from "./pipeline-executor";
import {
  assertGradeCtx,
  type PipelineContext,
  type TaskRunnerOutput,
  type ScoreRowWithSubject,
} from "./pipeline-types";
import * as competencyRepo from "./repository/competency-repository";
import { toDbJson, type CompetencyScoreInsert } from "./types";
import type { HighlightAnalysisResult, HighlightAnalysisInput } from "./llm/types";
import { runWithConcurrency, collectAnalysisContext } from "./pipeline-task-runners-shared";
import { PIPELINE_THRESHOLDS } from "./constants";

const LOG_CTX = { domain: "student-record", action: "pipeline" };

// ============================================
// 역량 분석 타입별 설정 (G1-a/b/c 공통 디스패치)
// ============================================

const COMPETENCY_TYPE_CONFIG = {
  setek:    { cacheKey: "cachedSeteks"    as const, taskKey: "competency_setek"    as const, label: "세특" },
  changche: { cacheKey: "cachedChangche"  as const, taskKey: "competency_changche" as const, label: "창체" },
  haengteuk:{ cacheKey: "cachedHaengteuk" as const, taskKey: "competency_haengteuk" as const, label: "행특" },
} as const;

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

  const { fetchCareerContext } = await import("./repository/score-query");
  const ccResult = await fetchCareerContext(supabase, studentId, tgtMajor);
  if (ccResult) {
    careerContext = ccResult.careerContext;
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

  // 분석 결과 저장 헬퍼 (per-record atomic: delete+insert in single RPC transaction)
  async function saveResult(
    recType: "setek" | "personal_setek" | "changche" | "haengteuk",
    recordId: string,
    content: string,
    data: HighlightAnalysisResult,
  ) {
    const rpcTags: Array<{ record_type: string; record_id: string; competency_item: string; evaluation: string; evidence_summary: string; tag_context: string }> = [];
    for (const section of data.sections) {
      for (const tag of section.tags) {
        rpcTags.push({
          record_type: recType,
          record_id: recordId,
          competency_item: tag.competencyItem,
          evaluation: tag.evaluation,
          evidence_summary: `[AI] ${tag.reasoning}\n근거: "${tag.highlight}"`,
          tag_context: "analysis",
        });
      }
    }
    await competencyRepo.refreshCompetencyTagsAtomic(studentId, tenantId, [recordId], rpcTags);

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
            logActionWarn(LOG_CTX, `contentQuality upsert failed: ${recordId} — ${error.message}`, { recordId, recType });
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

  const { fetchCareerContext: fetchCC } = await import("./repository/score-query");
  const aggCcResult = await fetchCC(supabase, studentId, tgtMajor);
  const careerScoreRows = aggCcResult?.careerScoreRows ?? [];

  if (tgtMajor && aggCcResult) {
    const subjectScores = careerScoreRows
      .map((s) => ({ subjectName: s.subject?.name ?? "", rankGrade: s.rank_grade ?? 5 }))
      .filter((s) => s.subjectName);
    const takenNames = aggCcResult.careerContext.takenSubjects;

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
        rubric_scores: toDbJson(ag.rubricScores),
        source: "ai",
        status: "suggested",
      } as CompetencyScoreInsert);
    });
  }
}

// ============================================
// G1-internal. 타입별 디스패치 제네릭 구현
// ============================================

type CompetencyRecordType = "setek" | "changche" | "haengteuk";
type AnalysisRecord = { type: CompetencyRecordType; id: string; content: string; grade: number; subjectName?: string };

/** 공통 레코드 빌더: ctx[cacheKey]에서 targetGrade 레코드를 AnalysisRecord[]로 변환 */
function buildAnalysisRecords(ctx: PipelineContext, recordType: CompetencyRecordType): AnalysisRecord[] {
  const config = COMPETENCY_TYPE_CONFIG[recordType];
  const records = ctx[config.cacheKey] ?? [];
  const { targetGrade } = ctx;
  const result: AnalysisRecord[] = [];
  for (const rec of records) {
    if (rec.grade !== targetGrade) continue;
    const effectiveContent = rec.imported_content?.trim() ? rec.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    const subjectName = "subject" in rec ? (rec as { subject?: { name?: string } }).subject?.name : undefined;
    result.push({ type: recordType, id: rec.id, content: effectiveContent, grade: rec.grade, subjectName });
  }
  return result;
}

/** 행특 완료 후 전 영역 집계를 수행하는 헬퍼 */
async function runHaengteukAggregate(
  ctx: PipelineContext,
  targetGrade: number,
  currentResults: Map<string, import("./llm/types").HighlightAnalysisResult>,
): Promise<void> {
  const allForAggregate = new Map<string, import("./llm/types").HighlightAnalysisResult>();
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
        allForAggregate.set(entry.record_id, entry.analysis_result as import("./llm/types").HighlightAnalysisResult);
      }
    }
  }
  // 방금 분석한 행특 결과도 포함
  for (const [id, result] of currentResults) {
    allForAggregate.set(id, result);
  }
  void computeRecordContentHash; // 사용됨을 lint에 알림
  await runAggregateForGrade(ctx, targetGrade, allForAggregate);
}

/**
 * 역량 분석 ForGrade 제네릭 구현 (setek/changche/haengteuk 공통).
 * haengteuk은 완료 후 전 영역 집계를 추가 실행한다.
 */
async function runCompetencyForType(ctx: PipelineContext, recordType: CompetencyRecordType): Promise<TaskRunnerOutput> {
  assertGradeCtx(ctx);
  const { targetGrade } = ctx;
  const config = COMPETENCY_TYPE_CONFIG[recordType];

  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  if (!gradeResolved?.hasAnyNeis) {
    return `${targetGrade}학년 NEIS 기록 없음 — ${config.label} 역량 분석 건너뜀`;
  }

  const analysisRecords = buildAnalysisRecords(ctx, recordType);

  const { succeeded, failed, skipped, allResults } = await runCompetencyForRecords(
    ctx, targetGrade, recordType, analysisRecords, { taskKey: config.taskKey },
  );

  // Phase 간 맥락 전달: 분석 결과를 ctx.analysisContext에 축적
  collectAnalysisContext(ctx, targetGrade, recordType, analysisRecords, allResults);

  // 행특이 마지막 역량 분석 Phase이므로 여기서 전 영역 집계를 실행
  if (recordType === "haengteuk") {
    await runHaengteukAggregate(ctx, targetGrade, allResults);
  }

  const total = succeeded + skipped + failed;
  const parts = [`${succeeded}건 분석`];
  if (skipped > 0) parts.push(`${skipped}건 캐시`);
  if (failed > 0) parts.push(`${failed}건 실패`);
  if (recordType === "haengteuk") parts.push("집계 완료");
  return {
    preview: `${targetGrade}학년 ${config.label} 역량 분석 ${total === 0 ? "대상 없음" : parts.join(", ")}`,
    result: { allCached: total > 0 && skipped === total },
  };
}

/**
 * 역량 분석 ChunkForGrade 제네릭 구현 (setek/changche/haengteuk 공통).
 * haengteuk은 마지막 청크(!hasMore)에서만 전 영역 집계를 실행한다.
 */
async function runCompetencyChunkForType(
  ctx: PipelineContext,
  recordType: CompetencyRecordType,
  chunkSize: number,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number }> {
  assertGradeCtx(ctx);
  const { targetGrade } = ctx;
  const config = COMPETENCY_TYPE_CONFIG[recordType];

  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  if (!gradeResolved?.hasAnyNeis) {
    return {
      preview: `${targetGrade}학년 NEIS 기록 없음 — ${config.label} 역량 분석 건너뜀`,
      result: { allCached: false },
      hasMore: false,
      totalUncached: 0,
      chunkProcessed: 0,
    };
  }

  const analysisRecords = buildAnalysisRecords(ctx, recordType);

  const { succeeded, failed, skipped, allResults, hasMore, totalUncached } = await runCompetencyForRecords(
    ctx, targetGrade, recordType, analysisRecords,
    { taskKey: config.taskKey },
    { chunkSize },
  );

  // Phase 간 맥락 전달: 청크 결과도 ctx.analysisContext에 축적
  collectAnalysisContext(ctx, targetGrade, recordType, analysisRecords, allResults);

  // 행특: 마지막 청크에서만 집계 실행
  if (recordType === "haengteuk" && !hasMore) {
    await runHaengteukAggregate(ctx, targetGrade, allResults);
  }

  const total = succeeded + skipped + failed;
  const parts = [`${succeeded}건 분석`];
  if (skipped > 0) parts.push(`${skipped}건 캐시`);
  if (failed > 0) parts.push(`${failed}건 실패`);
  if (recordType === "haengteuk" && !hasMore) parts.push("집계 완료");
  if (hasMore) parts.push(`잔여 ${totalUncached - chunkSize}건`);

  return {
    preview: `${targetGrade}학년 ${config.label} 역량 ${total === 0 ? "대상 없음" : parts.join(", ")}`,
    result: { allCached: total > 0 && skipped === total },
    hasMore,
    totalUncached,
    chunkProcessed: succeeded + failed,
  };
}

// ============================================
// G1-a. 학년별 세특 역량 분석
// ============================================

export async function runCompetencySetekForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  return runCompetencyForType(ctx, "setek");
}

// ============================================
// G1-a-chunk. 학년별 세특 역량 분석 (청크 단위)
// ============================================

export async function runCompetencySetekChunkForGrade(
  ctx: PipelineContext,
  chunkSize: number,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number }> {
  return runCompetencyChunkForType(ctx, "setek", chunkSize);
}

// ============================================
// G1-b. 학년별 창체 역량 분석
// ============================================

export async function runCompetencyChangcheForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  return runCompetencyForType(ctx, "changche");
}

// ============================================
// G1-b-chunk. 학년별 창체 역량 분석 (청크 단위)
// ============================================

export async function runCompetencyChangcheChunkForGrade(
  ctx: PipelineContext,
  chunkSize: number,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number }> {
  return runCompetencyChunkForType(ctx, "changche", chunkSize);
}

// ============================================
// G1-c. 학년별 행특 역량 분석 (+ 집계)
// ============================================

export async function runCompetencyHaengteukForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  return runCompetencyForType(ctx, "haengteuk");
}

// ============================================
// G1-c-chunk. 학년별 행특 역량 분석 (청크 단위 + 마지막 청크에서 집계)
// ============================================

export async function runCompetencyHaengteukChunkForGrade(
  ctx: PipelineContext,
  chunkSize: number,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number }> {
  return runCompetencyChunkForType(ctx, "haengteuk", chunkSize);
}


