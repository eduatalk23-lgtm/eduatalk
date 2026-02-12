/**
 * Google Calendar 연결 상태 조회 서비스
 * 설정 UI에서 사용
 */

import { logActionError } from "@/lib/logging/actionLogger";
import type { GoogleOAuthToken } from "./types";

const ACTION_CTX = { domain: "googleCalendar", action: "settings" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

function tokenTable(client: SupabaseAny) {
  return client.from("google_oauth_tokens");
}

export interface GoogleCalendarConnectionStatus {
  connected: boolean;
  googleEmail: string | null;
  calendarId: string;
  connectedAt: string | null;
  lastSyncAt: string | null;
  syncEnabled: boolean;
}

/** 관리자의 Google Calendar 연결 상태 조회 */
export async function getConnectionStatus(
  client: SupabaseAny,
  adminUserId: string
): Promise<GoogleCalendarConnectionStatus> {
  try {
    const { data } = await tokenTable(client)
      .select("google_email, calendar_id, connected_at, last_sync_at, sync_enabled")
      .eq("admin_user_id", adminUserId)
      .maybeSingle();

    if (!data) {
      return {
        connected: false,
        googleEmail: null,
        calendarId: "primary",
        connectedAt: null,
        lastSyncAt: null,
        syncEnabled: false,
      };
    }

    const row = data as Pick<
      GoogleOAuthToken,
      "google_email" | "calendar_id" | "connected_at" | "last_sync_at" | "sync_enabled"
    >;

    return {
      connected: true,
      googleEmail: row.google_email,
      calendarId: row.calendar_id,
      connectedAt: row.connected_at,
      lastSyncAt: row.last_sync_at,
      syncEnabled: row.sync_enabled,
    };
  } catch (error) {
    logActionError(ACTION_CTX, error, { context: "getConnectionStatus", adminUserId });
    return {
      connected: false,
      googleEmail: null,
      calendarId: "primary",
      connectedAt: null,
      lastSyncAt: null,
      syncEnabled: false,
    };
  }
}

/** 동기화 큐 통계 조회 (status별 COUNT) */
export async function getSyncQueueStats(
  client: SupabaseAny,
  tenantId: string
): Promise<{ pending: number; failed: number; completed: number }> {
  const result = { pending: 0, failed: 0, completed: 0 };

  try {
    const counts = await Promise.all([
      client
        .from("google_calendar_sync_queue")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "pending"),
      client
        .from("google_calendar_sync_queue")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "failed"),
      client
        .from("google_calendar_sync_queue")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "completed"),
    ]);

    result.pending = counts[0].count ?? 0;
    result.failed = counts[1].count ?? 0;
    result.completed = counts[2].count ?? 0;

    return result;
  } catch (error) {
    logActionError(ACTION_CTX, error, { context: "getSyncQueueStats" });
    return result;
  }
}
