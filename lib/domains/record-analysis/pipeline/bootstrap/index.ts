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

// 인라인 auto-bootstrap (기존 ops route에서 재사용)
export { ensureBootstrap, BootstrapError } from "./ensure-bootstrap";
export type { BootstrapResult } from "./ensure-bootstrap";

// ============================================
// Bootstrap Phase Executor
// HTTP route (`/api/admin/pipeline/bootstrap/phase-1`)에서 호출.
// ============================================

import type { PipelineContext } from "../pipeline-types";
import { runTaskWithState, checkCancelled } from "../pipeline-executor";
import {
  runTargetMajorValidation,
  runMainExplorationSeed,
  runCoursePlanRecommend,
} from "./phase-b0-bootstrap";

/**
 * Bootstrap Phase 1 실행 (BT0 → BT1 → BT2 순차).
 * BT0 실패 시 BT1/BT2 는 자동 스킵 (task prerequisites 가드).
 */
export async function executeBootstrapPhase(
  ctx: PipelineContext,
  _phase: number = 1,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  // BT0: target_major_validation — 실패 시 BT1/BT2 도 failed 처리로 전파됨
  await runTaskWithState(ctx, "target_major_validation", () =>
    runTargetMajorValidation(ctx),
  );

  // BT0 실패하면 cascade 차단 (BT1/BT2 skip)
  if (ctx.tasks["target_major_validation"] === "failed") {
    ctx.tasks["main_exploration_seed"] = "failed";
    ctx.errors["main_exploration_seed"] = "BT0(target_major_validation) 실패로 건너뜀";
    ctx.tasks["course_plan_recommend"] = "failed";
    ctx.errors["course_plan_recommend"] = "BT0(target_major_validation) 실패로 건너뜀";
    // DB 상태 반영은 runTaskWithState 가 최종 computePipelineFinalStatus 로 처리
    return;
  }

  if (await checkCancelled(ctx)) return;

  // BT1: main_exploration_seed
  await runTaskWithState(ctx, "main_exploration_seed", () =>
    runMainExplorationSeed(ctx),
  );

  if (await checkCancelled(ctx)) return;

  // BT2: course_plan_recommend
  await runTaskWithState(ctx, "course_plan_recommend", () =>
    runCoursePlanRecommend(ctx),
  );
}
