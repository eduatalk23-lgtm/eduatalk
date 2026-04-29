import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/auth/cronAuth";
import { logActionWarn, logActionError } from "@/lib/utils/serverActionLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOG_CTX = "cron/expire-report-shares";

/**
 * 만료된 리포트 공유 토큰 비활성화 + 오래된 스냅샷 JSONB 정리.
 *
 * 1) is_active=true 이면서 expires_at < now() → is_active=false
 * 2) is_active=false 이면서 30일+ 경과 → report_data 비움 (스토리지 절감)
 */
export async function GET(request: Request) {
  const authResp = verifyCronAuth(request);
  if (authResp) return authResp;

  const supabase = createSupabaseAdminClient();

  try {
    // Step 1: 만료된 공유 비활성화
    const { data: expired, error: expireErr } = await supabase
      .from("report_shares")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("is_active", true)
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (expireErr) {
      logActionError(LOG_CTX, `만료 비활성화 오류: ${expireErr.message}`);
    }

    const deactivatedCount = expired?.length ?? 0;
    if (deactivatedCount > 0) {
      logActionWarn(LOG_CTX, `${deactivatedCount}건 만료 공유 비활성화`);
    }

    // Step 2: 30일+ 비활성 공유의 report_data 비움 (스토리지 절감)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: cleaned, error: cleanErr } = await supabase
      .from("report_shares")
      .update({ report_data: {}, updated_at: new Date().toISOString() })
      .eq("is_active", false)
      .lt("updated_at", thirtyDaysAgo)
      .not("report_data", "eq", {})
      .select("id");

    if (cleanErr) {
      logActionError(LOG_CTX, `스냅샷 정리 오류: ${cleanErr.message}`);
    }

    const cleanedCount = cleaned?.length ?? 0;

    return NextResponse.json({
      message: "Report share expiry processed",
      date: new Date().toISOString(),
      deactivatedCount,
      cleanedCount,
    });
  } catch (error) {
    logActionError(LOG_CTX, `오류: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
