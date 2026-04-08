import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext, validatePhasePrerequisites } from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { guardCancelled } from "@/lib/domains/record-analysis/pipeline/pipeline-route-helpers";
import { executeSynthesisPhase4 } from "@/lib/domains/record-analysis/pipeline/pipeline-synthesis-phases";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.synthesis.phase-4" };

export async function POST(request: NextRequest) {
  try {
    const { pipelineId } = (await request.json()) as { pipelineId: string };

    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId 필수" }, { status: 400 });
    }

    const ctx = await loadPipelineContext(pipelineId);
    const cancelResp = await guardCancelled(ctx);
    if (cancelResp) return cancelResp;
    const validationError = validatePhasePrerequisites(ctx, 4, "synthesis");
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 409 });
    }
    await executeSynthesisPhase4(ctx);

    return NextResponse.json({ phase: 4, type: "synthesis", completed: true });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json({ error: "Synthesis Phase 4 실패" }, { status: 500 });
  }
}
