// ============================================
// Bootstrap Task BT0 Route (I1, 2026-04-26)
// POST /api/admin/pipeline/bootstrap/task/bt0
//
// BT0: target_major_validation
// 단일 task 분리 이유: 기존 phase-1 route(BT0→BT1→BT2 순차)가 BT1 LLM 호출로
//   Vercel 300s 초과 → narrative-chunk 선례를 따라 task 단위로 분리.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext } from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { guardCancelled } from "@/lib/domains/record-analysis/pipeline/pipeline-route-helpers";
import { executeBootstrapTask } from "@/lib/domains/record-analysis/pipeline/bootstrap";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.bootstrap.bt0" };

export async function POST(request: NextRequest) {
  try {
    const { pipelineId } = (await request.json()) as { pipelineId: string };
    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId 필수" }, { status: 400 });
    }

    const ctx = await loadPipelineContext(pipelineId);
    const cancelResp = await guardCancelled(ctx);
    if (cancelResp) return cancelResp;

    await executeBootstrapTask(ctx, "target_major_validation");

    return NextResponse.json({
      phase: 1,
      type: "bootstrap",
      task: "target_major_validation",
      completed: true,
    });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "Bootstrap BT0 실패" },
      { status: 500 },
    );
  }
}
