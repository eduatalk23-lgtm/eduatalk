import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  loadPipelineContext,
  chainToNextPhase,
} from "@/lib/domains/student-record/pipeline-executor";
import { executePhase4 } from "@/lib/domains/student-record/pipeline-phases";

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
    const cacheCompleted = await executePhase4(ctx);

    // 캐시 최적화로 완료된 경우 체이닝 불필요
    if (!cacheCompleted) {
      chainToNextPhase(5, pipelineId);
    }

    return NextResponse.json({ phase: 4, completed: true, cacheCompleted });
  } catch (error) {
    logActionError(
      { domain: "student-record", action: "pipeline.phase-4" },
      error,
    );
    return NextResponse.json({ error: "Phase 4 실패" }, { status: 500 });
  }
}
