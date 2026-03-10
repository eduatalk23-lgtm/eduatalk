/**
 * Push 구독 갱신 API
 *
 * Service Worker의 pushsubscriptionchange 이벤트에서 호출됩니다.
 * 브라우저가 자동으로 새 endpoint를 발급했을 때, 이전 구독을 비활성화하고 새 구독을 등록합니다.
 *
 * SW 환경에서는 Server Action 호출이 불가하므로 API Route를 사용합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { oldEndpoint, newSubscription } = await request.json();

    if (
      !newSubscription?.endpoint ||
      !newSubscription.endpoint.startsWith("https://") ||
      !newSubscription.keys?.p256dh ||
      !newSubscription.keys?.auth
    ) {
      return NextResponse.json(
        { error: "Invalid subscription data" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const now = new Date().toISOString();

    // 이전 endpoint 비활성화
    if (oldEndpoint) {
      await supabase
        .from("push_subscriptions")
        .update({ is_active: false, updated_at: now })
        .eq("user_id", user.userId)
        .eq("endpoint", oldEndpoint);
    }

    // 새 구독 UPSERT
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.userId,
        endpoint: newSubscription.endpoint,
        keys_p256dh: newSubscription.keys.p256dh,
        keys_auth: newSubscription.keys.auth,
        subscription: newSubscription as Record<string, unknown>,
        is_active: true,
        updated_at: now,
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) {
      console.error("[api/push/resubscribe] Upsert failed:", error);
      return NextResponse.json({ error: "Upsert failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
