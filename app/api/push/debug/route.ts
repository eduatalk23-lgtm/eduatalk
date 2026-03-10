"use server";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * 푸시 구독 진단 API (임시 디버깅용)
 * GET /api/push/debug
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "no_admin_client" }, { status: 500 });
  }

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, device_label, is_active, created_at, updated_at")
    .eq("user_id", user.userId)
    .order("updated_at", { ascending: false });

  const hasVapidPublic = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const hasVapidPrivate = !!process.env.VAPID_PRIVATE_KEY;

  return NextResponse.json({
    userId: user.userId,
    role: user.role,
    vapid: { hasPublic: hasVapidPublic, hasPrivate: hasVapidPrivate },
    subscriptions: subscriptions ?? [],
    totalActive: subscriptions?.filter((s) => s.is_active).length ?? 0,
  });
}
