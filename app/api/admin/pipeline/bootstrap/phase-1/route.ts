// ============================================
// Bootstrap Pipeline HTTP Route (Auto-Bootstrap Phase 2, 2026-04-18)
// POST /api/admin/pipeline/bootstrap/phase-1
// 단일 Phase: BT0(target_major_validation) → BT1(main_exploration_seed) → BT2(course_plan_recommend)
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext } from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { guardCancelled } from "@/lib/domains/record-analysis/pipeline/pipeline-route-helpers";
import { executeBootstrapPhase } from "@/lib/domains/record-analysis/pipeline/bootstrap";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.bootstrap" };

export async function POST(request: NextRequest) {
  try {
    const { pipelineId } = (await request.json()) as { pipelineId: string };
    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId 필수" }, { status: 400 });
    }

    const ctx = await loadPipelineContext(pipelineId);
    const cancelResp = await guardCancelled(ctx);
    if (cancelResp) return cancelResp;

    await executeBootstrapPhase(ctx, 1);

    return NextResponse.json({ phase: 1, type: "bootstrap", completed: true });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json({ error: "Bootstrap phase 실패" }, { status: 500 });
  }
}
