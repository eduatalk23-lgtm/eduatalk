import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subscription, deviceLabel } = await request.json();

    if (
      !subscription?.endpoint ||
      !subscription.endpoint.startsWith("https://") ||
      !subscription.keys?.p256dh ||
      !subscription.keys?.auth
    ) {
      return NextResponse.json(
        { error: "Invalid subscription data" },
        { status: 400 }
      );
    }

    const label = deviceLabel ?? (await detectDeviceLabel());
    const supabase = await createSupabaseServerClient();
    const now = new Date().toISOString();

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.userId,
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
        subscription: subscription as Record<string, unknown>,
        device_label: label,
        is_active: true,
        updated_at: now,
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) {
      console.error("[api/push/subscribe] Upsert failed:", error);
      return NextResponse.json(
        { error: "Subscription save failed" },
        { status: 500 }
      );
    }

    await supabase
      .from("push_subscriptions")
      .update({ is_active: false, updated_at: now })
      .eq("user_id", user.userId)
      .eq("device_label", label)
      .eq("is_active", true)
      .neq("endpoint", subscription.endpoint);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

async function detectDeviceLabel(): Promise<string> {
  try {
    const headersList = await headers();
    const ua = headersList.get("user-agent") ?? "";
    if (/iPhone|iPad/.test(ua)) return "iOS Safari";
    if (/Android/.test(ua)) return "Android Chrome";
    if (/Mac/.test(ua)) return "macOS Desktop";
    if (/Windows/.test(ua)) return "Windows Desktop";
    if (/Linux/.test(ua)) return "Linux Desktop";
  } catch {
    // ignore
  }
  return "Unknown Device";
}
