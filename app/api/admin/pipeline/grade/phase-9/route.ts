import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { verifyPipelineTenantAccess } from "@/lib/auth/verifyTenantAccess";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext, validatePhasePrerequisites } from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { guardCancelled, guardAlreadyCompleted } from "@/lib/domains/record-analysis/pipeline/pipeline-route-helpers";
import { executeGradePhase9 } from "@/lib/domains/record-analysis/pipeline/pipeline-grade-phases";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.grade.phase-9" };

export async function POST(request: NextRequest) {
  try {
    const caller = await requireAdminOrConsultant();

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

    await verifyPipelineTenantAccess(pipelineId, caller);

    const ctx = await loadPipelineContext(pipelineId);
    const cancelResp = await guardCancelled(ctx);
    if (cancelResp) return cancelResp;
    const completedResp = guardAlreadyCompleted(ctx);
    if (completedResp) return completedResp;
    const validationError = validatePhasePrerequisites(ctx, 9, "grade");
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 409 });
    }

    if (ctx.targetGrade == null) {
      return NextResponse.json(
        { error: "Grade 파이프라인에 targetGrade가 설정되지 않음" },
        { status: 400 },
      );
    }

    const phaseResult = await executeGradePhase9(
      ctx,
      chunkSize != null ? { chunkSize } : undefined,
    );

    if (phaseResult.hasMore) {
      return NextResponse.json({
        phase: 9,
        grade: ctx.targetGrade,
        hasMore: true,
        chunkProcessed: phaseResult.chunkProcessed,
        totalUncached: phaseResult.totalUncached,
      });
    }

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
      phase: 9,
      grade: ctx.targetGrade,
      completed: true,
      hasMore: false,
      nextGradePipelineId: nextPipeline?.id ?? null,
      nextGrade: nextPipeline?.grade ?? null,
      allGradesCompleted,
    });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json({ error: "Grade Phase 9 실패" }, { status: 500 });
  }
}
