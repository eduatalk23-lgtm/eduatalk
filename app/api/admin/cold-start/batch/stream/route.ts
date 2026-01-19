/**
 * 콜드 스타트 배치 처리 SSE 스트리밍 엔드포인트
 *
 * POST: 배치 처리 실행 및 SSE 스트리밍
 * GET: 드라이런 (대상 목록 및 예상 시간 조회)
 *
 * @module app/api/admin/cold-start/batch/stream/route
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import {
  runColdStartBatch,
  dryRunBatch,
} from "@/lib/domains/plan/llm/actions/coldStart/batch/runner";
import {
  formatColdStartSSEEvent,
  type ColdStartBatchStreamEvent,
} from "@/lib/domains/plan/llm/actions/coldStart/batch/streaming";
import type { BatchPreset } from "@/lib/domains/plan/llm/actions/coldStart/batch/types";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 600; // 10분 타임아웃

/**
 * 유효한 프리셋인지 확인
 */
function isValidPreset(preset: string): preset is BatchPreset {
  return ["all", "core", "math", "english", "science", "custom"].includes(preset);
}

/**
 * GET /api/admin/cold-start/batch/stream
 *
 * 드라이런: 대상 목록 및 예상 시간 조회
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminOrConsultant();
    if (!authResult) {
      return apiUnauthorized("관리자 또는 컨설턴트 권한이 필요합니다.");
    }

    const searchParams = request.nextUrl.searchParams;
    const preset = searchParams.get("preset") || "core";

    if (!isValidPreset(preset)) {
      return NextResponse.json(
        { error: `유효하지 않은 프리셋입니다: ${preset}` },
        { status: 400 }
      );
    }

    const result = dryRunBatch(preset);

    return apiSuccess({
      targets: result.targets,
      estimatedDurationMinutes: result.estimatedDurationMinutes,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/admin/cold-start/batch/stream
 *
 * 배치 처리 실행 및 SSE 스트리밍
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await requireAdminOrConsultant();
    if (!authResult) {
      return NextResponse.json(
        { error: "관리자 또는 컨설턴트 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const preset = searchParams.get("preset") || "core";
    const limitStr = searchParams.get("limit");
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;

    if (!isValidPreset(preset)) {
      return NextResponse.json(
        { error: `유효하지 않은 프리셋입니다: ${preset}` },
        { status: 400 }
      );
    }

    // SSE 스트림 생성
    const encoder = new TextEncoder();
    let isStreamClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: ColdStartBatchStreamEvent) => {
          if (isStreamClosed) return;
          try {
            controller.enqueue(encoder.encode(formatColdStartSSEEvent(event)));
          } catch {
            isStreamClosed = true;
          }
        };

        // 연결 종료 시 정리
        request.signal.addEventListener("abort", () => {
          isStreamClosed = true;
          try {
            controller.close();
          } catch {
            // 이미 닫힌 경우 무시
          }
        });

        try {
          // 드라이런으로 대상 목록 가져오기
          const { targets } = dryRunBatch(preset);
          const limitedTargets = limit ? targets.slice(0, limit) : targets;

          // 시작 이벤트
          send({
            type: "start",
            total: limitedTargets.length,
            preset,
            timestamp: Date.now(),
          });

          // 배치 실행 (실시간 item_complete 이벤트 전송)
          const result = await runColdStartBatch(limitedTargets, {
            saveToDb: true,
            onProgress: (progress) => {
              send({
                type: "progress",
                progress,
                timestamp: Date.now(),
              });
            },
            onItemComplete: (item, index, total) => {
              // 각 항목 완료 시 즉시 SSE 이벤트 전송
              send({
                type: "item_complete",
                target: item.target,
                success: item.success,
                recommendationCount: item.recommendationCount,
                newlySaved: item.newlySaved,
                duplicatesSkipped: item.duplicatesSkipped,
                usedFallback: item.usedFallback,
                currentIndex: index,
                total,
                timestamp: Date.now(),
              });
            },
            onError: (error) => {
              send({
                type: "error",
                error,
                timestamp: Date.now(),
              });
            },
          });

          // 완료 이벤트
          send({
            type: "complete",
            result,
            timestamp: Date.now(),
          });
        } catch (error) {
          send({
            type: "batch_error",
            error:
              error instanceof Error
                ? error.message
                : "알 수 없는 오류가 발생했습니다.",
            timestamp: Date.now(),
          });
        } finally {
          if (!isStreamClosed) {
            try {
              controller.close();
            } catch {
              // 이미 닫힌 경우 무시
            }
          }
        }
      },
    });

    // SSE 응답 반환
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[cold-start/batch/stream] SSE 스트림 생성 실패:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "스트림 생성에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}
