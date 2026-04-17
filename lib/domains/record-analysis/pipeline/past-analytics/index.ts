// ============================================
// Past Analytics 파이프라인 — Public API
// 4축×3층 통합 아키텍처 A층 (2026-04-16 D)
//
// NEIS만 기반 3 산출물: Past Storyline → Past Diagnosis → Past Strategy.
// k≥1(NEIS 학년 존재)일 때만 실행. k=0(1학년 prospective)은 전체 skip.
// ============================================

export {
  runPastStorylineGeneration,
  assertPastAnalyticsCtx,
} from "./phase-a1-past-storyline";

export { runPastDiagnosis } from "./phase-a2-past-diagnosis";

export { runPastStrategy } from "./phase-a3-past-strategy";

// ============================================
// Past Analytics Phase Executor
// 단일 파이프라인 내 A1 → A2 → A3 순차 실행.
// HTTP route (`/api/admin/pipeline/past-analytics/[phase]`)에서 Phase 단위로 호출.
// ============================================

import type { PipelineContext } from "../pipeline-types";
import { runTaskWithState, checkCancelled } from "../pipeline-executor";
import { PAST_ANALYTICS_TASK_PREREQUISITES } from "../pipeline-config";
import { runPastStorylineGeneration } from "./phase-a1-past-storyline";
import { runPastDiagnosis } from "./phase-a2-past-diagnosis";
import { runPastStrategy } from "./phase-a3-past-strategy";
import { logActionWarn } from "@/lib/logging/actionLogger";

function skipIfPastPrereqFailed(
  ctx: PipelineContext,
  taskKey: "past_diagnosis" | "past_strategy",
): boolean {
  const prereqs = PAST_ANALYTICS_TASK_PREREQUISITES[taskKey] ?? [];
  for (const prereq of prereqs) {
    if (ctx.tasks[prereq] === "failed") {
      ctx.tasks[taskKey] = "failed";
      ctx.errors[taskKey] = `선행 태스크 실패로 건너뜀: ${prereq}`;
      logActionWarn(
        { domain: "record-analysis", action: "pipeline" },
        `Past Analytics ${taskKey} skipped — prereq ${prereq} failed`,
        { pipelineId: ctx.pipelineId },
      );
      return true;
    }
  }
  return false;
}

export async function executePastAnalyticsPhase1(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;
  await runTaskWithState(ctx, "past_storyline_generation", () =>
    runPastStorylineGeneration(ctx),
  );
}

export async function executePastAnalyticsPhase2(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;
  if (!skipIfPastPrereqFailed(ctx, "past_diagnosis")) {
    await runTaskWithState(ctx, "past_diagnosis", () => runPastDiagnosis(ctx));
  }
}

export async function executePastAnalyticsPhase3(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;
  if (!skipIfPastPrereqFailed(ctx, "past_strategy")) {
    await runTaskWithState(ctx, "past_strategy", () => runPastStrategy(ctx));
  }
}
