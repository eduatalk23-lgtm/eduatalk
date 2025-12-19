/**
 * Server-Sent Events (SSE) 엔드포인트
 * 실시간 알림 스트리밍
 */

import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getUnreadNotifications } from "@/lib/services/inAppNotificationService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // SSE 스트림 생성
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // 연결 확인 메시지 전송
        const send = (data: string) => {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        // 초기 알림 전송
        try {
          const notifications = await getUnreadNotifications(user.userId);
          send(JSON.stringify({ type: "initial", notifications }));
        } catch (error) {
          console.error("[notifications/stream] 초기 알림 조회 실패:", error);
        }

        // 주기적으로 알림 확인 (30초마다)
        const interval = setInterval(async () => {
          try {
            const notifications = await getUnreadNotifications(user.userId);
            if (notifications.length > 0) {
              send(JSON.stringify({ type: "update", notifications }));
            }
          } catch (error) {
            console.error("[notifications/stream] 알림 조회 실패:", error);
          }
        }, 30000);

        // 연결 종료 시 정리
        request.signal.addEventListener("abort", () => {
          clearInterval(interval);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Nginx 버퍼링 비활성화
      },
    });
  } catch (error) {
    console.error("[notifications/stream] SSE 스트림 생성 실패:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

