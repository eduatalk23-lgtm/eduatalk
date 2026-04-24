// ============================================
// Orient Phase — 비선형 재조직 로드맵 Step 2 (2026-04-24)
//
// 학생 상태(belief) 를 읽고 downstream Grade Phase 4~9 의
// skipTasks / modelTier 를 판정하는 규칙 기반 Planner MVP.
//
// LLM 호출 0회. `ctx.resolvedRecords` + `ctx.analysisContext` + `ctx.narrativeContext`
// + `ctx.studentGrade` + `ctx.gradeMode` 만 읽어서 결정적 판정.
//
// S2 (2026-04-24): ENABLE_ORIENT_LLM_PLANNER flag 활성 시 runLlmPlanner 호출 →
// 규칙 + LLM 결과 merge → plannerSource="merged". flag off 시 기존 경로 완전 보존.
//
// 전체 흐름: roadmap `memory/pipeline-nonlinear-reorganization-roadmap.md`
// ============================================

import type {
  PipelineContext,
  GradePipelineTaskKey,
  ResolvedRecordsByGrade,
} from "./pipeline-types";
import { GRADE_PIPELINE_TASK_KEYS } from "./pipeline-config";
import { runLlmPlanner } from "./orient/llm-planner";
import type { PlanDecision } from "./orient/llm-planner";
import { logActionError } from "@/lib/logging/actionLogger";

/**
 * Orient Phase 가 내리는 결정.
 *
 * - `skipTasks` 에 담긴 태스크는 Phase 실행 직전 `skipIfOrientSkipped` 가드로 자동 `failed` 마킹.
 *   (기존 `skipIfPrereqFailed` 와 **이중 가드**, 둘 중 하나만 true 여도 스킵)
 * - `modelTier` 는 Step 3 이후 러너 수정 시 소비. MVP 범위에서는 참조값으로만 기록.
 * - `rationale` 은 디버그 로그·향후 UI 제안 카드의 판정 근거 문자열.
 *
 * S2 telemetry 필드 (선택):
 * - `plannerSource`: 판정 출처 ("rule" / "merged"). ctx.plannerDirective 에 영속.
 * - `llmRationale`: LLM Planner 원문 판정 근거 (plannerSource="merged" 시).
 * - `llmDurationMs`: LLM 호출 소요 시간 (ms).
 * - `recordPriorityOverride`: LLM 제안 레코드별 중요도 덮어쓰기 (0~100 clamp).
 */
export interface PlannerDirective {
  skipTasks: GradePipelineTaskKey[];
  modelTier: Partial<Record<GradePipelineTaskKey, "fast" | "standard" | "advanced">>;
  rationale: string[];
  /** S2 telemetry: 판정 출처 */
  plannerSource?: "rule" | "merged";
  /** S2 telemetry: LLM Planner 한국어 판정 근거 (plannerSource="merged" 시) */
  llmRationale?: string[];
  /** S2 telemetry: LLM 호출 소요 시간 (ms) */
  llmDurationMs?: number;
  /** S2 telemetry: LLM 제안 레코드별 중요도 덮어쓰기 (recordId → 0~100) */
  recordPriorityOverride?: Record<string, number>;
}

const DRAFT_TASKS: GradePipelineTaskKey[] = [
  "draft_generation",
  "draft_analysis",
  "draft_refinement",
];

const COMPETENCY_TASKS: GradePipelineTaskKey[] = [
  "competency_setek",
  "competency_changche",
  "competency_haengteuk",
];

/**
 * 전 학년에 NEIS 레코드가 하나라도 있는지 확인.
 * 비어 있으면 분석 모드 불가 → 설계 모드 태스크 유지 필요.
 */
function hasAnyNeisAcrossGrades(
  resolved: ResolvedRecordsByGrade | undefined,
): boolean {
  if (!resolved) return false;
  for (const bucket of Object.values(resolved)) {
    if (bucket?.hasAnyNeis) return true;
  }
  return false;
}

/**
 * 모든 학년에 NEIS 가 완비되어 있는지 확인.
 * 전 학년 완비 시 설계 모드 태스크(draft_*) 는 불필요.
 */
function allGradesHaveNeis(
  resolved: ResolvedRecordsByGrade | undefined,
): boolean {
  if (!resolved) return false;
  const grades = Object.values(resolved);
  if (grades.length === 0) return false;
  return grades.every((bucket) => bucket?.hasAnyNeis === true);
}

// ── 유효한 GradePipelineTaskKey 집합 (환각 방지용 whitelist) ────────────────
const VALID_GRADE_TASK_SET = new Set<string>(GRADE_PIPELINE_TASK_KEYS);

// ── modelTier 우선순위 비교 (fast < standard < advanced) ─────────────────────
const MODEL_TIER_RANK: Record<"fast" | "standard" | "advanced", number> = {
  fast: 0,
  standard: 1,
  advanced: 2,
};

