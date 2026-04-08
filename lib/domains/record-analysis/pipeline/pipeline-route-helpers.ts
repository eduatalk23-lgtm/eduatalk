// ============================================
// 파이프라인 API Route 공통 헬퍼
// ============================================

import { NextResponse } from "next/server";
import type { PipelineContext } from "./pipeline-types";
import { checkCancelled } from "./pipeline-executor";

/**
 * 파이프라인이 cancelled 상태이면 499(Client Closed Request)로 응답.
 * API route 진입 직후 loadPipelineContext 다음에 호출.
 *
 * 반환값이 null이 아니면 그대로 return 하여 phase 실행을 건너뛴다.
 */
export async function guardCancelled(
  ctx: PipelineContext,
): Promise<NextResponse | null> {
  if (await checkCancelled(ctx)) {
    return NextResponse.json(
      { cancelled: true, pipelineId: ctx.pipelineId },
      { status: 499 },
    );
  }
  return null;
}
