/**
 * Push 알림 클릭 추적 API
 *
 * Service Worker의 notificationclick 이벤트에서 호출됩니다.
 * SW 환경에서는 인증 쿠키가 없을 수 있으므로, notificationLogId 기반으로 업데이트합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { notificationLogId } = await request.json();

    // UUID v4 형식 검증 (공개 API이므로 입력값 엄격 검증)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      !notificationLogId ||
      typeof notificationLogId !== "string" ||
      !UUID_RE.test(notificationLogId)
    ) {
      return NextResponse.json(
        { error: "Invalid notificationLogId" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const { error } = await supabase
      .from("notification_log")
      .update({
        clicked: true,
        clicked_at: new Date().toISOString(),
      })
      .eq("id", notificationLogId)
      .eq("clicked", false);

    if (error) {
      console.error("[api/push/click] Update failed:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
