"use server";

import webpush from "web-push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureVapidConfigured } from "../vapid";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  type?: string;
}

/**
 * 특정 사용자의 모든 활성 디바이스에 Push 발송.
 * 410 Gone / 404 응답 시 해당 구독을 자동 비활성화.
 */
/** 이 상태 코드를 받으면 구독이 만료/무효이므로 비활성화 */
const STALE_SUBSCRIPTION_CODES = [400, 404, 410, 413];

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureVapidConfigured()) {
    return { sent: 0, failed: 0 };
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return { sent: 0, failed: 0 };

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!subscriptions?.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    subscriptions.map((row) =>
      webpush.sendNotification(
        row.subscription as unknown as webpush.PushSubscription,
        JSON.stringify(payload),
        { TTL: 86400, urgency: "high" }
      )
    )
  );

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "fulfilled") {
      sent++;
    } else {
      failed++;
      const err = (results[i] as PromiseRejectedResult).reason;
      if (STALE_SUBSCRIPTION_CODES.includes(err?.statusCode)) {
        // 구독 만료/무효 → 비활성화
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("id", subscriptions[i].id);
      } else {
        console.warn("[Push] Unexpected send error:", {
          subscriptionId: subscriptions[i].id,
          statusCode: err?.statusCode,
          message: err?.message,
        });
      }
    }
  }

  return { sent, failed };
}
