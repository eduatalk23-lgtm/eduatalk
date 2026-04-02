import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { loadPipelineContext, chainToNextPhase } from "@/lib/domains/student-record/pipeline-executor";
import { executePhase1 } from "@/lib/domains/student-record/pipeline-phases";
import type { ExistingPipelineState } from "@/lib/domains/student-record/pipeline-types";
import { PIPELINE_TASK_KEYS } from "@/lib/domains/student-record/pipeline-types";

export const maxDuration = 300; // 5분 — Vercel Hobby 최대

const LOG_CTX = { domain: "student-record", action: "pipeline.phase-1" };

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrConsultant();

    const { pipelineId, existingState } = (await request.json()) as {
      pipelineId: string;
      studentId?: string;
      tenantId?: string;
      studentSnapshot?: Record<string, unknown> | null;
      existingState?: ExistingPipelineState;
    };

    if (!pipelineId) {
      return NextResponse.json(
        { error: "pipelineId 필수" },
        { status: 400 },
      );
    }

    // DB에서 파이프라인 컨텍스트 로드 (existingState가 있으면 completed 태스크 복원)
    const ctx = await loadPipelineContext(pipelineId);

    // resume: existingState의 completed 태스크를 ctx에 반영
    if (existingState) {
      for (const key of PIPELINE_TASK_KEYS) {
        if (existingState.tasks[key] === "completed") {
          ctx.tasks[key] = "completed";
          if (existingState.previews[key]) ctx.previews[key] = existingState.previews[key];
          if (existingState.results[key]) ctx.results[key] = existingState.results[key];
        }
      }
    }

    // Phase 1: 역량 분석
    await executePhase1(ctx);

    // Phase 2로 체이닝
    chainToNextPhase(2, pipelineId);

    return NextResponse.json({ phase: 1, completed: true });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "Phase 1 실패" },
      { status: 500 },
    );
  }
}
