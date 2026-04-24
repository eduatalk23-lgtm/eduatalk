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
import { touchPipelineHeartbeat, type TaskRunnerOutput } from "./pipeline-executor";
import { logActionError } from "@/lib/logging/actionLogger";
import { resolveEffectiveContent } from "./pipeline-data-resolver";
import { fetchSubjectNames } from "./pipeline-task-runners-draft-generation";
import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const LOG_CTX = { domain: "record-analysis", action: "draftAnalysis" };

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

  const { analyzeSetekWithHighlight } = await import("@/lib/domains/record-analysis/llm/actions/analyzeWithHighlight");
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
      // jsonb 파라미터는 배열 그대로 전달 — JSON.stringify 시 RPC 내부 jsonb_array_length()에서 22023 에러
      p_new_tags: allCollectedTags,
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
      const { aggregateCompetencyGrades } = await import("@/lib/domains/student-record/rubric-matcher");
      const competencyRepo = await import("@/lib/domains/student-record/repository/competency-repository");
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
          rubric_scores: (await import("@/lib/domains/student-record/types")).toDbJson(ag.rubricScores),
          source: "ai_projected",
          status: "suggested",
        } as import("@/lib/domains/student-record/types").CompetencyScoreInsert);
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
      // α 후속 5 (2026-04-24): dual write — belief 와 동일 객체 참조 동기화.
      ctx.belief.analysisContext = ctx.analysisContext;
    }
  }

  // ─── projected 엣지 생성 (draft_analysis 태그 기반) ──

  let projectedEdgeCount = 0;
  if (analyzed > 0) {
    try {
      const { buildConnectionGraph } = await import("@/lib/domains/student-record/cross-reference");
      const { fetchCrossRefData } = await import("@/lib/domains/student-record/actions/cross-ref-data-builder");
      const edgeRepo = await import("@/lib/domains/student-record/repository/edge-repository");

      // draft_analysis 태그만 조회
      const competencyRepo = await import("@/lib/domains/student-record/repository/competency-repository");
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

// ============================================
// P8 청크 버전 (트랙 A, 2026-04-14)
//
// 단일 route 280s 한도 초과 문제 해결.
// 기존 runDraftAnalysisForGrade 는 세특+창체+행특 18건을 순차 분석 → 540s (dev GPT-4o-mini).
// 청크 버전: 레코드 K개씩 처리 → hasMore=false 까지 클라이언트 loop.
//
// 커서 전략: content_quality 에 source='ai_projected' 있는 record_id 는 분석 완료로 간주.
// 즉 "이 학년에 가안 분석이 남은 레코드 = 가안이 있지만 ai_projected quality 미저장인 레코드".
//
// 누적 state: competencyGrades 는 per-record LLM 응답이라 최종 집계 필요.
//   ctx.results["draft_analysis_accumulated_grades"] 에 청크마다 append, 마지막 청크에서 aggregate.
//
// atomic 태그 교체: 기존 RPC replace_draft_analysis_tags 는 p_record_ids 범위로 delete+insert.
//   청크의 record_ids 만 넘기면 per-chunk atomic 유지 + 다른 청크는 unaffected.
// ============================================

type UnifiedRec = {
  id: string;
  subject_id?: string;
  confirmed_content?: string | null;
  content?: string | null;
  ai_draft_content?: string | null;
  imported_content?: string | null;
  grade?: number;
  recordType: "setek" | "changche" | "haengteuk";
};

export async function runDraftAnalysisChunkForGrade(
  ctx: PipelineContext,
  chunkSize: number,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number }> {
  assertGradeCtx(ctx);
  const { studentId, tenantId, studentGrade, targetGrade, supabase } = ctx;

  // 설계 모드 판별 (기존 runDraftAnalysisForGrade 와 동일)
  const gradeResolved = ctx.resolvedRecords?.[targetGrade];
  const hasNeis = gradeResolved?.hasAnyNeis ?? false;
  if (hasNeis) {
    return {
      preview: "분석 모드 학년 — 가안 분석 스킵 (P1-P3에서 처리)",
      hasMore: false,
      totalUncached: 0,
      chunkProcessed: 0,
    };
  }

  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  // 이미 분석 완료된 record_id 집합 (커서)
  const { data: analyzedRows } = await supabase
    .from("student_record_content_quality")
    .select("record_id")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", targetSchoolYear)
    .eq("source", "ai_projected");
  const analyzedSet = new Set(((analyzedRows ?? []) as Array<{ record_id: string }>).map((r) => r.record_id));

  // 학년 대상 레코드 전량 조회 + 미처리만 필터
  const [setekRes, changcheRes, haengteukRes] = await Promise.all([
    supabase
      .from("student_record_seteks")
      .select("id, subject_id, confirmed_content, content, ai_draft_content, imported_content, grade")
      .eq("student_id", studentId)
      .eq("school_year", targetSchoolYear),
    supabase
      .from("student_record_changche")
      .select("id, activity_type, confirmed_content, content, ai_draft_content, imported_content, grade")
      .eq("student_id", studentId)
      .eq("school_year", targetSchoolYear),
    supabase
      .from("student_record_haengteuk")
      .select("id, confirmed_content, content, ai_draft_content, imported_content, grade")
      .eq("student_id", studentId)
      .eq("school_year", targetSchoolYear),
  ]);

  // 분석 가능한 레코드 = resolveEffectiveContent 가 20자 이상 반환하는 것만.
  //   content 전부 비어있는 레코드는 pending 에서 아예 제외 → 무한 루프 방지.
  //   (draft_generation 이 중간에 실패/미실행한 경우 content 가 비어 있을 수 있음)
  const pending: UnifiedRec[] = [];
  const hasAnalyzableContent = (r: UnifiedRec): boolean => {
    const { text } = resolveEffectiveContent(r);
    return !!text && text.length >= 20;
  };
  for (const r of (setekRes.data ?? []) as UnifiedRec[]) {
    if (!analyzedSet.has(r.id) && hasAnalyzableContent(r)) pending.push({ ...r, recordType: "setek" });
  }
  for (const r of (changcheRes.data ?? []) as UnifiedRec[]) {
    if (!analyzedSet.has(r.id) && hasAnalyzableContent(r)) pending.push({ ...r, recordType: "changche" });
  }
  for (const r of (haengteukRes.data ?? []) as UnifiedRec[]) {
    if (!analyzedSet.has(r.id) && hasAnalyzableContent(r)) pending.push({ ...r, recordType: "haengteuk" });
  }

  const totalUncached = pending.length;

  // 처리할 게 없으면 즉시 finalize (이미 전부 완료된 상태)
  if (totalUncached === 0) {
    return finalizeDraftAnalysisChunked(ctx, targetGrade, targetSchoolYear);
  }

  const thisChunk = pending.slice(0, chunkSize);
  const hasMore = totalUncached > chunkSize;

  const { analyzeSetekWithHighlight } = await import("@/lib/domains/record-analysis/llm/actions/analyzeWithHighlight");
  const subjectIds = [...new Set(thisChunk.filter((r) => r.subject_id).map((r) => r.subject_id as string))];
  const subjectNameMap = subjectIds.length > 0 ? await fetchSubjectNames(supabase, subjectIds) : new Map<string, string>();

  const chunkCollectedTags: Array<{ record_type: string; record_id: string; competency_item: string; evaluation: string; evidence_summary: string }> = [];
  const chunkCompetencyGrades: Array<{ item: string; grade: string; reasoning?: string; rubricScores?: { questionIndex: number; grade: string; reasoning: string }[] }> = [];
  const chunkRecordIds: string[] = [];

  for (const rec of thisChunk) {
    const { text: content } = resolveEffectiveContent(rec);
    if (!content || content.length < 20) continue;

    // 청크 내부 LLM 호출 사이 heartbeat — 순차 루프 총시간이 5분을 넘어도 좀비 판정되지 않도록.
    // trigger `trg_analysis_pipelines_updated_at` 가 자동 갱신하므로 추가 컬럼 write 불필요.
    await touchPipelineHeartbeat(supabase as SupabaseAdminClient, ctx.pipelineId);

    try {
      const result = await analyzeSetekWithHighlight({
        recordType: rec.recordType,
        content,
        subjectName: rec.subject_id ? subjectNameMap.get(rec.subject_id) : undefined,
        grade: rec.grade ?? targetGrade,
      });

      if (result.success && result.data.sections) {
        for (const section of result.data.sections) {
          for (const tag of section.tags) {
            chunkCollectedTags.push({
              record_type: rec.recordType,
              record_id: rec.id,
              competency_item: tag.competencyItem,
              evaluation: tag.evaluation,
              evidence_summary: `[가안분석] ${tag.reasoning}\n근거: "${tag.highlight}"`,
            });
          }
        }
        if (result.data.contentQuality) {
          await saveContentQuality(
            supabase,
            tenantId,
            studentId,
            targetSchoolYear,
            rec.recordType,
            rec.id,
            result.data.contentQuality,
          );
        }
        if (result.data.competencyGrades?.length) {
          chunkCompetencyGrades.push(...result.data.competencyGrades);
        }
        chunkRecordIds.push(rec.id);
      }
    } catch (err) {
      logActionError(LOG_CTX, err, { recordId: rec.id, phase: `draft_analysis_chunk_${rec.recordType}` });
    }
  }

  // 청크 범위 atomic 태그 교체 (이 청크의 record_ids 만)
  if (chunkRecordIds.length > 0 || chunkCollectedTags.length > 0) {
    const { error: rpcError } = await supabase.rpc("replace_draft_analysis_tags", {
      p_student_id: studentId,
      p_tenant_id: tenantId,
      p_record_ids: chunkRecordIds,
      p_new_tags: chunkCollectedTags,
    });
    if (rpcError) {
      logActionError(LOG_CTX, rpcError, { phase: "draft_analysis_chunk_atomic_replace" });
    }
  }

  // competencyGrades 를 pipeline.results 에 누적 (updatePipelineState 에서 영속화됨)
  ctx.results ??= {};
  const existingGrades = (ctx.results["draft_analysis_accumulated_grades"] as Array<{ item: string; grade: string; reasoning?: string; rubricScores?: unknown }>) ?? [];
  ctx.results["draft_analysis_accumulated_grades"] = [...existingGrades, ...chunkCompetencyGrades];

  // B7 완결성 가드: 청크가 레코드를 하나도 처리하지 못했다면(전부 LLM 실패 등) throw.
  //   이전엔 finalize 로 조기 탈출해 task=completed 로 보고됐지만, 실제 데이터는 0건이라
  //   partial 완료로 보였다. 재실행 cascade 를 통해 사용자가 다시 시도하도록 failed 처리.
  if (chunkRecordIds.length === 0 && thisChunk.length > 0) {
    throw new Error(
      `draft_analysis 청크 진행 정지: 0/${thisChunk.length}건 처리, 잔여 ${totalUncached}건 (재실행 필요)`,
    );
  }

  if (hasMore) {
    return {
      preview: `${targetGrade}학년 가안 분석 진행: ${chunkRecordIds.length}건 처리, 잔여 ${totalUncached - chunkRecordIds.length}건`,
      hasMore: true,
      totalUncached,
      chunkProcessed: chunkRecordIds.length,
    };
  }

  // 마지막 청크 — 집계 + competency_scores 저장 + projected edges
  return finalizeDraftAnalysisChunked(ctx, targetGrade, targetSchoolYear);
}

async function finalizeDraftAnalysisChunked(
  ctx: PipelineContext,
  targetGrade: number,
  targetSchoolYear: number,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number }> {
  assertGradeCtx(ctx);
  const { studentId, tenantId, supabase } = ctx;

  // finalize 진입 시 heartbeat — 이 경로는 LLM 호출은 없지만 upsertCompetencyScore 루프와
  // fetchCrossRefData + replaceEdges 가 수 분 걸릴 수 있다. 중간에 pipelines 테이블 write 가
  // 전혀 없으면 좀비 판정됨.
  await touchPipelineHeartbeat(supabase as SupabaseAdminClient, ctx.pipelineId);

  const allCompetencyGrades = (ctx.results?.["draft_analysis_accumulated_grades"] as Array<{ item: string; grade: string; reasoning?: string; rubricScores?: { questionIndex: number; grade: string; reasoning: string }[] }>) ?? [];

  let competencyScoresSaved = 0;
  if (allCompetencyGrades.length > 0) {
    try {
      const { aggregateCompetencyGrades } = await import("@/lib/domains/student-record/rubric-matcher");
      const competencyRepo = await import("@/lib/domains/student-record/repository/competency-repository");
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
          rubric_scores: (await import("@/lib/domains/student-record/types")).toDbJson(ag.rubricScores),
          source: "ai_projected",
          status: "suggested",
        } as import("@/lib/domains/student-record/types").CompetencyScoreInsert);
        competencyScoresSaved++;
      }
    } catch (err) {
      logActionError(LOG_CTX, err, { phase: "draft_analysis_competency_scores" });
    }
  }

  // ctx.analysisContext 에 P8 약점 축적 (Synthesis 참조용)
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
      // α 후속 5 (2026-04-24): dual write — belief 와 동일 객체 참조 동기화.
      ctx.belief.analysisContext = ctx.analysisContext;
    }
  }

  // competency_scores 루프 종료 직후 heartbeat — 다음 단계(cross-ref + edge 재계산)가 무거움.
  await touchPipelineHeartbeat(supabase as SupabaseAdminClient, ctx.pipelineId);

  // projected 엣지 생성 (draft_analysis 태그 기반)
  let projectedEdgeCount = 0;
  try {
    const { buildConnectionGraph } = await import("@/lib/domains/student-record/cross-reference");
    const { fetchCrossRefData } = await import("@/lib/domains/student-record/actions/cross-ref-data-builder");
    const edgeRepo = await import("@/lib/domains/student-record/repository/edge-repository");
    const competencyRepo = await import("@/lib/domains/student-record/repository/competency-repository");
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

  // 누적 state 정리 (완료했으니 제거)
  if (ctx.results) {
    delete ctx.results["draft_analysis_accumulated_grades"];
  }

  const parts: string[] = [];
  if (competencyScoresSaved > 0) parts.push(`${competencyScoresSaved}건 역량점수`);
  if (projectedEdgeCount > 0) parts.push(`${projectedEdgeCount}건 예상엣지`);

  return {
    preview: parts.length > 0
      ? `${targetGrade}학년 가안 분석 완료: ${parts.join(" + ")} (source=ai_projected)`
      : `${targetGrade}학년 가안 분석 완료 — 저장 대상 없음`,
    hasMore: false,
    totalUncached: 0,
    chunkProcessed: 0,
  };
}
