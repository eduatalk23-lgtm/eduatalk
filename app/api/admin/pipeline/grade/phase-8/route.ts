import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext } from "@/lib/domains/student-record/pipeline-executor";
import { executeGradePhase8 } from "@/lib/domains/student-record/pipeline-grade-phases";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.grade.phase-8" };

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

    if (ctx.targetGrade == null) {
      return NextResponse.json(
        { error: "Grade 파이프라인에 targetGrade가 설정되지 않음" },
        { status: 400 },
      );
    }

    await executeGradePhase8(ctx);

    // 다음 학년 파이프라인 확인 (phase-8이 최종 phase)
    const admin = createSupabaseAdminClient();
    const { data: siblingPipelines } = await admin
      .from("student_record_analysis_pipelines")
      .select("id, grade, status")
      .eq("student_id", ctx.studentId)
      .eq("pipeline_type", "grade")
      .order("grade", { ascending: true });

    const currentGrade = ctx.targetGrade;
    const nextPipeline = siblingPipelines?.find(
      (p) => (p.grade as number) > currentGrade && p.status === "pending",
    );

    const allGradesCompleted = siblingPipelines?.every(
      (p) => p.status === "completed",
    ) ?? false;

    return NextResponse.json({
      phase: 8,
      grade: ctx.targetGrade,
      completed: true,
      nextGradePipelineId: nextPipeline?.id ?? null,
      nextGrade: nextPipeline?.grade ?? null,
      allGradesCompleted,
    });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json({ error: "Grade Phase 8 실패" }, { status: 500 });
  }
}
