// #4 (2026-04-29): cross_subject_theme_extraction 단독 route 분리.
//
// 226s 까지 관찰된 P3.5 가 phase-4-pre 의 다른 3 task 와 같은 300s 윈도우를 점유하던
// 문제 해결. cross_subject 단독 280s 안전 실행. 후속 phase-4-pre 진입 시 cross_subject
// 는 이미 completed 라 자동 skip (runTaskWithState idempotent).
//
// UI 호출 순서: phase-3 → phase-4-pre-cross → phase-4-pre → phase-4 (chunk loop) → ...

import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext, validatePhasePrerequisites } from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { guardCancelled, guardAlreadyCompleted } from "@/lib/domains/record-analysis/pipeline/pipeline-route-helpers";
import { executeGradePhase4PreCross } from "@/lib/domains/record-analysis/pipeline/pipeline-grade-phases";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.grade.phase-4-pre-cross" };

export async function POST(request: NextRequest) {
  try {
    const { pipelineId } = (await request.json()) as { pipelineId: string };

    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId 필수" }, { status: 400 });
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

    if (ctx.targetGrade == null) {
      return NextResponse.json(
        { error: "Grade 파이프라인에 targetGrade가 설정되지 않음" },
        { status: 400 },
      );
    }

    await executeGradePhase4PreCross(ctx);

    return NextResponse.json({
      phase: "4-pre-cross",
      grade: ctx.targetGrade,
      completed: true,
    });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json({ error: "Grade Phase 4-Pre-Cross 실패" }, { status: 500 });
  }
}
