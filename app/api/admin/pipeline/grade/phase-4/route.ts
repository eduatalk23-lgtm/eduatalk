import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext, validatePhasePrerequisites } from "@/lib/domains/student-record/pipeline/pipeline-executor";
import { executeGradePhase4 } from "@/lib/domains/student-record/pipeline/pipeline-grade-phases";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.grade.phase-4" };

export async function POST(request: NextRequest) {
  try {
    const { pipelineId } = (await request.json()) as { pipelineId: string };

    if (!pipelineId) {
      return NextResponse.json(
        { error: "pipelineId 필수" },
        { status: 400 },
      );
    }

    const ctx = await loadPipelineContext(pipelineId);
    const validationError = validatePhasePrerequisites(ctx, 4, "grade");
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 409 });
    }
    await executeGradePhase4(ctx);

    return NextResponse.json({ phase: 4, grade: ctx.targetGrade, completed: true });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json({ error: "Grade Phase 4 실패" }, { status: 500 });
  }
}
