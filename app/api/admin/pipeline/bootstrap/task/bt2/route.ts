// ============================================
// Bootstrap Task BT2 Route (I1, 2026-04-26)
// POST /api/admin/pipeline/bootstrap/task/bt2
//
// BT2: course_plan_recommend
// generateAndSaveRecommendations 호출. LLM 없이 rule 기반이므로 빠름.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext } from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { guardCancelled } from "@/lib/domains/record-analysis/pipeline/pipeline-route-helpers";
import { executeBootstrapTask } from "@/lib/domains/record-analysis/pipeline/bootstrap";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.bootstrap.bt2" };

export async function POST(request: NextRequest) {
  try {
    const { pipelineId } = (await request.json()) as { pipelineId: string };
    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId 필수" }, { status: 400 });
    }

    const ctx = await loadPipelineContext(pipelineId);
    const cancelResp = await guardCancelled(ctx);
    if (cancelResp) return cancelResp;

    await executeBootstrapTask(ctx, "course_plan_recommend");

    return NextResponse.json({
      phase: 1,
      type: "bootstrap",
      task: "course_plan_recommend",
      completed: true,
    });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "Bootstrap BT2 실패" },
      { status: 500 },
    );
  }
}
