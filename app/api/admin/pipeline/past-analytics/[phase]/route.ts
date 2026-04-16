// ============================================
// Past Analytics Pipeline HTTP Route (2026-04-16 D, 스켈레톤)
// POST /api/admin/pipeline/past-analytics/[phase]
//   [phase] = "1" | "2" | "3" (A1 Storyline / A2 Diagnosis / A3 Strategy)
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext } from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { guardCancelled } from "@/lib/domains/record-analysis/pipeline/pipeline-route-helpers";
import {
  executePastAnalyticsPhase1,
  executePastAnalyticsPhase2,
  executePastAnalyticsPhase3,
} from "@/lib/domains/record-analysis/pipeline/past-analytics";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.past-analytics" };

const PHASE_RUNNERS: Record<string, (ctx: Awaited<ReturnType<typeof loadPipelineContext>>) => Promise<void>> = {
  "1": executePastAnalyticsPhase1,
  "2": executePastAnalyticsPhase2,
  "3": executePastAnalyticsPhase3,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ phase: string }> },
) {
  try {
    const { phase } = await params;
    const runner = PHASE_RUNNERS[phase];
    if (!runner) {
      return NextResponse.json(
        { error: `Invalid phase: ${phase} (expected 1|2|3)` },
        { status: 400 },
      );
    }

    const { pipelineId } = (await request.json()) as { pipelineId: string };
    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId 필수" }, { status: 400 });
    }

    const ctx = await loadPipelineContext(pipelineId);
    const cancelResp = await guardCancelled(ctx);
    if (cancelResp) return cancelResp;

    await runner(ctx);

    return NextResponse.json({
      phase: Number(phase),
      type: "past_analytics",
      completed: true,
    });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json({ error: "Past Analytics phase 실패" }, { status: 500 });
  }
}
