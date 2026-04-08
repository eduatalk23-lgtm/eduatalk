// ============================================
// P8: draft_analysis — 가안 역량 분석
//
// 설계 모드 학년의 콘텐츠를 분석하여:
// 1. activity_tags (tag_context='draft_analysis')
// 2. content_quality (source='ai_projected')
// 3. competency_scores (source='ai_projected')
//
// 콘텐츠 우선순위: imported > confirmed > content > ai_draft (4-layer 정책 준수)
// ============================================

import { assertGradeCtx, type PipelineContext } from "./pipeline-types";
import type { TaskRunnerOutput } from "./pipeline-executor";
import { logActionError } from "@/lib/logging/actionLogger";
import { resolveEffectiveContent } from "./pipeline-data-resolver";
import { fetchSubjectNames } from "./pipeline-task-runners-draft-generation";
import type { SupabaseClient } from "@supabase/supabase-js";

const LOG_CTX = { domain: "student-record", action: "draftAnalysis" };

/** contentQuality 저장 헬퍼 (P1-P3와 동일 패턴) */
async function saveContentQuality(
  supabase: SupabaseClient,
  tenantId: string,
  studentId: string,
  targetSchoolYear: number,
  recordType: string,
  recordId: string,
  cq: {
    specificity: number;
    coherence: number;
    depth: number;
    grammar: number;
    scientificValidity?: number | null;
    overallScore: number;
    issues: string[];
    feedback: string;
  },
): Promise<void> {
  const { error: cqErr } = await supabase
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
        source: "ai_projected",
      },
      { onConflict: "tenant_id,student_id,record_id,source" },
    );
  if (cqErr) logActionError(LOG_CTX, cqErr, { recordId, recordType, phase: "draft_analysis_quality" });
}

/** P8 공통: 레코드 배열을 분석하여 태그/품질/역량등급 수집 */
async function analyzeAndCollectTags(
  records: Array<{ id: string; grade: number; confirmed_content?: string | null; content?: string | null; ai_draft_content?: string | null; imported_content?: string | null; subject_id?: string }>,
  opts: {
    recordType: "setek" | "changche" | "haengteuk";
    analyzeSetekWithHighlight: (input: { recordType: string; content: string; subjectName?: string; grade: number }) => Promise<{ success: boolean; data: { sections: Array<{ tags: Array<{ competencyItem: string; evaluation: string; reasoning: string; highlight: string }> }>; contentQuality?: { specificity: number; coherence: number; depth: number; grammar: number; scientificValidity?: number | null; overallScore: number; issues: string[]; feedback: string }; competencyGrades?: Array<{ item: string; grade: string; reasoning?: string; rubricScores?: { questionIndex: number; grade: string; reasoning: string }[] }> } }>;
    supabase: SupabaseClient;
    studentId: string;
    tenantId: string;
    targetGrade: number;
    targetSchoolYear: number;
    subjectNameMap?: Map<string, string>;
  },
): Promise<{
  /** 수집된 태그 (아직 DB 미저장 — 본체에서 RPC로 atomic 저장) */
  collectedTags: Array<{ record_type: string; record_id: string; competency_item: string; evaluation: string; evidence_summary: string }>;
  competencyGrades: Array<{ item: string; grade: string; reasoning?: string; rubricScores?: { questionIndex: number; grade: string; reasoning: string }[] }>;
}> {
  const collectedTags: Array<{ record_type: string; record_id: string; competency_item: string; evaluation: string; evidence_summary: string }> = [];
  const competencyGrades: Array<{ item: string; grade: string; reasoning?: string; rubricScores?: { questionIndex: number; grade: string; reasoning: string }[] }> = [];

  for (const rec of records) {
    const { text: content } = resolveEffectiveContent(rec);
    if (!content || content.length < 20) continue;

    try {
      const result = await opts.analyzeSetekWithHighlight({
        recordType: opts.recordType,
        content,
        subjectName: rec.subject_id ? opts.subjectNameMap?.get(rec.subject_id) : undefined,
        grade: rec.grade ?? opts.targetGrade,
      });

      if (result.success && result.data.sections) {
        for (const section of result.data.sections) {
          for (const tag of section.tags) {
            collectedTags.push({
              record_type: opts.recordType,
              record_id: rec.id,
              competency_item: tag.competencyItem,
              evaluation: tag.evaluation,
              evidence_summary: `[가안분석] ${tag.reasoning}\n근거: "${tag.highlight}"`,
            });
          }
        }

        if (result.data.contentQuality) {
          await saveContentQuality(
            opts.supabase,
            opts.tenantId,
            opts.studentId,
            opts.targetSchoolYear,
            opts.recordType,
            rec.id,
            result.data.contentQuality,
          );
        }
        if (result.data.competencyGrades?.length) {
          competencyGrades.push(...result.data.competencyGrades);
        }
      }
    } catch (err) {
      logActionError(LOG_CTX, err, { recordId: rec.id, phase: `draft_analysis_${opts.recordType}` });
    }
  }

  return { collectedTags, competencyGrades };
}

