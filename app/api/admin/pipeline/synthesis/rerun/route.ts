// ============================================
// Synthesis 파이프라인 태스크 재실행 (트랙 D, 2026-04-14)
//
// POST body: { pipelineId, taskKeys: SynthesisPipelineTaskKey[] }
// 지정된 태스크를 pending으로 리셋 + cascade(SYNTHESIS_TASK_DEPENDENTS) 하류 태스크도 함께.
// 파생 DB 산출물도 함께 클린업하여 실제 재실행 보장.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { rerunSynthesisPipelineTasks } from "@/lib/domains/student-record/actions/pipeline-orchestrator";
import type { SynthesisPipelineTaskKey } from "@/lib/domains/record-analysis/pipeline";

const LOG_CTX = { domain: "student-record", action: "pipeline.synthesis.rerun" };

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrConsultant();
    const { pipelineId, taskKeys } = (await request.json()) as {
      pipelineId: string;
      taskKeys: SynthesisPipelineTaskKey[];
    };

    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId 필수" }, { status: 400 });
    }
    if (!Array.isArray(taskKeys) || taskKeys.length === 0) {
      return NextResponse.json(
        { error: "taskKeys 배열이 비어 있습니다" },
        { status: 400 },
      );
    }

    const result = await rerunSynthesisPipelineTasks(pipelineId, taskKeys);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result.data);
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "synthesis 재실행 실패" },
      { status: 500 },
    );
  }
}
