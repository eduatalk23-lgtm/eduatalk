// ============================================
// Blueprint Pipeline HTTP Route (2026-04-16 D, 스켈레톤)
// POST /api/admin/pipeline/blueprint
// 단일 Phase: B1 blueprint_generation.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext } from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { guardCancelled } from "@/lib/domains/record-analysis/pipeline/pipeline-route-helpers";
import { executeBlueprintPhase1 } from "@/lib/domains/record-analysis/pipeline/blueprint";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.blueprint" };

export async function POST(request: NextRequest) {
  try {
    const { pipelineId } = (await request.json()) as { pipelineId: string };
    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId 필수" }, { status: 400 });
    }

    const ctx = await loadPipelineContext(pipelineId);
    const cancelResp = await guardCancelled(ctx);
    if (cancelResp) return cancelResp;

    await executeBlueprintPhase1(ctx);

    return NextResponse.json({ phase: 1, type: "blueprint", completed: true });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json({ error: "Blueprint phase 실패" }, { status: 500 });
  }
}
