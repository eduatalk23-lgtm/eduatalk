import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  loadPipelineContext,
  chainToNextPhase,
} from "@/lib/domains/student-record/pipeline-executor";
import { executePhase6 } from "@/lib/domains/student-record/pipeline-phases";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { pipelineId } = await request.json();
    if (!pipelineId) {
      return NextResponse.json(
        { error: "pipelineId required" },
        { status: 400 },
      );
    }

    const ctx = await loadPipelineContext(pipelineId);
    await executePhase6(ctx);

    await chainToNextPhase(7, pipelineId);
    return NextResponse.json({ phase: 6, completed: true });
  } catch (error) {
    logActionError(
      { domain: "student-record", action: "pipeline.phase-6" },
      error,
    );
    return NextResponse.json({ error: "Phase 6 실패" }, { status: 500 });
  }
}
