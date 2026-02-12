/**
 * Google Calendar 동기화 큐 처리 Cron
 * GET /api/cron/google-calendar-sync
 *
 * - pending/failed 큐 항목 처리
 * - 최대 3회 재시도, exponential backoff
 * - 기존 consultation-reminders 패턴 따름
 */

import { NextResponse } from "next/server";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { createGoogleEvent, updateGoogleEvent, cancelGoogleEvent } from "@/lib/domains/googleCalendar";
import { MAX_RETRY_COUNT } from "@/lib/domains/googleCalendar/types";
import type { SyncAction } from "@/lib/domains/googleCalendar/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

interface QueueRow {
  id: string;
  tenant_id: string;
  schedule_id: string;
  action: SyncAction;
  admin_user_id: string | null;
  status: string;
  retry_count: number;
}

function queueTable(client: SupabaseAny) {
  return client.from("google_calendar_sync_queue");
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = { processed: 0, succeeded: 0, failed: 0, skipped: 0 };

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

    // pending 또는 failed(재시도 가능) 큐 항목 조회 (최대 50개)
    const { data, error: queryError } = await queueTable(adminClient)
      .select("*")
      .in("status", ["pending", "failed"])
      .lt("retry_count", MAX_RETRY_COUNT)
      .order("created_at", { ascending: true })
      .limit(50);

    if (queryError) {
      console.error("[google-calendar-sync] 큐 조회 오류:", queryError);
      return NextResponse.json(
        { error: "큐 조회 실패", ...result },
        { status: 500 }
      );
    }

    const rows = (data as QueueRow[] | null) ?? [];
    result.processed = rows.length;

    if (rows.length === 0) {
      return NextResponse.json({
        message: "처리할 항목 없음",
        date: new Date().toISOString(),
        ...result,
      });
    }

    for (const row of rows) {
      if (!row.admin_user_id) {
        result.skipped++;
        await queueTable(adminClient)
          .update({ status: "failed", error_message: "admin_user_id 없음", processed_at: new Date().toISOString() })
          .eq("id", row.id);
        continue;
      }

      // processing 상태로 변경
      await queueTable(adminClient)
        .update({ status: "processing" })
        .eq("id", row.id);

      let syncResult: { success: boolean; error?: string };

      switch (row.action) {
        case "create":
          syncResult = await createGoogleEvent(adminClient, row.schedule_id, row.admin_user_id);
          break;
        case "update":
          syncResult = await updateGoogleEvent(adminClient, row.schedule_id, row.admin_user_id);
          break;
        case "cancel":
          syncResult = await cancelGoogleEvent(adminClient, row.schedule_id, row.admin_user_id);
          break;
      }

      if (syncResult.success) {
        await queueTable(adminClient)
          .update({
            status: "completed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        result.succeeded++;
      } else {
        const newRetryCount = row.retry_count + 1;
        // 상태는 "failed"로 유지 - retry_count < MAX_RETRY_COUNT 이면 다음 cron에서 재시도
        await queueTable(adminClient)
          .update({
            status: "failed",
            retry_count: newRetryCount,
            error_message: syncResult.error ?? "Unknown error",
            processed_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        result.failed++;
      }

      // Rate limit 방지
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log("[google-calendar-sync] 결과:", JSON.stringify(result));

    return NextResponse.json({
      message: "Google Calendar sync queue processed",
      date: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("[google-calendar-sync] 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error", ...result },
      { status: 500 }
    );
  }
}
