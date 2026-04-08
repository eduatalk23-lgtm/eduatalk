import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext, validatePhasePrerequisites } from "@/lib/domains/student-record/pipeline/pipeline-executor";
import { executeGradePhase7 } from "@/lib/domains/student-record/pipeline/pipeline-grade-phases";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.grade.phase-7" };

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
    const validationError = validatePhasePrerequisites(ctx, 7, "grade");
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 409 });
    }

    if (ctx.targetGrade == null) {
      return NextResponse.json(
        { error: "Grade 파이프라인에 targetGrade가 설정되지 않음" },
        { status: 400 },
      );
    }

    await executeGradePhase7(ctx);

    return NextResponse.json({
      phase: 7,
      grade: ctx.targetGrade,
      completed: true,
    });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json({ error: "Grade Phase 7 실패" }, { status: 500 });
  }
}
