// M1-c W6 (2026-04-27): Phase 4 의 pre-task 4개 분리 route.
//
// cross_subject_theme_extraction + competency_volunteer + competency_awards + derive_main_theme
// 모두 단일 LLM 직렬 task. 합 80-200s 예상. phase-4 main (setek_guide chunk) 와 route timeout 분리.
//
// UI 가 phase-3 완료 후 phase-4-pre 1회 호출, 그 다음 phase-4 chunk loop.

import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext, validatePhasePrerequisites } from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { guardCancelled, guardAlreadyCompleted } from "@/lib/domains/record-analysis/pipeline/pipeline-route-helpers";
import { executeGradePhase4Pre } from "@/lib/domains/record-analysis/pipeline/pipeline-grade-phases";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.grade.phase-4-pre" };

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
    const cancelResp = await guardCancelled(ctx);
    if (cancelResp) return cancelResp;
    const completedResp = guardAlreadyCompleted(ctx);
    if (completedResp) return completedResp;
    // phase 4 pre 의 prereq 는 phase 3 완료 — phase 4 와 동일 prereq 적용
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

    await executeGradePhase4Pre(ctx);

    return NextResponse.json({
      phase: "4-pre",
      grade: ctx.targetGrade,
      completed: true,
    });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json({ error: "Grade Phase 4-Pre 실패" }, { status: 500 });
  }
}
