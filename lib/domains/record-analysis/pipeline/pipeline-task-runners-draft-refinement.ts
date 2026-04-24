// ============================================
// P9: draft_refinement — IMPROVE 논문 component-at-a-time iteration
//
// Phase 5 Sprint 1 (2026-04-19).
// P8 에서 overall_score<70 + retry_count=0 인 레코드를 1회 재생성+재분석한다.
//
// Feature flag: process.env.ENABLE_DRAFT_REFINEMENT === "true" (default off)
// 설계 모드(design) 학년 전용. 분석 모드 skip.
//
// rollback 전략:
//   재생성 전에 4종(ai_draft_content + content_quality + activity_tags + competency_scores) 스냅샷.
//   재분석 후 score 하락이면 4종 모두 원복 + retry_count=1 (재시도 방지).
// ============================================

import { assertGradeCtx, type PipelineContext } from "./pipeline-types";
import { touchPipelineHeartbeat, type TaskRunnerOutput } from "./pipeline-executor";
import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import { generateTextWithRateLimit } from "../llm/ai-client";
import { withRetry } from "../llm/retry";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import {
  SETEK_DRAFT_SYSTEM_PROMPT,
  CHANGCHE_DRAFT_SYSTEM_PROMPT,
  HAENGTEUK_DRAFT_SYSTEM_PROMPT,
} from "../llm/prompts/draft-system-prompts";
import {
  buildSetekRefinementUserPrompt,
  buildChangcheRefinementUserPrompt,
  buildHaengteukRefinementUserPrompt,
  selectRefinementVariant,
  type RefinementVariant,
} from "../llm/prompts/draft-refinement-prompts";
import { PIPELINE_THRESHOLDS } from "@/lib/domains/student-record/constants";

const LOG_CTX = { domain: "record-analysis", action: "draftRefinement" };
const REFINEMENT_THRESHOLD = 70;
const DEFAULT_CHUNK_SIZE = 4;

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

type RecordType = "setek" | "changche" | "haengteuk";

interface QualityRow {
  record_id: string;
  record_type: RecordType;
  overall_score: number;
  specificity: number;
  coherence: number;
  depth: number;
  grammar: number;
  scientific_validity: number | null;
  issues: string[];
  feedback: string;
  retry_count: number;
}

interface ActivityTagRow {
  record_type: string;
  record_id: string;
  competency_item: string;
  evaluation: string;
  evidence_summary: string;
  tag_context?: string;
}

interface CompetencyScoreRow {
  competency_area: string;
  competency_item: string;
  grade_value: string;
  narrative: string | null;
  notes: string | null;
  rubric_scores: unknown;
  source: string;
  status: string;
}

interface RollbackSnapshot {
  recordId: string;
  recordType: RecordType;
  originalDraft: string;
  originalQuality: QualityRow;
  originalTags: ActivityTagRow[];
  originalCompetencyScores: CompetencyScoreRow[];
}

// ─── 단일 레코드 원본 draft 조회 ──────────────────────────────────────────

async function fetchCurrentDraft(
  supabase: PipelineContext["supabase"],
  recordType: RecordType,
  recordId: string,
): Promise<string | null> {
  const tableMap: Record<RecordType, string> = {
    setek: "student_record_seteks",
    changche: "student_record_changche",
    haengteuk: "student_record_haengteuk",
  };
  const { data } = await supabase
    .from(tableMap[recordType])
    .select("ai_draft_content")
    .eq("id", recordId)
    .maybeSingle();
  return (data as { ai_draft_content?: string | null } | null)?.ai_draft_content ?? null;
}

// ─── early-skip 마킹 (retry_count=1 업데이트만 수행) ───────────────────────
//
// 목적: no-draft / snapshot 실패 / LLM null / DB update 실패 등 재분석 이전에
//       발생한 skip 경로에서도 retry_count=1 로 마킹하여 다음 청크 재조회 loop 차단.
//       score·issues·feedback 은 그대로 유지 (원본 그대로 재사용).