function higherTier(
  a: "fast" | "standard" | "advanced",
  b: "fast" | "standard" | "advanced",
): "fast" | "standard" | "advanced" {
  return MODEL_TIER_RANK[a] >= MODEL_TIER_RANK[b] ? a : b;
}

/**
 * 규칙 판정 결과 + LLM 판정 결과를 merge 하여 최종 PlannerDirective 반환.
 *
 * **Safety 원칙** (skip 은 규칙 허용 범위 내에서만 확장):
 * - finalSkip = ruleSkip ∪ (llmSkip ∩ validGradeTasks)
 *   - 규칙이 "반드시 실행"으로 판정한 태스크를 LLM 이 skip 제안해도 그대로 포함 허용.
 *   - 단, llmSkip 중 GRADE_PIPELINE_TASK_KEYS 에 존재하지 않는 키는 제거 (환각 방지).
 *   - 즉 규칙 skip 은 무조건 유지, LLM 의 추가 skip 은 유효 태스크 키만 통과.
 *
 * **modelTier**: 규칙(per-task map)과 LLM(단일 값) 이 다를 때 높은 쪽 선택.
 *   - LLM 이 제안한 단일 modelTier 를 규칙 map 의 각 태스크 tier 와 비교해 max 취함.
 *   - 규칙 map 에 없는 태스크(= 기본 tier)도 LLM 값으로 floor 설정.
 *
 * **recordPriorityOverride**: LLM 값 그대로 통과 (score 0~100 clamp).
 *
 * **rationale**: [rule] / [llm] 프리픽스 병합.
 */
function mergePlannerResults(
  ruleSkipTasks: GradePipelineTaskKey[],
  ruleModelTier: PlannerDirective["modelTier"],
  ruleRationale: string[],
  llmDecision: PlanDecision,
): PlannerDirective & {
  plannerSource: "merged";
  llmRationale: string[];
  llmDurationMs: number | undefined;
  recordPriorityOverride: Record<string, number> | undefined;
} {
  // ── skipTasks merge ──────────────────────────────────────────────────────
  const ruleSkipSet = new Set<string>(ruleSkipTasks);
  // LLM 제안 skip 중 유효 태스크 키만 허용 (환각 방지)
  const llmValidSkip = llmDecision.skipTasks.filter((k) => VALID_GRADE_TASK_SET.has(k));
  // union
  const finalSkipSet = new Set<string>([...ruleSkipSet, ...llmValidSkip]);
  const finalSkipTasks = [...finalSkipSet] as GradePipelineTaskKey[];

  // ── modelTier merge (높은 쪽 선택) ──────────────────────────────────────
  const llmGlobalTier = llmDecision.modelTier; // "fast" | "standard" | "advanced"
  const finalModelTier: PlannerDirective["modelTier"] = {};
  // 규칙에 이미 있는 태스크: 규칙 vs LLM global 중 높은 쪽
  for (const [task, ruleTier] of Object.entries(ruleModelTier) as Array<
    [GradePipelineTaskKey, "fast" | "standard" | "advanced"]
  >) {
    finalModelTier[task] = higherTier(ruleTier, llmGlobalTier);
  }
  // 규칙에 없는 태스크 중 llmGlobalTier 가 "fast" 보다 높으면 명시적 세팅
  // (기본 = undefined → 러너가 자체 default 사용, 여기서는 LLM 이 standard/advanced 제안 시만 세팅)
  if (llmGlobalTier !== "fast") {
    for (const task of GRADE_PIPELINE_TASK_KEYS) {
      if (!finalModelTier[task]) {
        finalModelTier[task] = llmGlobalTier;
      }
    }
  }

  // ── recordPriorityOverride: LLM 값 통과 (score 0~100 clamp) ─────────────
  let recordPriorityOverride: Record<string, number> | undefined;
  if (
    llmDecision.recordPriorityOverride &&
    Object.keys(llmDecision.recordPriorityOverride).length > 0
  ) {
    recordPriorityOverride = {};
    for (const [recordId, score] of Object.entries(llmDecision.recordPriorityOverride)) {
      recordPriorityOverride[recordId] = Math.max(0, Math.min(100, score));
    }
  }

  // ── rationale 병합 ──────────────────────────────────────────────────────
  const mergedRationale = [
    ...ruleRationale.map((r) => `[rule] ${r}`),
    ...(llmDecision.llmRationale ?? []).map((r) => `[llm] ${r}`),
  ];

  return {
    skipTasks: finalSkipTasks,
    modelTier: finalModelTier,
    rationale: mergedRationale,
    plannerSource: "merged",
    llmRationale: llmDecision.llmRationale ?? [],
    llmDurationMs: llmDecision.llmDurationMs,
    recordPriorityOverride,
  };
}

