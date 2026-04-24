// ============================================
// Orient Phase — 비선형 재조직 로드맵 Step 2 (2026-04-24)
//
// 학생 상태(belief) 를 읽고 downstream Grade Phase 4~9 의
// skipTasks / modelTier 를 판정하는 규칙 기반 Planner MVP.
//
// LLM 호출 0회. `ctx.resolvedRecords` + `ctx.analysisContext` + `ctx.narrativeContext`
// + `ctx.studentGrade` + `ctx.gradeMode` 만 읽어서 결정적 판정.
//
// 전체 흐름: roadmap `memory/pipeline-nonlinear-reorganization-roadmap.md`
// ============================================

import type {
  PipelineContext,
  GradePipelineTaskKey,
  ResolvedRecordsByGrade,
} from "./pipeline-types";

/**
 * Orient Phase 가 내리는 결정.
 *
 * - `skipTasks` 에 담긴 태스크는 Phase 실행 직전 `skipIfOrientSkipped` 가드로 자동 `failed` 마킹.
 *   (기존 `skipIfPrereqFailed` 와 **이중 가드**, 둘 중 하나만 true 여도 스킵)
 * - `modelTier` 는 Step 3 이후 러너 수정 시 소비. MVP 범위에서는 참조값으로만 기록.
 * - `rationale` 은 디버그 로그·향후 UI 제안 카드의 판정 근거 문자열.
 */
export interface PlannerDirective {
  skipTasks: GradePipelineTaskKey[];
  modelTier: Partial<Record<GradePipelineTaskKey, "fast" | "standard" | "advanced">>;
  rationale: string[];
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

/**
 * Orient Phase 실행 — 규칙 기반 판정.
 *
 * MVP 규칙:
 * 1. `gradeMode === "analysis"` OR 전 학년 NEIS 완비 → draft_* 3종 skip
 * 2. `narrativeContext.prioritizedWeaknesses.length === 0` → 약점 없음 → 전 태스크 fast tier 권고
 * 3. 1학년 + NEIS 전무(설계 모드 온보딩) → competency_* 3종 fast tier (경량)
 * 4. 그 외 기본값: skipTasks=[] / modelTier 비움 (러너 현재 동작 유지 — fallback 안전망)
 */
export async function runOrientPhase(
  ctx: PipelineContext,
): Promise<PlannerDirective> {
  const skipTasks: GradePipelineTaskKey[] = [];
  const modelTier: PlannerDirective["modelTier"] = {};
  const rationale: string[] = [];

  // 규칙 1: 분석 모드 또는 전 학년 NEIS 완비 → draft skip
  const analysisMode = ctx.gradeMode === "analysis";
  const fullNeis = allGradesHaveNeis(ctx.resolvedRecords);
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
  const anyNeis = hasAnyNeisAcrossGrades(ctx.resolvedRecords);
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

  return { skipTasks, modelTier, rationale };
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
