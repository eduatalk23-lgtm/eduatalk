// ============================================
// S7 (Phase 4b): tier_plan refinement — Synthesis → main_exploration 피드백 루프
//
// 흐름:
//   1. 활성 main_exploration 로드 (origin/consultant/target_major 가드)
//   2. Synthesis 산출물(진단·전략·로드맵·qualityPatterns) 수집
//   3. extractTierPlanSuggestion: 현 plan + Synthesis 입력 → 제안 plan
//   4. judgeTierPlanConvergence(L4-D 패턴, Flash): 두 plan 의 컨설팅 가치 동등성 LLM 판정
//   5. converged → no-op / substantial_change → max chain guard → origin='auto_bootstrap_v2' INSERT
//
// 구식 jaccard 비교(Sprint 1+2)는 surface rephrasing 을 큰 변경으로 오판 → Sprint 4 에서 제거.
// jaccard 는 task_results 에 telemetry 로만 보존(LLM-judge 정확도 검증 도구).
//
// max version chain depth = 2 (v3 차단). v2 도 부족하면 컨설턴트 수동 편집 영역.
// ============================================

import { logActionDebug, logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import type { PipelineContext, TaskRunnerOutput } from "../pipeline-types";
import { assertSynthesisCtx } from "../pipeline-types";
import {
  getActiveMainExploration,
  createMainExploration,
  getMainExplorationChainDepth,
  type MainExplorationTierPlan,
} from "@/lib/domains/student-record/repository/main-exploration-repository";
import {
  compareTierPlans,
  DEFAULT_TIER_PLAN_CONVERGENCE_THRESHOLD,
} from "../../blueprint/tier-plan-similarity";
import { extractTierPlanSuggestion } from "../../llm/actions/extractTierPlanSuggestion";
import { judgeTierPlanConvergence } from "../../llm/actions/judgeTierPlanConvergence";
import { findLatestSnapshot } from "@/lib/domains/student-record/repository/student-state-repository";
import type { StudentState } from "@/lib/domains/student-record/types/student-state";
import { MAJOR_TO_TIER1 } from "@/lib/constants/career-classification";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";

const LOG_CTX = { domain: "record-analysis", action: "pipeline.phase-s7" };

const MAX_STRATEGY_HIGHLIGHTS = 5;
const MAX_ROADMAP_HIGHLIGHTS = 5;
const MAX_DIAGNOSIS_WEAKNESSES = 5;
const MAX_QUALITY_PATTERNS = 5;

/** Phase 4b Sprint 4: 자동 cascade chain depth 상한 (v3 생성 직전 차단). */
export const MAX_TIER_PLAN_CHAIN_DEPTH = 2;

export async function runTierPlanRefinement(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { studentId, tenantId, supabase } = ctx;
  const startMs = Date.now();

  // ── 1. 활성 main_exploration 로드 ──
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

  // ── 5. Synthesis 산출물 요약 로드 ──
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

  const qualityPatterns = (ctx.belief.qualityPatterns ?? [])
    .slice(0, MAX_QUALITY_PATTERNS)
    .map((p) => `${p.pattern} (${p.count}회, 과목: ${p.subjects.join(", ")})`);

  // ── 6. Suggestion LLM (Flash → Pro fallback) ──
  const currentTierPlan = active.tier_plan as unknown as {
    foundational: { theme: string; key_questions: string[]; suggested_activities: string[] };
    development: { theme: string; key_questions: string[]; suggested_activities: string[] };
    advanced: { theme: string; key_questions: string[]; suggested_activities: string[] };
  };

  // ── α3-4 / α3-3-2 / α2-StepC (2026-04-20): 최신 snapshot 에서
  //   blueprintGap + multiScenarioGap + hakjongScore + hakjongScoreV2Pre 동시 로드.
  //   α1-3-d 야간 cron 또는 pipeline 완료 훅이 영속한 snapshot 기반.
  //   snapshot 부재/파싱 실패 시 모든 필드 null — S7 은 기존과 동일 동작.
  const snapshotCtx = await loadLatestSnapshotContext(studentId, tenantId, supabase);

  // ── 격차 C (2026-04-26): MidPlan focusHypothesis → S7 tier_plan 정합
  //   buildMidPlanSynthesisSection 으로 변환 후 extractTierPlanSuggestion 에 주입.
  //   midPlan 부재 또는 변환 실패 시 undefined (no-op) — S7 기존 동작 보존.
  let midPlanSynthesisSection: string | undefined;
  let midPlanByGradeSection: string | undefined;
  try {
    const { buildMidPlanSynthesisSection, buildMidPlanByGradeSection } = await import(
      "@/lib/domains/record-analysis/llm/mid-plan-guide-section"
    );
    const { resolveMidPlan } = await import("../orient/resolve-mid-plan");
    const built = buildMidPlanSynthesisSection(resolveMidPlan(ctx));
    if (built) midPlanSynthesisSection = built;
    // 격차 1 다학년 통합: belief.midPlanByGrade 학년별 MidPlan 분포
    midPlanByGradeSection = buildMidPlanByGradeSection(ctx.belief.midPlanByGrade) ?? undefined;
  } catch {
    // best-effort: 실패해도 S7 계속 진행
  }

  // Phase B G1: narrativeArc → S7 (best-effort)
  let narrativeArcSection: string | undefined;
  try {
    const { buildNarrativeArcDiagnosisSection } = await import(
      "@/lib/domains/record-analysis/llm/narrative-arc-diagnosis-section"
    );
    narrativeArcSection = await buildNarrativeArcDiagnosisSection(studentId, tenantId, supabase) ?? undefined;
  } catch {
    // best-effort
  }

  // Phase B G2: hyperedge → S7 (best-effort)
  let hyperedgeSummarySection: string | undefined;
  try {
    const { findHyperedges } = await import("@/lib/domains/student-record/repository/hyperedge-repository");
    const { buildHyperedgeSummarySection } = await import("./helpers");
    const hyperedges = await findHyperedges(studentId, tenantId, { contexts: ["analysis"] });
    if (hyperedges.length > 0) {
      hyperedgeSummarySection = buildHyperedgeSummarySection(hyperedges) ?? undefined;
    }
  } catch {
    // best-effort
  }

  // Phase D2: 학년 지배 교과 교차 테마 → S7 tier_plan 정합 (best-effort).
  // 격차 4: Synthesis 단독 phase 이므로 단일 belief.gradeThemes 폴백 제거 (dead).
  let s7GradeThemesSection: string | undefined;
  try {
    const { buildGradeThemesByGradeSection } = await import("./helpers");
    const built = buildGradeThemesByGradeSection(ctx.belief.gradeThemesByGrade);
    if (built) s7GradeThemesSection = built;
  } catch {
    // best-effort: 실패해도 S7 계속 진행
  }

  // Phase C A6: 학생 정체성 프로필 카드 → S7 tier_plan 정합 (best-effort)
  const s7ProfileCardSection: string | undefined =
    ctx.belief.profileCard && ctx.belief.profileCard.trim().length > 0
      ? ctx.belief.profileCard
      : undefined;

  // M1-c W5 (2026-04-27): mainTheme + cascadePlan → S7 tier_plan 개정의 핵심 비교 기준
  let s7MainThemeCascadeSection: string | undefined;
  if (ctx.belief.mainTheme || ctx.belief.cascadePlan) {
    try {
      const { buildMainThemeCascadeSection } = await import("./helpers");
      const built = buildMainThemeCascadeSection({
        mainTheme: ctx.belief.mainTheme,
        cascadePlan: ctx.belief.cascadePlan,
      });
      if (built.trim().length > 0) s7MainThemeCascadeSection = built;
    } catch {
      // best-effort
    }
  }

  // Phase C A1: 직전 실행 gap_tracking.topBridges → S7 tier_plan 개정 시 미해결 격차 반영 (best-effort)
  let s7PreviousRunOutputsSection: string | undefined;
  try {
    const prevRun = ctx.belief.previousRunOutputs;
    if (prevRun?.runId) {
      const { getPreviousRunResult } = await import("../pipeline-previous-run");
      const prevGap = getPreviousRunResult<{
        bridgeCount: number;
        topBridges: Array<{
          themeLabel: string;
          urgency: string;
          targetGrade: number | null;
          sharedCompetencies: string[];
        }>;
      }>(prevRun, "gap_tracking");
      const bridges = prevGap?.topBridges ?? [];
      if (bridges.length > 0) {
        const lines = bridges.map((b) => {
          const grade = b.targetGrade ? `${b.targetGrade}학년` : "학년 미정";
          const comps = b.sharedCompetencies.slice(0, 3).join(", ");
          return `- [${b.urgency}] ${grade} "${b.themeLabel}" (역량: ${comps || "없음"})`;
        });
        s7PreviousRunOutputsSection = [
          `## 직전 실행(${prevRun.completedAt?.slice(0, 10) ?? "이전"}) 미해결 격차`,
          "아래 bridge 제안 중 아직 해결되지 않은 항목을 tier_plan 개정 시 우선 반영.",
          ...lines,
        ].join("\n");
      }
    }
  } catch (s7PrevErr) {
    logActionDebug(LOG_CTX, `직전 실행 gap 섹션 빌드 실패 (S7 계속): ${s7PrevErr}`);
  }

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
    blueprintGap: snapshotCtx.blueprintGap,
    multiScenarioGap: snapshotCtx.multiScenarioGap,
    hakjongScore: snapshotCtx.hakjongScore,
    hakjongScoreV2Pre: snapshotCtx.hakjongScoreV2Pre,
    midPlanSynthesisSection,
    midPlanByGradeSection,
    narrativeArcSection,
    hyperedgeSummarySection,
    previousRunOutputsSection: s7PreviousRunOutputsSection,
    gradeThemesSection: s7GradeThemesSection,
    profileCardSection: s7ProfileCardSection,
    mainThemeCascadeSection: s7MainThemeCascadeSection,
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

  // ── 7. jaccard telemetry (판정엔 사용 안 함, LLM-judge 정확도 검증 도구) ──
  const similarity = compareTierPlans(
    active.tier_plan as unknown as MainExplorationTierPlan,
    suggestion.data.tierPlan,
    { threshold: DEFAULT_TIER_PLAN_CONVERGENCE_THRESHOLD },
  );

  // ── 8. LLM-judge: 컨설팅 가치 동등성 판정 ──
  const judge = await judgeTierPlanConvergence({
    targetMajor,
    targetMajor2,
    currentGrade,
    currentThemeLabel: active.theme_label,
    proposedThemeLabel: suggestion.data.themeLabel,
    currentTierPlan,
    proposedTierPlan: suggestion.data.tierPlan,
  });

  if (!judge.success) {
    // judge 실패 시 fail-closed: 개정 skip (추가 row 생성 위험 회피)
    logActionWarn(LOG_CTX, "tier_plan judge LLM 실패 — fail-closed skip", {
      studentId,
      error: judge.error,
    });
    return {
      preview: `judge 실패 — 개정 skip (fail-closed)`,
      result: {
        action: "skipped_judge_error",
        error: judge.error,
        jaccardOverall: similarity.overall,
        jaccardByTier: similarity.byTier,
        threshold: similarity.threshold,
        ...(suggestion.modelName ? { modelName: suggestion.modelName } : {}),
        elapsedMs: Date.now() - startMs,
      },
    };
  }

  const judgeBase = {
    judgeVerdict: judge.data.verdict,
    judgeReasoning: judge.data.reasoning,
    judgeDeltaCategories: judge.data.deltaCategories,
    ...(judge.modelName ? { judgeModelName: judge.modelName } : {}),
    jaccardOverall: similarity.overall,
    jaccardByTier: similarity.byTier,
    threshold: similarity.threshold,
    ...(suggestion.modelName ? { modelName: suggestion.modelName } : {}),
  };

  // ── 9. 수렴: no-op 종료 ──
  if (judge.converged) {
    logActionDebug(LOG_CTX, "tier_plan 수렴 — 갱신 불필요", {
      studentId,
      verdict: judge.data.verdict,
      jaccardOverall: similarity.overall,
    });
    return {
      preview: `수렴 (${judge.data.verdict}) — 갱신 불필요`,
      result: {
        action: "converged",
        ...judgeBase,
        elapsedMs: Date.now() - startMs,
      },
    };
  }

  // ── 10. max chain depth 가드 (v3 차단) ──
  const chainDepth = await getMainExplorationChainDepth(active.id, supabase);
  if (chainDepth >= MAX_TIER_PLAN_CHAIN_DEPTH) {
    logActionWarn(LOG_CTX, "tier_plan chain depth 상한 도달 — 자동 개정 차단", {
      studentId,
      activeId: active.id,
      chainDepth,
      maxChainDepth: MAX_TIER_PLAN_CHAIN_DEPTH,
      verdict: judge.data.verdict,
    });
    return {
      preview: `chain depth ${chainDepth} ≥ ${MAX_TIER_PLAN_CHAIN_DEPTH} — 자동 개정 차단 (컨설턴트 수동 검토 영역)`,
      result: {
        action: "skipped_max_version_chain",
        chainDepth,
        maxChainDepth: MAX_TIER_PLAN_CHAIN_DEPTH,
        ...judgeBase,
        elapsedMs: Date.now() - startMs,
      },
    };
  }

  // ── 11. substantial_change: origin='auto_bootstrap_v2' 신규 row INSERT ──
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
      verdict: judge.data.verdict,
      jaccardOverall: similarity.overall,
    });

    return {
      preview: `개정 (${judge.data.verdict}) → v${created.version}`,
      result: {
        action: "refined",
        prevVersionId: active.id,
        newVersionId: created.id,
        newVersion: created.version,
        chainDepth: chainDepth + 1,
        maxChainDepth: MAX_TIER_PLAN_CHAIN_DEPTH,
        ...judgeBase,
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
        ...judgeBase,
        elapsedMs: Date.now() - startMs,
      },
    };
  }
}

