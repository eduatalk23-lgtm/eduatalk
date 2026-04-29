import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/auth/cronAuth";
import { runAutoBillingForTenant } from "@/lib/domains/payment/actions/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResp = verifyCronAuth(request);
  if (authResp) return authResp;

  try {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return NextResponse.json(
        { error: "Admin client 초기화 실패" },
        { status: 500 }
      );
    }

    // auto_billing_enabled 테넌트 조회
    const { data: tenants } = await adminClient
      .from("tenants")
      .select("id, settings")
      .not("settings", "is", null);

    if (!tenants || tenants.length === 0) {
      return NextResponse.json({ message: "No tenants with settings", results: [] });
    }

    const today = new Date();
    const todayDay = today.getDate();
    const billingPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    const results: { tenantId: string; created: number; skipped: number }[] = [];

    for (const tenant of tenants) {
      const settings = tenant.settings as Record<string, unknown> | null;
      const billing = settings?.billing as Record<string, unknown> | undefined;

      if (!billing?.auto_billing_enabled) continue;

      const billingDay =
        typeof billing.billing_day === "number" ? billing.billing_day : 25;
      const dueDayOffset =
        typeof billing.due_day_offset === "number" ? billing.due_day_offset : 7;

      // 오늘이 청구일인지 확인
      if (todayDay !== billingDay) continue;

      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + dueDayOffset);
      const dueDateStr = dueDate.toISOString().slice(0, 10);

      const result = await runAutoBillingForTenant(
        tenant.id,
        billingPeriod,
        dueDateStr
      );

      results.push({
        tenantId: tenant.id,
        ...result,
      });
    }

    return NextResponse.json({
      message: "Auto billing completed",
      date: today.toISOString(),
      results,
    });
  } catch (error) {
    console.error("[auto-billing] 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
