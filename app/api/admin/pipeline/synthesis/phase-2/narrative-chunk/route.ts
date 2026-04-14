// ============================================
// Synthesis Phase 2 — Narrative Arc Chunk (트랙 D, 2026-04-14)
//
// Phase 2 내부 Layer 3 narrative_arc_extraction을 청크 단위로 처리.
// 클라이언트는 hasMore=false까지 반복 호출 후 phase-2 메인 route 호출.
// 이렇게 분리한 이유: 레코드 N건 × LLM(fast) × 동시성 3 (~15s/청크) 로
//   Phase 2 단일 HTTP에 묶이면 Vercel 300s 초과. (김세린 사례 elapsed 301s.)
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  loadPipelineContext,
  validatePhasePrerequisites,
} from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { guardCancelled } from "@/lib/domains/record-analysis/pipeline/pipeline-route-helpers";
import { executeSynthesisPhase2NarrativeChunk } from "@/lib/domains/record-analysis/pipeline/pipeline-synthesis-phases";

export const maxDuration = 300;

const LOG_CTX = {
  domain: "student-record",
  action: "pipeline.synthesis.phase-2.narrative-chunk",
};

export async function POST(request: NextRequest) {
  try {
    const { pipelineId, chunkSize } = (await request.json()) as {
      pipelineId: string;
      chunkSize?: number;
    };

    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId 필수" }, { status: 400 });
    }

    const ctx = await loadPipelineContext(pipelineId);
    const cancelResp = await guardCancelled(ctx);
    if (cancelResp) return cancelResp;

    // 선행 조건: Phase 1(storyline_generation) 완료 + edge_computation 는 Phase 2 main에서 별도 처리.
    // narrative는 레코드 원문만 있으면 실행 가능 → storyline 완료만 확인.
    const validationError = validatePhasePrerequisites(ctx, 2, "synthesis");
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 409 });
    }

    const result = await executeSynthesisPhase2NarrativeChunk(
      ctx,
      chunkSize ?? 4,
    );

    return NextResponse.json({
      phase: 2,
      type: "synthesis",
      task: "narrative_arc_extraction",
      ...result,
    });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "Narrative Arc 청크 실패" },
      { status: 500 },
    );
  }
}