// α3-4 / α3-3-2 / α2-StepC (2026-04-20): 최신 snapshot 에서
// blueprintGap + multiScenarioGap + hakjongScore + hakjongScoreV2Pre 를 함께 반환.
// 실패/부재/파싱 이슈 모두 null. S7 은 기존과 동일하게 동작.
async function loadLatestSnapshotContext(
  studentId: string,
  tenantId: string,
  client: Parameters<typeof findLatestSnapshot>[2],
): Promise<{
  blueprintGap: StudentState["blueprintGap"] | null;
  multiScenarioGap: StudentState["multiScenarioGap"] | null;
  hakjongScore: StudentState["hakjongScore"] | null;
  hakjongScoreV2Pre: StudentState["hakjongScoreV2Pre"] | null;
}> {
  const empty = {
    blueprintGap: null,
    multiScenarioGap: null,
    hakjongScore: null,
    hakjongScoreV2Pre: null,
  };
  try {
    const snap = await findLatestSnapshot(studentId, tenantId, client);
    if (!snap?.snapshot_data) return empty;
    const state = snap.snapshot_data as unknown as Partial<StudentState>;
    return {
      blueprintGap: state.blueprintGap ?? null,
      multiScenarioGap: state.multiScenarioGap ?? null,
      hakjongScore: state.hakjongScore ?? null,
      hakjongScoreV2Pre: state.hakjongScoreV2Pre ?? null,
    };
  } catch {
    return empty;
  }
}
