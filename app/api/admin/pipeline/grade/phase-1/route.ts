import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext, validatePhasePrerequisites } from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { guardCancelled } from "@/lib/domains/record-analysis/pipeline/pipeline-route-helpers";
import { executeGradePhase1 } from "@/lib/domains/record-analysis/pipeline/pipeline-grade-phases";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.grade.phase-1" };

export async function POST(request: NextRequest) {
  try {
    const { pipelineId, chunkSize } = (await request.json()) as {
      pipelineId: string;
      chunkSize?: number;
    };

    if (!pipelineId) {
      return NextResponse.json(
        { error: "pipelineId 필수" },
        { status: 400 },
      );
    }

    const ctx = await loadPipelineContext(pipelineId);
    const cancelResp = await guardCancelled(ctx);
    if (cancelResp) return cancelResp;
    const validationError = validatePhasePrerequisites(ctx, 1, "grade");
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 409 });
    }
    const result = await executeGradePhase1(
      ctx,
      chunkSize ? { chunkSize } : undefined,
    );

    return NextResponse.json({
      phase: 1,
      grade: ctx.targetGrade,
      ...result,
    });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json({ error: "Grade Phase 1 실패" }, { status: 500 });
  }
}