export async function runDraftAnalysisForGrade(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertGradeCtx(ctx);
  const { studentId, tenantId, studentGrade, targetGrade } = ctx;

  // 설계 모드 판별
  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  const hasNeis = gradeResolved?.hasAnyNeis ?? false;

  if (hasNeis) {
    return "분석 모드 학년 — 가안 분석 스킵 (P1-P3에서 처리)";
  }

  const { analyzeSetekWithHighlight } = await import("../llm/actions/analyzeWithHighlight");
  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  const { supabase } = ctx;
  let analyzed = 0;

  // L3: competencyGrades 수집 (P8 끝에서 집계 + 저장)
  const allCompetencyGrades: Array<{ item: string; grade: string; reasoning?: string; rubricScores?: { questionIndex: number; grade: string; reasoning: string }[] }> = [];
  // Phase 1: 태그를 메모리에 수집 → RPC로 atomic 교체
  const allCollectedTags: Array<{ record_type: string; record_id: string; competency_item: string; evaluation: string; evidence_summary: string }> = [];

  // 해당 학년 레코드 ID 수집 → 해당 레코드의 draft_analysis 태그만 삭제
  const targetRecordIds: string[] = [];

  const analyzeOpts = { analyzeSetekWithHighlight, supabase, studentId, tenantId, targetGrade, targetSchoolYear };

  // ─── 세특 가안 분석 ──

  const { data: setekRecords } = await supabase
    .from("student_record_seteks")
    .select("id, subject_id, confirmed_content, content, ai_draft_content, grade")
    .eq("student_id", studentId)
    .eq("school_year", targetSchoolYear);

  if (setekRecords) {
    for (const r of setekRecords as Array<{ id: string }>) targetRecordIds.push(r.id);
    // 과목 이름 조회 (헬퍼 사용)
    const subjectIds = [...new Set((setekRecords as Array<{ subject_id: string }>).map((r) => r.subject_id))];
    const subjectNameMap = await fetchSubjectNames(supabase, subjectIds);

    const setekResult = await analyzeAndCollectTags(
      setekRecords as Array<{ id: string; subject_id: string; confirmed_content: string | null; content: string | null; ai_draft_content: string | null; grade: number }>,
      { ...analyzeOpts, recordType: "setek", subjectNameMap },
    );
    allCollectedTags.push(...setekResult.collectedTags);
    allCompetencyGrades.push(...setekResult.competencyGrades);
  }

  // ─── 창체 가안 분석 ──

  const { data: changcheRecords } = await supabase
    .from("student_record_changche")
    .select("id, activity_type, confirmed_content, content, ai_draft_content, grade")
    .eq("student_id", studentId)
    .eq("school_year", targetSchoolYear);

  if (changcheRecords) {
    for (const r of changcheRecords as Array<{ id: string }>) targetRecordIds.push(r.id);
    const changcheResult = await analyzeAndCollectTags(
      changcheRecords as Array<{ id: string; confirmed_content: string | null; content: string | null; ai_draft_content: string | null; grade: number }>,
      { ...analyzeOpts, recordType: "changche" },
    );
    allCollectedTags.push(...changcheResult.collectedTags);
    allCompetencyGrades.push(...changcheResult.competencyGrades);
  }

  // ─── 행특 가안 분석 ──

  const { data: haengteukRecord } = await supabase
    .from("student_record_haengteuk")
    .select("id, confirmed_content, content, ai_draft_content, grade")
    .eq("student_id", studentId)
    .eq("school_year", targetSchoolYear)
    .maybeSingle();

  if (haengteukRecord) {
    targetRecordIds.push(haengteukRecord.id);
    const haengteukResult = await analyzeAndCollectTags(
      [haengteukRecord as { id: string; confirmed_content: string | null; content: string | null; ai_draft_content: string | null; grade: number }],
      { ...analyzeOpts, recordType: "haengteuk" },
    );
    allCollectedTags.push(...haengteukResult.collectedTags);
    allCompetencyGrades.push(...haengteukResult.competencyGrades);
  }

  // Atomic 태그 교체: 기존 draft_analysis 삭제 + 새 태그 삽입을 단일 트랜잭션으로
  if (targetRecordIds.length > 0 || allCollectedTags.length > 0) {
    const { error: rpcError } = await supabase.rpc("replace_draft_analysis_tags", {
      p_student_id: studentId,
      p_tenant_id: tenantId,
      p_record_ids: targetRecordIds,
      p_new_tags: JSON.stringify(allCollectedTags),
    });
    if (rpcError) {
      logActionError(LOG_CTX, rpcError, { phase: "draft_analysis_atomic_replace" });
    } else {
      analyzed = allCollectedTags.length;
    }
  }

  // ─── competency_scores 집계 + 저장 (source=ai_projected) ──

  let competencyScoresSaved = 0;
  if (allCompetencyGrades.length > 0) {
    try {
      const { aggregateCompetencyGrades } = await import("../rubric-matcher");
      const competencyRepo = await import("../repository/competency-repository");
      const aggregated = aggregateCompetencyGrades(allCompetencyGrades);

      for (const ag of aggregated) {
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
          notes: `[AI설계] ${ag.recordCount}건 ${ag.method === "rubric" ? "루브릭 기반" : "레코드"} 종합 (${targetGrade}학년)`,
          rubric_scores: (await import("../types")).toDbJson(ag.rubricScores),
          source: "ai_projected",
          status: "suggested",
        } as import("../types").CompetencyScoreInsert);
        competencyScoresSaved++;
      }
    } catch (err) {
      logActionError(LOG_CTX, err, { phase: "draft_analysis_competency_scores" });
    }
  }

  // ─── ctx.analysisContext에 P8 약점 축적 (Synthesis 참조용) ──
  if (allCompetencyGrades.length > 0) {
    const WEAK_GRADES = new Set(["B-", "C"]);
    const weakItems = allCompetencyGrades
      .filter((cg) => WEAK_GRADES.has(cg.grade))
      .map((cg) => ({
        item: cg.item,
        grade: cg.grade,
        reasoning: cg.reasoning ?? null,
        rubricScores: cg.rubricScores,
      }));

    if (weakItems.length > 0) {
      if (!ctx.analysisContext) ctx.analysisContext = {};
      if (!ctx.analysisContext[targetGrade]) {
        ctx.analysisContext[targetGrade] = { grade: targetGrade, qualityIssues: [], weakCompetencies: [] };
      }
      ctx.analysisContext[targetGrade].weakCompetencies.push(...weakItems);
    }
  }

  // ─── projected 엣지 생성 (draft_analysis 태그 기반) ──

  let projectedEdgeCount = 0;
  if (analyzed > 0) {
    try {
      const { buildConnectionGraph } = await import("../cross-reference");
      const { fetchCrossRefData } = await import("../actions/cross-ref-data-builder");
      const edgeRepo = await import("../repository/edge-repository");

      // draft_analysis 태그만 조회
      const competencyRepo = await import("../repository/competency-repository");
      const draftTags = await competencyRepo.findActivityTags(studentId, tenantId, { tagContext: "draft_analysis" });

      if (draftTags.length > 0) {
        const crd = await fetchCrossRefData(studentId, tenantId);
        const graph = buildConnectionGraph({
          allTags: draftTags,
          storylineLinks: crd.storylineLinks,
          readingLinks: crd.readingLinks,
          recordLabelMap: new Map(Object.entries(crd.recordLabelMap)),
          readingLabelMap: new Map(Object.entries(crd.readingLabelMap)),
          recordContentMap: crd.recordContentMap
            ? new Map(Object.entries(crd.recordContentMap))
            : undefined,
        });

        projectedEdgeCount = await edgeRepo.replaceEdges(
          studentId, tenantId, ctx.pipelineId, graph, "projected",
        );
      }
    } catch (err) {
      logActionError(LOG_CTX, err, { phase: "draft_analysis_projected_edges" });
    }
  }

  if (analyzed === 0 && competencyScoresSaved === 0) {
    return "설계 모드 — 가안 분석 대상 없음 (가안 미생성 또는 내용 부족)";
  }

  const parts = [`${analyzed}건 태그`, `${competencyScoresSaved}건 역량점수`];
  if (projectedEdgeCount > 0) parts.push(`${projectedEdgeCount}건 예상엣지`);
  return `설계 모드 가안 분석 완료: ${parts.join(" + ")} (source=ai_projected)`;
}
