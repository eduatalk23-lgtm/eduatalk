/**
 * Push 정리 Cron Job
 *
 * 매일 새벽 3시(KST, UTC 18:00)에 실행.
 * 1. Dead Token 정리: 30일 이상 미갱신된 비활성 push_subscriptions 삭제
 * 2. notification_log 보존 정책: 90일 초과 로그 삭제
 * 3. push_dlq 정리: 30일 초과 resolved DLQ 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, randomBytes } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  const expectedApiKey = process.env.CRON_SECRET;

  if (!expectedApiKey) {
    console.error("[push-cleanup] CRON_SECRET이 설정되지 않았습니다.");
    return false;
  }

  if (!apiKey) return false;

  try {
    const bufA = Buffer.from(apiKey);
    const bufB = Buffer.from(expectedApiKey);
    if (bufA.length !== bufB.length) {
      const randomBuf = randomBytes(bufA.length);
      timingSafeEqual(bufA, randomBuf);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const results = {
    deadTokensDeleted: 0,
    logsDeleted: 0,
    dlqCleaned: 0,
    errors: [] as string[],
  };

  try {
    // 1. Dead Token 정리: 30일 이상 미갱신 + 비활성 구독 삭제
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    // count만 반환하여 대량 삭제 시 메모리 부담 방지
    const { count: deadCount, error: deadErr } = await supabase
      .from("push_subscriptions")
      .delete({ count: "exact" })
      .eq("is_active", false)
      .lt("updated_at", thirtyDaysAgo);

    if (deadErr) {
      results.errors.push(`Dead tokens: ${deadErr.message}`);
    } else {
      results.deadTokensDeleted = deadCount ?? 0;
    }

    // 2. notification_log 보존 정책: 90일 초과 삭제
    const ninetyDaysAgo = new Date(
      Date.now() - 90 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { count: logCount, error: logErr } = await supabase
      .from("notification_log")
      .delete({ count: "exact" })
      .lt("sent_at", ninetyDaysAgo);

    if (logErr) {
      results.errors.push(`Notification log: ${logErr.message}`);
    } else {
      results.logsDeleted = logCount ?? 0;
    }

    // 3. push_dlq 정리: 30일 초과 resolved DLQ 삭제
    const { count: dlqCount, error: dlqErr } = await supabase
      .from("push_dlq")
      .delete({ count: "exact" })
      .not("resolved_at", "is", null)
      .lt("created_at", thirtyDaysAgo);

    if (dlqErr) {
      results.errors.push(`DLQ cleanup: ${dlqErr.message}`);
    } else {
      results.dlqCleaned = dlqCount ?? 0;
    }

    return NextResponse.json({
      success: results.errors.length === 0,
      ...results,
    });
  } catch (error) {
    console.error("[push-cleanup] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
