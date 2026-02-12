/**
 * Google Calendar Webhook 수신
 * POST /api/webhooks/google-calendar
 *
 * Google Calendar push notification을 수신하여
 * 변경된 이벤트를 앱 DB에 반영 (Phase 2: 양방향 동기화)
 *
 * 패턴: Toss webhook (항상 200 반환)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { processWebhookNotification } from "@/lib/domains/googleCalendar/webhookHandler";

export async function POST(request: NextRequest) {
  try {
    // Google webhook은 항상 200을 빠르게 반환해야 함
    const channelId = request.headers.get("x-goog-channel-id");
    const resourceId = request.headers.get("x-goog-resource-id");
    const resourceState = request.headers.get("x-goog-resource-state");

    // 채널 검증
    if (!channelId || !resourceId) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // sync 상태는 초기 검증 요청이므로 무시
    if (resourceState === "sync") {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const adminClient = await getSupabaseClientForRLSBypass({
      forceAdmin: true,
      fallbackToServer: false,
    });

    if (!adminClient) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 비동기 처리 (응답은 빠르게 반환)
    await processWebhookNotification(adminClient, {
      channelId,
      resourceId,
      resourceState: resourceState ?? "exists",
    });
  } catch (error) {
    console.error("[api/webhooks/google-calendar] 웹훅 처리 오류:", error);
  }

  // 항상 200 반환
  return NextResponse.json({ success: true }, { status: 200 });
}