async function markRecordAsRetried(
  supabase: PipelineContext["supabase"],
  studentId: string,
  tenantId: string,
  recordId: string,
): Promise<void> {
  const { error } = await supabase
    .from("student_record_content_quality")
    .update({ retry_count: 1 })
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .eq("record_id", recordId)
    .eq("source", "ai_projected");
  if (error) logActionError(LOG_CTX, error, { recordId, phase: "mark_skip_retried" });
}

// ─── 스냅샷 수집 ──────────────────────────────────────────────────────────

async function collectSnapshot(
  supabase: PipelineContext["supabase"],
  studentId: string,
  tenantId: string,
  targetSchoolYear: number,
  quality: QualityRow,
  originalDraft: string,
): Promise<RollbackSnapshot> {
  // activity_tags (tag_context=draft_analysis)
  const { data: tags } = await supabase
    .from("student_record_activity_tags")
    .select("record_type, record_id, competency_item, evaluation, evidence_summary, tag_context")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("record_id", quality.record_id)
    .eq("tag_context", "draft_analysis");

  // competency_scores (source=ai_projected)
  const { data: scores } = await supabase
    .from("student_record_competency_scores")
    .select("competency_area, competency_item, grade_value, narrative, notes, rubric_scores, source, status")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", targetSchoolYear)
    .eq("source", "ai_projected");

  return {
    recordId: quality.record_id,
    recordType: quality.record_type,
    originalDraft,
    originalQuality: quality,
    originalTags: (tags ?? []) as ActivityTagRow[],
    originalCompetencyScores: (scores ?? []) as CompetencyScoreRow[],
  };
}

// ─── rollback 실행 ────────────────────────────────────────────────────────

async function applyRollback(
  supabase: PipelineContext["supabase"],
  studentId: string,
  tenantId: string,
  targetSchoolYear: number,
  snap: RollbackSnapshot,
  variant: RefinementVariant | null = null,
): Promise<void> {
  const tableMap: Record<RecordType, string> = {
    setek: "student_record_seteks",
    changche: "student_record_changche",
    haengteuk: "student_record_haengteuk",
  };

  // 1. ai_draft_content 원복
  await supabase
    .from(tableMap[snap.recordType])
    .update({ ai_draft_content: snap.originalDraft })
    .eq("id", snap.recordId);

  // 2. content_quality 원복 (retry_count=1 로 재시도 방지, Sprint 3 variant 기록)
  const { error: cqErr } = await supabase
    .from("student_record_content_quality")
    .upsert(
      {
        tenant_id: tenantId,
        student_id: studentId,
        record_type: snap.recordType,
        record_id: snap.recordId,
        school_year: targetSchoolYear,
        specificity: snap.originalQuality.specificity,
        coherence: snap.originalQuality.coherence,
        depth: snap.originalQuality.depth,
        grammar: snap.originalQuality.grammar,
        scientific_validity: snap.originalQuality.scientific_validity,
        overall_score: snap.originalQuality.overall_score,
        issues: snap.originalQuality.issues,
        feedback: snap.originalQuality.feedback,
        source: "ai_projected",
        retry_count: 1,  // 재시도 방지 (score 하락이지만 시도 기록)
        refinement_variant: variant,
      },
      { onConflict: "tenant_id,student_id,record_id,source" },
    );
  if (cqErr) logActionError(LOG_CTX, cqErr, { recordId: snap.recordId, phase: "rollback_quality" });

  // 3. activity_tags 새 값 삭제 + 원본 재삽입
  await supabase
    .from("student_record_activity_tags")
    .delete()
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("record_id", snap.recordId)
    .eq("tag_context", "draft_analysis");

  if (snap.originalTags.length > 0) {
    await supabase
      .from("student_record_activity_tags")
      .insert(
        snap.originalTags.map((t) => ({
          student_id: studentId,
          tenant_id: tenantId,
          record_type: t.record_type,
          record_id: t.record_id,
          competency_item: t.competency_item,
          evaluation: t.evaluation,
          evidence_summary: t.evidence_summary,
          tag_context: "draft_analysis",
        })),
      );
  }

  // 4. competency_scores 원복 (ai_projected 전체를 해당 학년 기준으로 교체)
  //    단, competency_scores 는 여러 레코드의 집계치이므로 해당 student+school_year+ai_projected
  //    전체를 원본 스냅샷으로 교체 (P9 는 한 번에 한 레코드씩 처리하므로 이 접근이 안전)
  await supabase
    .from("student_record_competency_scores")
    .delete()
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", targetSchoolYear)
    .eq("source", "ai_projected");

  if (snap.originalCompetencyScores.length > 0) {
    await supabase
      .from("student_record_competency_scores")
      .insert(
        snap.originalCompetencyScores.map((s) => ({
          student_id: studentId,
          tenant_id: tenantId,
          school_year: targetSchoolYear,
          competency_area: s.competency_area,
          competency_item: s.competency_item,
          grade_value: s.grade_value,
          narrative: s.narrative,
          notes: s.notes,
          rubric_scores: s.rubric_scores,
          source: s.source,
          status: s.status,
        })),
      );
  }
}

