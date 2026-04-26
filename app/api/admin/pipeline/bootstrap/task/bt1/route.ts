// ============================================
// Bootstrap Task BT1 Route (I1, 2026-04-26)
// POST /api/admin/pipeline/bootstrap/task/bt1
//
// BT1: main_exploration_seed
// LLM 호출(generateMainExplorationSeed) 이 rate limit 대기 포함 수 분 소요.
// withExtendedRetry maxDelayMs=60_000 으로 300s 이내 재시도 수행.
// rate limit 미회복 시 task=pending → 클라이언트 재호출로 idempotent 재시도.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext } from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { guardCancelled } from "@/lib/domains/record-analysis/pipeline/pipeline-route-helpers";
import { executeBootstrapTask } from "@/lib/domains/record-analysis/pipeline/bootstrap";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.bootstrap.bt1" };

export async function POST(request: NextRequest) {
  try {
    const { pipelineId } = (await request.json()) as { pipelineId: string };
    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId 필수" }, { status: 400 });
    }

    const ctx = await loadPipelineContext(pipelineId);
    const cancelResp = await guardCancelled(ctx);
    if (cancelResp) return cancelResp;

    await executeBootstrapTask(ctx, "main_exploration_seed");

    return NextResponse.json({
      phase: 1,
      type: "bootstrap",
      task: "main_exploration_seed",
      completed: true,
    });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "Bootstrap BT1 실패" },
      { status: 500 },
    );
  }
}
