import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext, validatePhasePrerequisites } from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { guardCancelled, guardAlreadyCompleted } from "@/lib/domains/record-analysis/pipeline/pipeline-route-helpers";
import { executeGradePhase4 } from "@/lib/domains/record-analysis/pipeline/pipeline-grade-phases";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.grade.phase-4" };

export async function POST(request: NextRequest) {
  try {
    const { pipelineId, chunkSize } = (await request.json()) as {
      pipelineId: string;
      // M1-c W5 (2026-04-27): task-level chunk 모드. 클라이언트가 hasMore=false 까지 loop.
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
    const completedResp = guardAlreadyCompleted(ctx);
    if (completedResp) return completedResp;
    const validationError = validatePhasePrerequisites(ctx, 4, "grade");
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 409 });
    }

    const phaseResult = await executeGradePhase4(
      ctx,
      chunkSize != null ? { chunkSize } : undefined,
    );

    // chunkOpts 모드 — phaseResult 가 PhaseChunkResult 객체
    if (phaseResult && typeof phaseResult === "object" && "hasMore" in phaseResult) {
      if (phaseResult.hasMore) {
        return NextResponse.json({
          phase: 4,
          grade: ctx.targetGrade,
          hasMore: true,
          chunkProcessed: phaseResult.chunkProcessed,
          totalUncached: phaseResult.totalUncached,
        });
      }
      return NextResponse.json({
        phase: 4,
        grade: ctx.targetGrade,
        completed: true,
        hasMore: false,
      });
    }

    // 기존 단일 모드
    return NextResponse.json({ phase: 4, grade: ctx.targetGrade, completed: true });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json({ error: "Grade Phase 4 실패" }, { status: 500 });
  }
}
