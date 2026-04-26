// ============================================
// Bootstrap Pipeline — Public API
// Auto-Bootstrap Phase 2 (2026-04-18)
//
// pipelineType="bootstrap" 1급 파이프라인.
// BT0: target_major_validation
// BT1: main_exploration_seed
// BT2: course_plan_recommend
// ============================================

export {
  runTargetMajorValidation,
  runMainExplorationSeed,
  runCoursePlanRecommend,
} from "./phase-b0-bootstrap";

export { BootstrapError } from "./bootstrap-error";
export type { BootstrapErrorStep } from "./bootstrap-error";

// ============================================
// Bootstrap Executors
// - executeBootstrapTask : task 단위 route(BT0/BT1/BT2 각 300s) 에서 호출.
// - executeBootstrapPhase: 레거시 — 단일 route 경로(phase-1). 신규 호출처 없음.
// ============================================

import type { PipelineContext } from "../pipeline-types";
import { runTaskWithState, checkCancelled } from "../pipeline-executor";
import {
  runTargetMajorValidation,
  runMainExplorationSeed,
  runCoursePlanRecommend,
} from "./phase-b0-bootstrap";

type BootstrapTaskName =
  | "target_major_validation"
  | "main_exploration_seed"
  | "course_plan_recommend";

const BOOTSTRAP_RUNNERS: Record<
  BootstrapTaskName,
  (ctx: PipelineContext) => ReturnType<typeof runTargetMajorValidation>
> = {
  target_major_validation: runTargetMajorValidation,
  main_exploration_seed: runMainExplorationSeed,
  course_plan_recommend: runCoursePlanRecommend,
};

/**
 * Bootstrap 단일 task 실행 (task 단위 route용).
 *
 * BT0 실패 시의 cascade 차단은 클라이언트(usePipelineExecution)가 task 상태를
 * 확인한 뒤 BT1/BT2 호출을 생략하는 방식으로 처리한다.
 * BT1 이 pending 상태(rate limit 미회복)면 클라이언트 재호출 시 idempotent 재시도.
 */
export async function executeBootstrapTask(
  ctx: PipelineContext,
  taskName: BootstrapTaskName,
): Promise<void> {
  if (await checkCancelled(ctx)) return;
  const runner = BOOTSTRAP_RUNNERS[taskName];
  await runTaskWithState(ctx, taskName, () => runner(ctx));
}

/**
 * Bootstrap Phase 1 전체 실행 (BT0 → BT1 → BT2 순차).
 * @deprecated task 단위 route(executeBootstrapTask)로 대체됨.
 *   기존 `/api/admin/pipeline/bootstrap/phase-1` route 에서만 참조.
 *   신규 호출처는 task 단위 route를 사용할 것.
 */
export async function executeBootstrapPhase(
  ctx: PipelineContext,
  _phase: number = 1,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  await runTaskWithState(ctx, "target_major_validation", () =>
    runTargetMajorValidation(ctx),
  );

  if (ctx.tasks["target_major_validation"] === "failed") {
    ctx.tasks["main_exploration_seed"] = "failed";
    ctx.errors["main_exploration_seed"] = "BT0(target_major_validation) 실패로 건너뜀";
    ctx.tasks["course_plan_recommend"] = "failed";
    ctx.errors["course_plan_recommend"] = "BT0(target_major_validation) 실패로 건너뜀";
    return;
  }

  if (await checkCancelled(ctx)) return;

  await runTaskWithState(ctx, "main_exploration_seed", () =>
    runMainExplorationSeed(ctx),
  );

  if (await checkCancelled(ctx)) return;

  await runTaskWithState(ctx, "course_plan_recommend", () =>
    runCoursePlanRecommend(ctx),
  );
}
