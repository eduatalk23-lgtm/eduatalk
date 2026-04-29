/**
 * Google Calendar Webhook 갱신 Cron
 * GET /api/cron/google-calendar-webhook-renew
 *
 * Google webhook은 ~7일 만료 → 주간 실행으로 모든 활성 연결의 webhook 갱신
 */

import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/auth/cronAuth";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { getTokensByTenant } from "@/lib/domains/googleCalendar";
import { renewWebhooksForTenant } from "@/lib/domains/googleCalendar/webhookHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResp = verifyCronAuth(request);
  if (authResp) return authResp;

  const result = { tenantsProcessed: 0, renewed: 0, failed: 0 };

  try {
    const adminClient = await getSupabaseClientForRLSBypass({
      forceAdmin: true,
      fallbackToServer: false,
    });

    if (!adminClient) {
      return NextResponse.json(
        { error: "Admin client 초기화 실패" },
        { status: 500 }
      );
    }

    // 활성 토큰이 있는 테넌트 목록 조회
    const { data: tokens, error } = await adminClient
      .from("google_oauth_tokens")
      .select("tenant_id")
      .eq("sync_enabled", true);

    if (error || !tokens) {
      return NextResponse.json({
        message: "토큰 조회 실패",
        date: new Date().toISOString(),
        ...result,
      });
    }

    const tenantIds = [
      ...new Set((tokens as Array<{ tenant_id: string }>).map((t) => t.tenant_id)),
    ];

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.timelevelup.com"}/api/webhooks/google-calendar`;

    for (const tenantId of tenantIds) {
      const tenantResult = await renewWebhooksForTenant(
        adminClient,
        tenantId,
        webhookUrl
      );
      result.tenantsProcessed++;
      result.renewed += tenantResult.renewed;
      result.failed += tenantResult.failed;
    }

    return NextResponse.json({
      message: "Webhook renewal processed",
      date: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("[google-calendar-webhook-renew] 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error", ...result },
      { status: 500 }
    );
  }
}