/**
 * Orient Phase 실행 — 규칙 기반 판정 + (flag 활성 시) LLM Planner merge.
 *
 * MVP 규칙:
 * 1. `gradeMode === "analysis"` OR 전 학년 NEIS 완비 → draft_* 3종 skip
 * 2. `narrativeContext.prioritizedWeaknesses.length === 0` → 약점 없음 → 전 태스크 fast tier 권고
 * 3. 1학년 + NEIS 전무(설계 모드 온보딩) → competency_* 3종 fast tier (경량)
 * 4. 그 외 기본값: skipTasks=[] / modelTier 비움 (러너 현재 동작 유지 — fallback 안전망)
 *
 * S2 추가:
 * - ENABLE_ORIENT_LLM_PLANNER=true 시 runLlmPlanner 호출 → 규칙 결과와 merge
 * - LLM null 반환(flag off / 실패) 시 규칙 결과 그대로 (plannerSource="rule")
 * - telemetry: ctx.plannerDirective 에 plannerSource / llmRationale / llmDurationMs 영속
 */
export async function runOrientPhase(
  ctx: PipelineContext,
): Promise<PlannerDirective> {
  const skipTasks: GradePipelineTaskKey[] = [];
  const modelTier: PlannerDirective["modelTier"] = {};
  const rationale: string[] = [];

  // 규칙 1: 분석 모드 또는 전 학년 NEIS 완비 → draft skip
  const analysisMode = ctx.gradeMode === "analysis";
  const fullNeis = allGradesHaveNeis(ctx.belief.resolvedRecords);
  if (analysisMode || fullNeis) {
    for (const k of DRAFT_TASKS) skipTasks.push(k);
    rationale.push(
      analysisMode
        ? "분석 모드 확정 → 설계 모드 태스크(draft_*) 3종 skip"
        : "전 학년 NEIS 완비 → 설계 모드 태스크(draft_*) 3종 skip",
    );
  }

  // 규칙 2: 약점 0건 → 전체 fast tier 권고
  const weakCount = ctx.narrativeContext?.prioritizedWeaknesses?.length ?? 0;
  if (weakCount === 0) {
    for (const k of COMPETENCY_TASKS) modelTier[k] = "fast";
    rationale.push("prioritizedWeaknesses 0건 → competency_* fast tier 권고");
  }

  // 규칙 3: 1학년 온보딩 (설계 모드 + NEIS 전무) → competency_* fast tier
  const anyNeis = hasAnyNeisAcrossGrades(ctx.belief.resolvedRecords);
  if (ctx.studentGrade === 1 && !anyNeis) {
    for (const k of COMPETENCY_TASKS) {
      if (!modelTier[k]) modelTier[k] = "fast";
    }
    rationale.push("1학년 온보딩(NEIS 전무) → competency_* 경량 tier 권고");
  }

  // 규칙 4: 기본값 — 빈 skipTasks / 빈 modelTier (러너 현재 동작 유지)
  if (skipTasks.length === 0 && Object.keys(modelTier).length === 0) {
    rationale.push("기본 경로 — 기존 전수 실행 유지 (fallback 안전망)");
  }

  // ── S2: LLM Planner 호출 분기 ────────────────────────────────────────────
  // flag off(기본) 시 runLlmPlanner 가 null 즉시 반환 → 규칙 결과 그대로 사용
  let llmDecision: PlanDecision | null = null;
  try {
    llmDecision = await runLlmPlanner(ctx);
  } catch (err) {
    // runLlmPlanner 내부에서 이미 catch 하지만 이중 방어
    logActionError(
      { domain: "record-analysis", action: "runOrientPhase" },
      `runLlmPlanner 예외 (outer catch) — fallback rule: ${String(err)}`,
    );
    llmDecision = null;
  }

  if (llmDecision === null) {
    // ── 규칙 결과 그대로 반환 (plannerSource="rule" telemetry 포함) ──────
    const directive: PlannerDirective & {
      plannerSource: "rule";
      llmRationale: undefined;
      llmDurationMs: undefined;
      recordPriorityOverride: undefined;
    } = {
      skipTasks,
      modelTier,
      rationale,
      plannerSource: "rule",
      llmRationale: undefined,
      llmDurationMs: undefined,
      recordPriorityOverride: undefined,
    };
    return directive;
  }

  // ── LLM 결과 유효 → merge ────────────────────────────────────────────────
  const merged = mergePlannerResults(skipTasks, modelTier, rationale, llmDecision);
  return merged;
}

/**
 * Orient 판정으로 skip 대상인 태스크인지 확인 + failed 마킹.
 * 호출부에서 true 이면 태스크 실행을 건너뛴다.
 *
 * 기존 `skipIfPrereqFailed` 와 **이중 가드**. 둘 중 하나라도 true 면 skip.
 */
export function skipIfOrientSkipped(
  ctx: PipelineContext,
  taskKey: GradePipelineTaskKey,
): boolean {
  if (ctx.tasks[taskKey] === "completed") return true;
  const directive = ctx.plannerDirective;
  if (!directive || !directive.skipTasks.includes(taskKey)) return false;

  ctx.tasks[taskKey] = "failed";
  ctx.errors[taskKey] = `Orient 판정으로 건너뜀: ${directive.rationale.join(" / ")}`;
  return true;
}
