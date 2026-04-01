import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCachedAuthUser } from "@/lib/auth/cachedGetUser";

export const dynamic = "force-dynamic";

/**
 * GDPR / 개인정보보호법 대응 API
 *
 * GET  — 내 Push/알림 데이터 내보내기 (JSON)
 * DELETE — 내 Push/알림 데이터 삭제
 */

export async function GET() {
  const user = await getCachedAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const [subscriptions, logs, dlq] = await Promise.all([
    admin
      .from("push_subscriptions")
      .select("id, endpoint, device_label, is_active, created_at, updated_at")
      .eq("user_id", user.id),
    admin
      .from("notification_log")
      .select(
        "id, type, channel, title, body, reference_id, sent_at, delivered, clicked, clicked_at, skipped_reason"
      )
      .eq("user_id", user.id)
      .order("sent_at", { ascending: false })
      .limit(1000),
    admin
      .from("push_dlq")
      .select("id, payload, error_code, error_message, created_at, resolved_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    user_id: user.id,
    push_subscriptions: subscriptions.data ?? [],
    notification_log: logs.data ?? [],
    push_dlq: dlq.data ?? [],
  });
}

export async function DELETE() {
  const user = await getCachedAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  // 순서 중요: FK 의존성 때문에 DLQ → logs → subscriptions 순차 삭제
  const dlqResult = await admin
    .from("push_dlq")
    .delete({ count: "exact" })
    .eq("user_id", user.id);

  const logsResult = await admin
    .from("notification_log")
    .delete({ count: "exact" })
    .eq("user_id", user.id);

  const subsResult = await admin
    .from("push_subscriptions")
    .delete({ count: "exact" })
    .eq("user_id", user.id);

  return NextResponse.json({
    deleted_at: new Date().toISOString(),
    message: "All push notification data has been deleted.",
    counts: {
      push_dlq: dlqResult.count ?? 0,
      notification_log: logsResult.count ?? 0,
      push_subscriptions: subsResult.count ?? 0,
    },
  });
}