// ─── 재생성용 user prompt 빌더 ────────────────────────────────────────────

function buildRefinementUserPromptForRecord(
  recordType: RecordType,
  quality: QualityRow,
  previousDraft: string,
  variant: RefinementVariant,
  subjectName?: string,
  activityLabel?: string,
  charLimit?: number,
  targetGrade?: number,
): { userPrompt: string; systemPrompt: string } {
  const axisScores = {
    specificity: quality.specificity,
    coherence: quality.coherence,
    depth: quality.depth,
    grammar: quality.grammar,
    scientificValidity: quality.scientific_validity,
  };

  if (recordType === "setek") {
    const originalUserPrompt = [
      `## 과목: ${subjectName ?? "세특"} (${targetGrade ?? 2}학년)`,
      `\n재생성 요청: 이전 가안의 품질을 개선해주세요.`,
    ].join("\n");
    const userPrompt = buildSetekRefinementUserPrompt({
      originalUserPrompt,
      previousDraft,
      issues: quality.issues,
      feedback: quality.feedback,
      axisScores,
      variant,
    });
    return { userPrompt, systemPrompt: SETEK_DRAFT_SYSTEM_PROMPT };
  }

  if (recordType === "changche") {
    const label = activityLabel ?? "창체";
    const limit = charLimit ?? 500;
    const originalUserPrompt = [
      `## 활동유형: ${label} (${targetGrade ?? 2}학년)`,
      `${limit}자 이내의 ${label} 특기사항 초안을 작성해주세요.`,
    ].join("\n");
    const userPrompt = buildChangcheRefinementUserPrompt({
      originalUserPrompt,
      previousDraft,
      issues: quality.issues,
      feedback: quality.feedback,
      axisScores,
      variant,
    });
    return { userPrompt, systemPrompt: CHANGCHE_DRAFT_SYSTEM_PROMPT };
  }

  // haengteuk
  const limit = charLimit ?? 500;
  const originalUserPrompt = [
    `## 행동특성 및 종합의견 (${targetGrade ?? 2}학년)`,
    `${limit}자 이내의 행특 초안을 작성해주세요.`,
  ].join("\n");
  const userPrompt = buildHaengteukRefinementUserPrompt({
    originalUserPrompt,
    previousDraft,
    issues: quality.issues,
    feedback: quality.feedback,
    axisScores,
    variant,
  });
  return { userPrompt, systemPrompt: HAENGTEUK_DRAFT_SYSTEM_PROMPT };
}

// ============================================
// 메인 청크 runner
// ============================================

export interface VariantBreakdownEntry {
  refined: number;
  rolledBack: number;
  skipped: number;
  avgScoreDelta: number;
}

export type VariantBreakdown = Record<RefinementVariant, VariantBreakdownEntry>;

function buildVariantBreakdown(stats?: Record<RefinementVariant, VariantStat>): VariantBreakdown {
  const src = stats ?? emptyVariantStats();
  const entries = Object.entries(src) as Array<[RefinementVariant, VariantStat]>;
  return entries.reduce<VariantBreakdown>((out, [variant, s]) => {
    out[variant] = {
      refined: s.refined,
      rolledBack: s.rolledBack,
      skipped: s.skipped,
      avgScoreDelta: s.refined > 0 ? s.totalScoreDelta / s.refined : 0,
    };
    return out;
  }, {} as VariantBreakdown);
}

