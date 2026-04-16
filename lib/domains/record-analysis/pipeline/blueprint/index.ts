// ============================================
// Blueprint 파이프라인 — Public API
// 4축×3층 통합 아키텍처 B층 (2026-04-16 D)
//
// Synthesis S1.5에서 분리된 독립 파이프라인.
// 설계 대상 학년(consultingGrades)이 있는 학생에게만 실행.
// ============================================

export { runBlueprintGeneration, assertBlueprintCtx } from "./phase-b1-blueprint";

// ============================================
// Blueprint Phase Executor
// HTTP route (`/api/admin/pipeline/blueprint`)에서 호출.
// ============================================

import type { PipelineContext } from "../pipeline-types";
import { runTaskWithState, checkCancelled } from "../pipeline-executor";
import { runBlueprintGeneration } from "./phase-b1-blueprint";

export async function executeBlueprintPhase1(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;
  await runTaskWithState(ctx, "blueprint_generation", () =>
    runBlueprintGeneration(ctx),
  );
}
