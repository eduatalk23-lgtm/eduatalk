import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext } from "@/lib/domains/student-record/pipeline-executor";
import { executePhase8 } from "@/lib/domains/student-record/pipeline-phases";

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
    await executePhase8(ctx);

    // Phase 8은 최종 Phase — 체이닝 없음
    return NextResponse.json({ phase: 8, completed: true });
  } catch (error) {
    logActionError(
      { domain: "student-record", action: "pipeline.phase-8" },
      error,
    );
    return NextResponse.json({ error: "Phase 8 실패" }, { status: 500 });
  }
}