export async function runDraftRefinementChunkForGrade(
  ctx: PipelineContext,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number; result: { enabled: boolean; processed: number; refined: number; rolledBack: number; skipped: number; avgScoreDelta: number; variantBreakdown?: VariantBreakdown } }> {
  assertGradeCtx(ctx);

  // ─── Feature flag 체크 ───────────────────────────────────────────────────
  if (process.env.ENABLE_DRAFT_REFINEMENT !== "true") {
    return {
      preview: "disabled",
      hasMore: false,
      totalUncached: 0,
      chunkProcessed: 0,
      result: { enabled: false, processed: 0, refined: 0, rolledBack: 0, skipped: 0, avgScoreDelta: 0 },
    };
  }

  const { studentId, tenantId, studentGrade, targetGrade, supabase } = ctx;

  // ─── 설계 모드 판별 ──────────────────────────────────────────────────────
  const gradeResolved = ctx.belief.resolvedRecords?.[targetGrade];
  const hasNeis = gradeResolved?.hasAnyNeis ?? false;
  if (hasNeis) {
    return {
      preview: "분석 모드 학년 — 가안 개선 스킵",
      hasMore: false,
      totalUncached: 0,
      chunkProcessed: 0,
      result: { enabled: true, processed: 0, refined: 0, rolledBack: 0, skipped: 0, avgScoreDelta: 0 },
    };
  }

  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  // ─── 대상 레코드 조회: score<70 + retry_count=0 ────────────────────────
  const { data: qualityRows } = await supabase
    .from("student_record_content_quality")
    .select("record_id, record_type, overall_score, specificity, coherence, depth, grammar, scientific_validity, issues, feedback, retry_count")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", targetSchoolYear)
    .eq("source", "ai_projected")
    .lt("overall_score", REFINEMENT_THRESHOLD)
    .eq("retry_count", 0);

  const pending = (qualityRows ?? []) as QualityRow[];
  const totalUncached = pending.length;

  if (totalUncached === 0) {
    // 기존 ctx.results 에 누적된 값 읽기 (청크 간 누적)
    const acc = getAccumulated(ctx);
    return {
      preview: `${targetGrade}학년 가안 개선 완료 — 대상 없음`,
      hasMore: false,
      totalUncached: 0,
      chunkProcessed: 0,
      result: { enabled: true, ...acc },
    };
  }

  const { analyzeSetekWithHighlight } = await import(
    "@/lib/domains/record-analysis/llm/actions/analyzeWithHighlight"
  );

  const thisChunk = pending.slice(0, chunkSize);
  const hasMore = totalUncached > chunkSize;

  // 보조 데이터 (과목명, 창체 타입 레이블, 글자수 제한)
  const setekIds = thisChunk.filter((r) => r.record_type === "setek").map((r) => r.record_id);
  const changcheIds = thisChunk.filter((r) => r.record_type === "changche").map((r) => r.record_id);
  const haengteukIds = thisChunk.filter((r) => r.record_type === "haengteuk").map((r) => r.record_id);

  // 세특 과목명 조회
  const subjectNameMap = new Map<string, string>();
  if (setekIds.length > 0) {
    const { data: setekRows } = await supabase
      .from("student_record_seteks")
      .select("id, subjects:subject_id(name)")
      .in("id", setekIds);
    for (const r of (setekRows ?? []) as Array<{ id: string; subjects?: { name?: string } | { name?: string }[] | null }>) {
      const name = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
      if (name) subjectNameMap.set(r.id, name);
    }
  }

  // 창체 타입 레이블 조회
  const ACTIVITY_LABELS: Record<string, string> = { autonomy: "자율활동", club: "동아리활동", career: "진로활동" };
  const changcheTypeMap = new Map<string, string>();
  const changcheLimitMap = new Map<string, number>();
  if (changcheIds.length > 0) {
    const { getCharLimit } = await import("@/lib/domains/student-record/constants");
    const { data: changcheRows } = await supabase
      .from("student_record_changche")
      .select("id, activity_type")
      .in("id", changcheIds);
    for (const r of (changcheRows ?? []) as Array<{ id: string; activity_type: string }>) {
      changcheTypeMap.set(r.id, ACTIVITY_LABELS[r.activity_type] ?? r.activity_type);
      changcheLimitMap.set(r.id, getCharLimit(r.activity_type as "autonomy" | "club" | "career", targetSchoolYear));
    }
  }

  // 행특 글자수 제한
  let haengteukLimit: number | undefined;
  if (haengteukIds.length > 0) {
    const { getCharLimit } = await import("@/lib/domains/student-record/constants");
    haengteukLimit = getCharLimit("haengteuk", targetSchoolYear);
  }

  const tableMap: Record<RecordType, string> = {
    setek: "student_record_seteks",
    changche: "student_record_changche",
    haengteuk: "student_record_haengteuk",
  };

  let chunkProcessed = 0;
  const acc = getAccumulated(ctx);

  for (const quality of thisChunk) {
    await touchPipelineHeartbeat(supabase as SupabaseAdminClient, ctx.pipelineId);

    // a. 이전 ai_draft_content 조회
    const previousDraft = await fetchCurrentDraft(supabase, quality.record_type, quality.record_id);
    if (!previousDraft?.trim()) {
      logActionDebug(LOG_CTX, `skip — no draft: ${quality.record_id}`);
      await markRecordAsRetried(supabase, studentId, tenantId, quality.record_id);
      acc.skipped++;
      continue;
    }

    // b. 스냅샷 수집
    let snap: RollbackSnapshot;
    try {
      snap = await collectSnapshot(supabase, studentId, tenantId, targetSchoolYear, quality, previousDraft);
    } catch (err) {
      logActionError(LOG_CTX, err, { recordId: quality.record_id, phase: "snapshot" });
      await markRecordAsRetried(supabase, studentId, tenantId, quality.record_id);
      acc.skipped++;
      continue;
    }

    // c. 재생성 프롬프트 빌드 (Sprint 3: variant 결정적 선택)
    const variant = selectRefinementVariant(quality.record_id);
    const subjectName = subjectNameMap.get(quality.record_id);
    const activityLabel = changcheTypeMap.get(quality.record_id);
    const charLimit = quality.record_type === "changche"
      ? changcheLimitMap.get(quality.record_id)
      : quality.record_type === "haengteuk"
      ? haengteukLimit
      : undefined;

    const { userPrompt, systemPrompt } = buildRefinementUserPromptForRecord(
      quality.record_type,
      quality,
      previousDraft,
      variant,
      subjectName,
      activityLabel,
      charLimit,
      targetGrade,
    );

    // d. LLM 재생성 (withRetry + fail-closed)
    let newDraft: string | null = null;
    try {
      const result = await withRetry(
        () => generateTextWithRateLimit({
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          modelTier: "standard",
          temperature: 0.5,
          maxTokens: PIPELINE_THRESHOLDS.DEFAULT_DRAFT_MAX_TOKENS,
        }),
        { label: `draftRefinement_${quality.record_type}` },
      );
      newDraft = result.content?.trim() ?? null;
    } catch (err) {
      logActionError(LOG_CTX, err, { recordId: quality.record_id, phase: "refinement_llm" });
    }

    if (!newDraft) {
      logActionDebug(LOG_CTX, `LLM 에러 또는 빈 응답 — skip: ${quality.record_id}`);
      await markRecordAsRetried(supabase, studentId, tenantId, quality.record_id);
      acc.skipped++;
      continue;
    }

    // e. DB 업데이트: 새 draft 저장
    const { error: updateErr } = await supabase
      .from(tableMap[quality.record_type])
      .update({
        ai_draft_content: newDraft,
        ai_draft_at: new Date().toISOString(),
        ai_draft_status: "done",
      })
      .eq("id", quality.record_id);

    if (updateErr) {
      logActionError(LOG_CTX, updateErr, { recordId: quality.record_id, phase: "draft_update" });
      await markRecordAsRetried(supabase, studentId, tenantId, quality.record_id);
      acc.skipped++;
      continue;
    }

    // f. 재분석 (analyzeSetekWithHighlight)
    let newScore: number | null = null;
    let newQuality: {
      specificity: number;
      coherence: number;
      depth: number;
      grammar: number;
      scientificValidity?: number | null;
      overallScore: number;
      issues: string[];
      feedback: string;
    } | null = null;

    try {
      const analysisResult = await analyzeSetekWithHighlight({
        recordType: quality.record_type,
        content: newDraft,
        grade: targetGrade,
      });

      if (analysisResult.success && analysisResult.data.contentQuality) {
        newQuality = analysisResult.data.contentQuality;
        newScore = newQuality.overallScore;

        // 새 태그 수집 (rollback 시 제거 필요)
        const newTags: Array<{ competency_item: string; evaluation: string; evidence_summary: string }> = [];
        for (const section of analysisResult.data.sections ?? []) {
          for (const tag of section.tags ?? []) {
            newTags.push({
              competency_item: tag.competencyItem,
              evaluation: tag.evaluation,
              evidence_summary: `[재생성분석] ${tag.reasoning}\n근거: "${tag.highlight}"`,
            });
          }
        }

        // g. 분기: score 상승 vs 하락
        if (newScore >= quality.overall_score) {
          // 승격: content_quality 업데이트 (retry_count=1, Sprint 3 variant 기록)
          const { error: cqErr } = await supabase
            .from("student_record_content_quality")
            .upsert(
              {
                tenant_id: tenantId,
                student_id: studentId,
                record_type: quality.record_type,
                record_id: quality.record_id,
                school_year: targetSchoolYear,
                specificity: newQuality.specificity,
                coherence: newQuality.coherence,
                depth: newQuality.depth,
                grammar: newQuality.grammar,
                scientific_validity: newQuality.scientificValidity ?? null,
                overall_score: newQuality.overallScore,
                issues: newQuality.issues,
                feedback: newQuality.feedback,
                source: "ai_projected",
                retry_count: 1,
                refinement_variant: variant,
              },
              { onConflict: "tenant_id,student_id,record_id,source" },
            );
          if (cqErr) logActionError(LOG_CTX, cqErr, { recordId: quality.record_id, phase: "quality_update" });

          // 태그 교체: 기존 draft_analysis 태그 삭제 + 새 태그 삽입
          if (newTags.length > 0) {
            await supabase
              .from("student_record_activity_tags")
              .delete()
              .eq("student_id", studentId)
              .eq("tenant_id", tenantId)
              .eq("record_id", quality.record_id)
              .eq("tag_context", "draft_analysis");

            await supabase
              .from("student_record_activity_tags")
              .insert(
                newTags.map((t) => ({
                  student_id: studentId,
                  tenant_id: tenantId,
                  record_type: quality.record_type,
                  record_id: quality.record_id,
                  competency_item: t.competency_item,
                  evaluation: t.evaluation,
                  evidence_summary: t.evidence_summary,
                  tag_context: "draft_analysis",
                })),
              );
          }

          acc.refined++;
          acc.totalScoreDelta += newScore - quality.overall_score;
          const vStats = acc.variantStats ?? emptyVariantStats();
          vStats[variant].refined++;
          vStats[variant].totalScoreDelta += newScore - quality.overall_score;
          acc.variantStats = vStats;
          logActionDebug(LOG_CTX, `정제 성공[${variant}]: ${quality.record_id} ${quality.overall_score} → ${newScore}`);
        } else {
          // rollback: 4종 원복 (variant 기록 포함)
          await applyRollback(supabase, studentId, tenantId, targetSchoolYear, snap, variant);
          acc.rolledBack++;
          const vStats = acc.variantStats ?? emptyVariantStats();
          vStats[variant].rolledBack++;
          acc.variantStats = vStats;
          logActionDebug(LOG_CTX, `rollback[${variant}]: ${quality.record_id} ${quality.overall_score} ← ${newScore} (하락)`);
        }

        chunkProcessed++;
        acc.processed++;
      } else {
        // 분석 실패 — rollback 후 skip
        await applyRollback(supabase, studentId, tenantId, targetSchoolYear, snap, variant);
        acc.skipped++;
        const vStats = acc.variantStats ?? emptyVariantStats();
        vStats[variant].skipped++;
        acc.variantStats = vStats;
      }
    } catch (err) {
      logActionError(LOG_CTX, err, { recordId: quality.record_id, phase: "reanalysis" });
      // 재분석 LLM 에러 — rollback
      try {
        await applyRollback(supabase, studentId, tenantId, targetSchoolYear, snap, variant);
      } catch (rollbackErr) {
        logActionError(LOG_CTX, rollbackErr, { recordId: quality.record_id, phase: "rollback_on_error" });
      }
      acc.skipped++;
      const vStats = acc.variantStats ?? emptyVariantStats();
      vStats[variant].skipped++;
      acc.variantStats = vStats;
    }
  }

  // ctx 에 누적 상태 저장
  setAccumulated(ctx, acc);

  const avgScoreDelta = acc.refined > 0 ? acc.totalScoreDelta / acc.refined : 0;

  const variantBreakdown = buildVariantBreakdown(acc.variantStats);

  if (hasMore) {
    return {
      preview: `${targetGrade}학년 가안 개선 진행: ${chunkProcessed}건 처리, 잔여 ${totalUncached - chunkSize}건`,
      hasMore: true,
      totalUncached,
      chunkProcessed,
      result: {
        enabled: true,
        processed: acc.processed,
        refined: acc.refined,
        rolledBack: acc.rolledBack,
        skipped: acc.skipped,
        avgScoreDelta,
        variantBreakdown,
      },
    };
  }

  // 마지막 청크 — ctx 누적 상태 정리
  clearAccumulated(ctx);

  return {
    preview: `${targetGrade}학년 가안 개선 완료: ${acc.refined}건 개선, ${acc.rolledBack}건 rollback, ${acc.skipped}건 skip`,
    hasMore: false,
    totalUncached,
    chunkProcessed,
    result: {
      enabled: true,
      processed: acc.processed,
      refined: acc.refined,
      rolledBack: acc.rolledBack,
      skipped: acc.skipped,
      avgScoreDelta,
      variantBreakdown,
    },
  };
}

