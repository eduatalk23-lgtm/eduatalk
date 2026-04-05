// ============================================
// legacy: runCompetencyAnalysis (전체 분석 통합 버전)
// ============================================

import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import type {
  PipelineContext,
  TaskRunnerOutput,
  ScoreRowWithSubject,
  CachedSetek,
  CachedChangche,
} from "../../pipeline-types";
import * as competencyRepo from "../../competency-repository";
import { toDbJson, type CompetencyScoreInsert, type CourseAdequacyResult } from "../../types";
import type { HighlightAnalysisResult, HighlightAnalysisInput } from "../../llm/types";
import { runWithConcurrency } from "../../pipeline-task-runners-shared";

const LOG_CTX = { domain: "student-record", action: "pipeline" };

// ============================================
// 1. 역량 분석 (legacy — 전체 세특+창체+행특 통합)
// ============================================

export async function runCompetencyAnalysis(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { supabase, studentId, tenantId, studentGrade, snapshot } = ctx;

  // NEIS 레코드가 하나도 없으면 분석 대상 없음 — skip
  if (!ctx.neisGrades || ctx.neisGrades.length === 0) {
    return "NEIS 기록 없음 — 기록 임포트 후 분석 가능";
  }
  const { analyzeSetekWithHighlight } = await import("../../llm/actions/analyzeWithHighlight");
  const { calculateCourseAdequacy: calcAdequacy } = await import("../../course-adequacy");
  const { computeRecordContentHash } = await import("../../content-hash");
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const allResults = new Map<string, HighlightAnalysisResult>();
  const currentSchoolYear = calculateSchoolYear();

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

    // 학기별 성적 추이
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

  // 증분 분석용 캐시 맵 (레코드 목록 확정 후 채움)
  let cacheMap = new Map<string, { analysis_result: unknown; content_hash: string | null }>();

  const careerHashCtx = careerContext ? { targetMajor: careerContext.targetMajor, takenSubjects: careerContext.takenSubjects } : null;

  // 분석 결과 저장 헬퍼 (per-record atomic: delete+insert in single RPC transaction)
  async function saveAnalysisResult(
    recordType: "setek" | "personal_setek" | "changche" | "haengteuk",
    recordId: string,
    content: string,
    data: HighlightAnalysisResult,
  ) {
    const rpcTags: Array<{ record_type: string; record_id: string; competency_item: string; evaluation: string; evidence_summary: string }> = [];
    for (const section of data.sections) {
      for (const tag of section.tags) {
        rpcTags.push({
          record_type: recordType,
          record_id: recordId,
          competency_item: tag.competencyItem,
          evaluation: tag.evaluation,
          evidence_summary: `[AI] ${tag.reasoning}\n근거: "${tag.highlight}"`,
        });
      }
    }
    await competencyRepo.refreshCompetencyTagsAtomic(studentId, tenantId, [recordId], rpcTags);

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

    // Phase QA: 품질 점수 저장
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
            school_year: currentSchoolYear,
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

  // 1~3. DB 조회 병렬화
  await Promise.all([
    (async () => {
      if (!ctx.cachedSeteks) {
        const { data } = await supabase
          .from("student_record_seteks")
          .select("id, content, imported_content, ai_draft_content, grade, subject:subject_id(name)")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .returns<CachedSetek[]>();
        ctx.cachedSeteks = data ?? [];
      }
    })(),
    (async () => {
      if (!ctx.cachedChangche) {
        const { data } = await supabase
          .from("student_record_changche")
          .select("id, content, imported_content, ai_draft_content, grade, activity_type")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId);
        ctx.cachedChangche = (data ?? []) as CachedChangche[];
      }
    })(),
    (async () => {
      if (!ctx.cachedHaengteuk) {
        const { data } = await supabase
          .from("student_record_haengteuk")
          .select("id, content, imported_content, ai_draft_content, grade")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId);
        ctx.cachedHaengteuk = (data ?? []) as import("../../pipeline-types").CachedHaengteuk[];
      }
    })(),
  ]);

  // NEIS 레코드만 분석 대상으로 필터링 (imported_content 있는 레코드)
  type AnalysisRecord = { type: "setek" | "changche" | "haengteuk"; id: string; content: string; grade: number; subjectName?: string };
  const analysisRecords: AnalysisRecord[] = [];
  for (const s of ctx.cachedSeteks!) {
    const effectiveContent = s.imported_content?.trim() ? s.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    analysisRecords.push({ type: "setek", id: s.id, content: effectiveContent, grade: s.grade, subjectName: s.subject?.name });
  }
  for (const c of ctx.cachedChangche!) {
    const effectiveContent = c.imported_content?.trim() ? c.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    analysisRecords.push({ type: "changche", id: c.id, content: effectiveContent, grade: c.grade });
  }
  for (const h of ctx.cachedHaengteuk!) {
    const effectiveContent = h.imported_content?.trim() ? h.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    analysisRecords.push({ type: "haengteuk", id: h.id, content: effectiveContent, grade: h.grade });
  }

  // 증분 분석: 배치 캐시 조회 (1회 DB 호출)
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
  // 개별 LLM 호출 (동시성 3, 캐시 미히트 레코드만)
  // NOTE: upfront delete 제거 — saveAnalysisResult 내부에서 per-record atomic RPC로 교체됨
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
          await saveAnalysisResult(rec.type, rec.id, rec.content, result.data);
        } else {
          failedRecords.push(rec);
          logActionDebug(LOG_CTX, `competency_analysis: ${rec.type} ${rec.id} failed — ${result.error}`);
        }
      } catch (err) {
        failedRecords.push(rec);
        logActionError({ ...LOG_CTX, action: `pipeline.competency.${rec.type}` }, err, { recordId: rec.id });
      }
    });

    // 실패 레코드 재시도 (동시성 1, 10초 대기 후)
    if (failedRecords.length > 0) {
      logActionDebug(LOG_CTX, `competency_analysis: ${failedRecords.length}건 재시도 대기 (10초)`);
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
            await saveAnalysisResult(rec.type, rec.id, rec.content, result.data);
          } else {
            failed++;
            logActionDebug(LOG_CTX, `competency_analysis: retry ${rec.type} ${rec.id} failed — ${result.error}`);
          }
        } catch (err) {
          failed++;
          logActionError({ ...LOG_CTX, action: `pipeline.competency.retry.${rec.type}` }, err, { recordId: rec.id });
        }
      }
    }
  }

  // 4. 루브릭 기반 종합 등급 저장 (Bottom-Up)
  {
    const {
      aggregateCompetencyGrades,
      computeCourseEffortGrades,
      computeCourseAchievementGrades,
    } = await import("../../rubric-matcher");

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
      const enrollYear = calculateSchoolYear() - studentGrade + 1;
      const curYear = getCurYearFn(enrollYear);
      const adequacy = calcAdequacy(tgtMajor, takenNames, null, curYear) as CourseAdequacyResult | null;

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
          school_year: currentSchoolYear,
          scope: "yearly",
          competency_area: ag.area,
          competency_item: ag.item,
          grade_value: ag.finalGrade,
          narrative,
          notes: `[AI] ${ag.recordCount}건 ${ag.method === "rubric" ? "루브릭 기반" : "레코드"} 종합`,
          rubric_scores: toDbJson(ag.rubricScores),
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
    preview: `역량 분석 ${parts.join(", ")} (세특+창체+행특)`,
    result: { allCached },
  };
}
