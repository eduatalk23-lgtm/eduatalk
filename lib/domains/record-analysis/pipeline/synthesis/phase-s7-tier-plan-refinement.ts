// ============================================
// S7 (Phase 4b Sprint 3): tier_plan refinement — Synthesis → main_exploration 피드백 루프
//
// Synthesis 산출물(진단 약점·전략·로드맵·반복 품질 패턴)을 근거로 활성 main_exploration 의
// tier_plan 을 재평가한다.
//
//   · action=converged            : jaccard ≥ threshold(0.8). 의미 있는 차이 없음 → no-op.
//   · action=refined              : jaccard < threshold. origin='auto_bootstrap_v2' 로 신규 row INSERT.
//   · action=skipped_*            : 컨설턴트 수정본/비-부트스트랩/target_major 미설정/LLM 실패 등.
//
// 재부트스트랩 트리거는 **서버-서버 체이닝 금지** 원칙에 따라 Phase 4a staleness 배너가
// `main_exploration.updated_at > blueprint.completed_at` 을 감지해 사용자 클릭으로 주도.
//
// 의존: ai_diagnosis(weaknesses) + ai_strategy(strategy_content) + roadmap_generation(plan_content)
// ============================================

import { logActionDebug, logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import type { PipelineContext, TaskRunnerOutput } from "../pipeline-types";
import { assertSynthesisCtx } from "../pipeline-types";
import {
  getActiveMainExploration,
  createMainExploration,
  type MainExplorationTierPlan,
} from "@/lib/domains/student-record/repository/main-exploration-repository";
import {
  compareTierPlans,
  DEFAULT_TIER_PLAN_CONVERGENCE_THRESHOLD,
} from "../../blueprint/tier-plan-similarity";
import { extractTierPlanSuggestion } from "../../llm/actions/extractTierPlanSuggestion";
import { MAJOR_TO_TIER1 } from "@/lib/constants/career-classification";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";

const LOG_CTX = { domain: "record-analysis", action: "pipeline.phase-s7" };

const MAX_STRATEGY_HIGHLIGHTS = 5;
const MAX_ROADMAP_HIGHLIGHTS = 5;
const MAX_DIAGNOSIS_WEAKNESSES = 5;
const MAX_QUALITY_PATTERNS = 5;

export async function runTierPlanRefinement(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { studentId, tenantId, supabase } = ctx;
  const startMs = Date.now();

  // ── 1. 활성 main_exploration 로드 (scope=overall, direction=design) ──
  const active = await getActiveMainExploration(
    studentId,
    tenantId,
    { scope: "overall", trackLabel: null, direction: "design" },
    supabase,
  );

  if (!active) {
    logActionDebug(LOG_CTX, "활성 메인 탐구 없음 — skip", { studentId });
    return {
      preview: "활성 메인 탐구 없음 — 개정 skip",
      result: { action: "skipped_no_active", elapsedMs: Date.now() - startMs },
    };
  }

  // ── 2. 컨설턴트 수정본 가드 ──
  if (active.edited_by_consultant_at) {
    return {
      preview: "컨설턴트 수정본 — 자동 개정 skip",
      result: {
        action: "skipped_guarded_by_consultant",
        elapsedMs: Date.now() - startMs,
      },
    };
  }

  // ── 3. origin 가드 (auto_bootstrap* 만 덮어쓰기 허용) ──
  const origin = active.origin as string;
  if (origin !== "auto_bootstrap" && origin !== "auto_bootstrap_v2") {
    return {
      preview: `비-부트스트랩 origin(${origin}) — 자동 개정 skip`,
      result: {
        action: "skipped_non_bootstrap_origin",
        elapsedMs: Date.now() - startMs,
      },
    };
  }

  // ── 4. 학생 진로·학년 로드 ──
  const { data: student } = await supabase
    .from("students")
    .select("grade, target_major, target_major_2")
    .eq("id", studentId)
    .maybeSingle();

  const targetMajor = (student?.target_major as string | null) ?? null;
  if (!targetMajor) {
    return {
      preview: "target_major 미설정 — 개정 skip",
      result: {
        action: "skipped_no_target_major",
        elapsedMs: Date.now() - startMs,
      },
    };
  }
  const targetMajor2 = (student?.target_major_2 as string | null) ?? null;
  const tier1Code = MAJOR_TO_TIER1[targetMajor] ?? "";
  const currentGrade = ((student?.grade ?? 1) as 1 | 2 | 3);

  // ── 5. Synthesis 산출물 요약 로드 (DB 직접 조회 — 이미 S3/S5/S6 가 영속화 완료) ──
  const currentSchoolYear = calculateSchoolYear();

  const [diagRes, stratRes, roadmapRes] = await Promise.all([
    supabase
      .from("student_record_diagnosis")
      .select("weaknesses")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("scope", "overall")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("student_record_strategies")
      .select("strategy_content, priority, target_area")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", currentSchoolYear)
      .order("updated_at", { ascending: false })
      .limit(MAX_STRATEGY_HIGHLIGHTS),
    supabase
      .from("student_record_roadmap_items")
      .select("grade, semester, area, plan_content")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .order("grade", { ascending: true })
      .order("semester", { ascending: true })
      .limit(MAX_ROADMAP_HIGHLIGHTS),
  ]);

  const diagnosisWeaknesses = ((diagRes.data?.weaknesses as string[] | null) ?? [])
    .slice(0, MAX_DIAGNOSIS_WEAKNESSES);

  const strategyHighlights = ((stratRes.data ?? []) as Array<{
    strategy_content: string;
    priority: string | null;
    target_area: string;
  }>)
    .map((s) =>
      `[${s.priority ?? "-"}·${s.target_area}] ${s.strategy_content.trim().slice(0, 120)}`,
    )
    .filter((s) => s.length > 0);

  const roadmapHighlights = ((roadmapRes.data ?? []) as Array<{
    grade: number;
    semester: number | null;
    area: string;
    plan_content: string;
  }>)
    .map((r) =>
      `${r.grade}학년 ${r.semester ?? "-"}학기 ${r.area}: ${r.plan_content.trim().slice(0, 80)}`,
    )
    .filter((s) => s.length > 0);

  const qualityPatterns = (ctx.qualityPatterns ?? [])
    .slice(0, MAX_QUALITY_PATTERNS)
    .map((p) => `${p.pattern} (${p.count}회, 과목: ${p.subjects.join(", ")})`);

  // ── 6. LLM 호출 (Flash → Pro fallback) ──
  const currentTierPlan = active.tier_plan as unknown as {
    foundational: { theme: string; key_questions: string[]; suggested_activities: string[] };
    development: { theme: string; key_questions: string[]; suggested_activities: string[] };
    advanced: { theme: string; key_questions: string[]; suggested_activities: string[] };
  };

  const suggestion = await extractTierPlanSuggestion({
    currentThemeLabel: active.theme_label,
    currentThemeKeywords: active.theme_keywords ?? [],
    currentTierPlan,
    targetMajor,
    targetMajor2,
    tier1Code,
    currentGrade,
    strategyHighlights,
    roadmapHighlights,
    qualityPatterns,
    diagnosisWeaknesses,
  });

  if (!suggestion.success) {
    logActionWarn(LOG_CTX, "tier_plan refinement LLM 실패 — skip", {
      studentId,
      error: suggestion.error,
    });
    return {
      preview: `LLM 실패 — 개정 skip`,
      result: {
        action: "skipped_llm_error",
        error: suggestion.error,
        elapsedMs: Date.now() - startMs,
      },
    };
  }

  // ── 7. jaccard 비교 ──
  const similarity = compareTierPlans(
    active.tier_plan as unknown as MainExplorationTierPlan,
    suggestion.data.tierPlan,
    { threshold: DEFAULT_TIER_PLAN_CONVERGENCE_THRESHOLD },
  );

  // ── 8. 수렴: no-op 종료 ──
  if (similarity.converged) {
    logActionDebug(LOG_CTX, "tier_plan 수렴 — 갱신 불필요", {
      studentId,
      jaccardOverall: similarity.overall,
    });
    return {
      preview: `수렴 (jaccard ${similarity.overall.toFixed(3)} ≥ ${similarity.threshold}) — 갱신 불필요`,
      result: {
        action: "converged",
        jaccardOverall: similarity.overall,
        jaccardByTier: similarity.byTier,
        threshold: similarity.threshold,
        ...(suggestion.modelName ? { modelName: suggestion.modelName } : {}),
        elapsedMs: Date.now() - startMs,
      },
    };
  }

  // ── 9. 미수렴: origin=auto_bootstrap_v2 로 신규 row INSERT ──
  try {
    const created = await createMainExploration(
      {
        studentId,
        tenantId,
        pipelineId: ctx.pipelineId,
        schoolYear: active.school_year,
        grade: active.grade,
        semester: (active.semester as 1 | 2),
        scope: "overall",
        trackLabel: null,
        direction: "design",
        semanticRole: "hypothesis_root",
        source: "ai",
        origin: "auto_bootstrap_v2",
        themeLabel: suggestion.data.themeLabel,
        themeKeywords: suggestion.data.themeKeywords,
        careerField: active.career_field,
        tierPlan: suggestion.data.tierPlan,
        modelName: suggestion.modelName ?? null,
      },
      { parentVersionId: active.id, isActive: true },
      supabase,
    );

    logActionDebug(LOG_CTX, "tier_plan 개정 완료 — v2 row INSERT", {
      studentId,
      prevVersionId: active.id,
      newVersionId: created.id,
      newVersion: created.version,
      jaccardOverall: similarity.overall,
    });

    return {
      preview: `개정 (jaccard ${similarity.overall.toFixed(3)} < ${similarity.threshold}) → v${created.version}`,
      result: {
        action: "refined",
        jaccardOverall: similarity.overall,
        jaccardByTier: similarity.byTier,
        threshold: similarity.threshold,
        prevVersionId: active.id,
        newVersionId: created.id,
        newVersion: created.version,
        ...(suggestion.modelName ? { modelName: suggestion.modelName } : {}),
        elapsedMs: Date.now() - startMs,
      },
    };
  } catch (err) {
    logActionError(LOG_CTX, err, { studentId, step: "createMainExploration_v2" });
    return {
      preview: `저장 실패 — 개정 skip`,
      result: {
        action: "skipped_insert_error",
        error: err instanceof Error ? err.message : String(err),
        jaccardOverall: similarity.overall,
        elapsedMs: Date.now() - startMs,
      },
    };
  }
}