// ─── ctx 누적 상태 헬퍼 ────────────────────────────────────────────────────

const ACC_KEY = "draft_refinement_accumulated";

interface VariantStat {
  refined: number;
  rolledBack: number;
  skipped: number;
  totalScoreDelta: number;
}

interface AccState {
  processed: number;
  refined: number;
  rolledBack: number;
  skipped: number;
  totalScoreDelta: number;
  variantStats?: Record<RefinementVariant, VariantStat>;
}

function emptyVariantStats(): Record<RefinementVariant, VariantStat> {
  return {
    v1_baseline: { refined: 0, rolledBack: 0, skipped: 0, totalScoreDelta: 0 },
    v2_axis_targeted: { refined: 0, rolledBack: 0, skipped: 0, totalScoreDelta: 0 },
  };
}

function getAccumulated(ctx: PipelineContext): AccState {
  const raw = ctx.results?.[ACC_KEY] as AccState | undefined;
  if (raw) {
    raw.variantStats ??= emptyVariantStats();
    return raw;
  }
  return {
    processed: 0,
    refined: 0,
    rolledBack: 0,
    skipped: 0,
    totalScoreDelta: 0,
    variantStats: emptyVariantStats(),
  };
}

function setAccumulated(ctx: PipelineContext, state: AccState): void {
  ctx.results ??= {};
  ctx.results[ACC_KEY] = state;
}

function clearAccumulated(ctx: PipelineContext): void {
  if (ctx.results) {
    delete ctx.results[ACC_KEY];
  }
}

// ============================================
// 단일 호출 래퍼 (호환성)
// ============================================

export async function runDraftRefinementForGrade(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  const result = await runDraftRefinementChunkForGrade(ctx, 999);
  return result.preview;
}
