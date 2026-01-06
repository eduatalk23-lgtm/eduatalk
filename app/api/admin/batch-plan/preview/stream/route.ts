/**
 * 배치 AI 플랜 미리보기 SSE 스트리밍 엔드포인트
 *
 * Phase 3: 미리보기 실시간 진행률 스트리밍
 *
 * POST 요청으로 배치 미리보기 요청을 받고,
 * SSE(Server-Sent Events)로 진행률을 실시간 스트리밍합니다.
 *
 * @module app/api/admin/batch-plan/preview/stream/route
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { generateBatchPreviewWithStreaming } from "@/lib/domains/admin-plan/actions/batchPreviewPlans";
import {
  formatPreviewSSEEvent,
  type PreviewStreamEvent,
} from "@/lib/domains/admin-plan/types/streaming";
import type { BatchPlanSettings } from "@/lib/domains/admin-plan/actions/batchAIPlanGeneration";

export const runtime = "nodejs";
export const maxDuration = 300; // 5분 타임아웃

interface PreviewStreamRequestBody {
  students: Array<{
    studentId: string;
    contentIds: string[];
  }>;
  settings: BatchPlanSettings;
}

/**
 * POST /api/admin/batch-plan/preview/stream
 *
 * 배치 AI 플랜 미리보기를 시작하고 SSE로 진행률을 스트리밍합니다.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const user = await getCurrentUser();
    if (!user || !["admin", "consultant"].includes(user.role)) {
      return NextResponse.json(
        { error: "관리자 또는 컨설턴트 권한이 필요합니다." },
        { status: 403 }
      );
    }

    // 2. 요청 본문 파싱
    const body: PreviewStreamRequestBody = await request.json();
    const { students, settings } = body;

    // 3. 유효성 검사
    if (!students || students.length === 0) {
      return NextResponse.json(
        { error: "처리할 학생이 없습니다." },
        { status: 400 }
      );
    }

    if (!settings?.startDate || !settings?.endDate) {
      return NextResponse.json(
        { error: "시작일과 종료일은 필수입니다." },
        { status: 400 }
      );
    }

    // 4. SSE 스트림 생성
    const encoder = new TextEncoder();
    let isStreamClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: PreviewStreamEvent) => {
          if (isStreamClosed) return;
          try {
            controller.enqueue(encoder.encode(formatPreviewSSEEvent(event)));
          } catch {
            // 스트림이 이미 닫힌 경우 무시
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
          // 스트리밍을 지원하는 배치 미리보기 실행
          await generateBatchPreviewWithStreaming({
            students,
            settings,
            streamingOptions: {
              onProgress: send,
              signal: request.signal,
            },
          });
        } catch (error) {
          // 오류 이벤트 발행
          send({
            type: "preview_error",
            progress: 0,
            total: students.length,
            timestamp: Date.now(),
            error:
              error instanceof Error
                ? error.message
                : "알 수 없는 오류가 발생했습니다.",
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

    // 5. SSE 응답 반환
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Nginx 버퍼링 비활성화
      },
    });
  } catch (error) {
    console.error("[batch-plan/preview/stream] SSE 스트림 생성 실패:", error);
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
