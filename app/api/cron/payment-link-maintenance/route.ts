/**
 * 결제 링크 유지보수 Cron
 * - 만료된 active 링크 → expired 상태로 전환
 * - 24시간 이내 만료 예정 링크 → 리마인더 발송
 *
 * Schedule: daily (vercel.json)
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendPaymentLinkExpiryReminder } from "@/lib/domains/payment/paymentLink/delivery";
import type { DeliveryMethod } from "@/lib/domains/payment/paymentLink/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "DB client init failed" },
      { status: 500 }
    );
  }

  const now = new Date().toISOString();
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  let expiredCount = 0;
  let reminderSent = 0;
  let reminderFailed = 0;

  try {
    // 1. 만료된 active 링크 → expired
    const { data: expiredLinks, error: expireError } = await adminClient
      .from("payment_links")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("expires_at", now)
      .select("id");

    if (expireError) {
      console.error("[payment-link-maintenance] 만료 처리 오류:", expireError);
    } else {
      expiredCount = expiredLinks?.length ?? 0;
    }

    // 2. 24시간 이내 만료 예정 + 발송 이력 있는 링크 → 리마인더
    const { data: expiringLinks, error: expiringError } = await adminClient
      .from("payment_links")
      .select(
        "id, token, recipient_phone, academy_name, student_name, program_name, amount, tenant_id, delivery_method"
      )
      .eq("status", "active")
      .gte("expires_at", now)
      .lte("expires_at", in24h)
      .not("recipient_phone", "is", null)
      .neq("delivery_method", "manual");

    if (expiringError) {
      console.error(
        "[payment-link-maintenance] 만료 임박 조회 오류:",
        expiringError
      );
    } else if (expiringLinks && expiringLinks.length > 0) {
      for (const link of expiringLinks) {
        if (!link.recipient_phone || !link.delivery_method) continue;

        const result = await sendPaymentLinkExpiryReminder({
          recipientPhone: link.recipient_phone,
          academyName: link.academy_name,
          studentName: link.student_name,
          programName: link.program_name,
          amount: link.amount,
          tenantId: link.tenant_id,
          token: link.token,
          deliveryMethod: link.delivery_method as DeliveryMethod,
        });

        if (result.success) {
          reminderSent++;
        } else {
          reminderFailed++;
        }

        // Rate limit 방지
        if (expiringLinks.indexOf(link) < expiringLinks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }

    const summary = {
      message: "Payment link maintenance completed",
      date: now,
      expired: expiredCount,
      reminderSent,
      reminderFailed,
    };

    console.log(
      "[payment-link-maintenance] 결과:",
      JSON.stringify(summary)
    );

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[payment-link-maintenance] 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
