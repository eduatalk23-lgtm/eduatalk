import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext, validatePhasePrerequisites } from "@/lib/domains/student-record/pipeline/pipeline-executor";
import { executeSynthesisPhase2 } from "@/lib/domains/student-record/pipeline/pipeline-synthesis-phases";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.synthesis.phase-2" };

export async function POST(request: NextRequest) {
  try {
    const { pipelineId } = (await request.json()) as { pipelineId: string };

    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId 필수" }, { status: 400 });
    }

    const ctx = await loadPipelineContext(pipelineId);
    const validationError = validatePhasePrerequisites(ctx, 2, "synthesis");
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 409 });
    }
    await executeSynthesisPhase2(ctx);

    return NextResponse.json({ phase: 2, type: "synthesis", completed: true });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json({ error: "Synthesis Phase 2 실패" }, { status: 500 });
  }
}
