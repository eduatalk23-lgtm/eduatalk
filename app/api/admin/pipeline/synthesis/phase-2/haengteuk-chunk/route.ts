// ============================================
// Synthesis Phase 2 — Haengteuk Linking Chunk (M1-c W6, 2026-04-28)
//
// Phase 2 내부 haengteuk_linking 을 학년 단위 chunk 로 처리.
// 클라이언트는 hasMore=false까지 반복 호출 후 phase-2 메인 route 호출.
//
// 분리 사유: haengteuk_linking 학년별 LLM 호출 (3년 cascade × Flash) 직렬 누적이
// Phase 2 단일 HTTP timeout 압박. narrative-chunk sub-route 와 동일 패턴.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  loadPipelineContext,
  validatePhasePrerequisites,
} from "@/lib/domains/record-analysis/pipeline/pipeline-executor";
import { guardCancelled } from "@/lib/domains/record-analysis/pipeline/pipeline-route-helpers";
import { executeSynthesisPhase2HaengteukChunk } from "@/lib/domains/record-analysis/pipeline/pipeline-synthesis-phases";

export const maxDuration = 300;

const LOG_CTX = {
  domain: "student-record",
  action: "pipeline.synthesis.phase-2.haengteuk-chunk",
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

    const validationError = validatePhasePrerequisites(ctx, 2, "synthesis");
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 409 });
    }

    const result = await executeSynthesisPhase2HaengteukChunk(ctx, chunkSize ?? 1);

    return NextResponse.json({
      phase: 2,
      type: "synthesis",
      task: "haengteuk_linking",
      ...result,
    });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "Haengteuk Linking 청크 실패" },
      { status: 500 },
    );
  }
}
