// ============================================
// Phase Executor 함수 모음 (Phase 분할 실행 지원)
// 각 Phase API route에서 호출하는 단위 실행 함수
// ============================================

import type { PipelineContext } from "./pipeline-types";
import { runTaskWithState } from "./pipeline-executor";
import { runCompetencyAnalysis } from "./pipeline-task-runners";

// ============================================
// Phase 1: 역량 분석
// ============================================

export async function executePhase1(ctx: PipelineContext): Promise<void> {
  await runTaskWithState(ctx, "competency_analysis", () =>
    runCompetencyAnalysis(ctx),
  );
}

