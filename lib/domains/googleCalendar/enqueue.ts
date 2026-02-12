/**
 * Google Calendar 동기화 큐 삽입 (fire-and-forget)
 *
 * 패턴: sendScheduleNotification()과 동일
 * - try-catch로 감싸서 실패해도 메인 액션 미차단
 * - 즉시 동기화 시도 → 실패 시 큐에 삽입
 */

import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { createGoogleEvent, updateGoogleEvent, cancelGoogleEvent } from "./syncService";
import type { SyncAction } from "./types";

const ACTION_CTX = { domain: "googleCalendar", action: "enqueue" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

function queueTable(client: SupabaseAny) {
  return client.from("google_calendar_sync_queue");
}

/**
 * 상담 일정 생성/수정/취소 시 Google Calendar 동기화를 트리거
 *
 * 1. 즉시 동기화 시도
 * 2. 실패하면 큐에 삽입 (cron에서 재시도)
 * 3. 어떤 경우든 예외를 throw하지 않음 (fire-and-forget)
 */
export async function enqueueGoogleCalendarSync(params: {
  scheduleId: string;
  tenantId: string;
  consultantId: string;
  action: SyncAction;
}): Promise<void> {
  try {
    const adminClient = await getSupabaseClientForRLSBypass({
      forceAdmin: true,
      fallbackToServer: false,
    });

    if (!adminClient) {
      logActionDebug(ACTION_CTX, "Admin client 없음, 동기화 건너뜀");
      return;
    }

    // 즉시 동기화 시도
    let result: { success: boolean; error?: string };

    switch (params.action) {
      case "create":
        result = await createGoogleEvent(
          adminClient,
          params.scheduleId,
          params.consultantId
        );
        break;
      case "update":
        result = await updateGoogleEvent(
          adminClient,
          params.scheduleId,
          params.consultantId
        );
        break;
      case "cancel":
        result = await cancelGoogleEvent(
          adminClient,
          params.scheduleId,
          params.consultantId
        );
        break;
    }

    if (result.success) {
      logActionDebug(ACTION_CTX, `즉시 동기화 성공: ${params.action}`, {
        scheduleId: params.scheduleId,
      });
      return;
    }

    // 즉시 동기화 실패 → 큐에 삽입
    logActionDebug(ACTION_CTX, `즉시 동기화 실패, 큐에 삽입: ${result.error}`, {
      scheduleId: params.scheduleId,
    });

    await queueTable(adminClient).insert({
      tenant_id: params.tenantId,
      schedule_id: params.scheduleId,
      action: params.action,
      target: "personal",
      admin_user_id: params.consultantId,
      status: "pending",
    });
  } catch (error) {
    // fire-and-forget: 큐 삽입까지 실패해도 메인 액션 차단 안 함
    logActionError(ACTION_CTX, error, {
      context: "enqueueGoogleCalendarSync",
      scheduleId: params.scheduleId,
      action: params.action,
    });
  }
}
