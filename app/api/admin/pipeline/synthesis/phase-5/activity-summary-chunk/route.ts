// ============================================
// Synthesis Phase 5 — Activity Summary Chunk (Map-Reduce per grade)
//
// activity_summary 태스크를 학년 단위로 1회씩 처리.
// 단일 3년 LLM 호출(~240s) → 학년별 ~60s 호출 3회로 분산 → Vercel 240s wall 안전 회피.
//
// 분리 사유: 인제고 1학년 풀런에서 activity_summary 가 240s task timeout 으로 자주 실패.
//   3년치를 단일 LLM 호출로 처리하는 구조가 병목.
//   narrative_arc_extraction / haengteuk_linking 과 동일한 chunked sub-route 패턴 적용.
//
// 클라이언트: phase-5 main 호출 전 hasMore=false 까지 반복 호출.
// 서버: 학년별로 1개씩 처리 후 DB 영속. 모든 학년 완료 시 task=completed 마킹.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  loadPipelineContext,
  validatePhasePrerequisites,
} from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { guardCancelled } from "@/lib/domains/record-analysis/pipeline/pipeline-route-helpers";
import { executeSynthesisPhase5ActivitySummaryChunk } from "@/lib/domains/record-analysis/pipeline/pipeline-synthesis-phases";

export const maxDuration = 280;

const LOG_CTX = {
  domain: "student-record",
  action: "pipeline.synthesis.phase-5.activity-summary-chunk",
};

export async function POST(request: NextRequest) {
  try {
    const { pipelineId, grade } = (await request.json()) as {
      pipelineId: string;
      grade?: number;
    };

    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId 필수" }, { status: 400 });
    }

    const ctx = await loadPipelineContext(pipelineId);
    const cancelResp = await guardCancelled(ctx);
    if (cancelResp) return cancelResp;

    // Phase 5 선행 조건: Phase 3(ai_diagnosis) 완료
    const validationError = validatePhasePrerequisites(ctx, 5, "synthesis");
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 409 });
    }

    const result = await executeSynthesisPhase5ActivitySummaryChunk(ctx, grade);

    return NextResponse.json({
      phase: 5,
      type: "synthesis",
      task: "activity_summary",
      ...result,
    });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "Activity Summary 청크 실패" },
      { status: 500 },
    );
  }
}
