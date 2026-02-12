/**
 * Google Calendar Webhook 처리 + Webhook 등록/갱신
 *
 * Phase 2: Google → App 양방향 동기화
 */

import { google } from "googleapis";
import { createAuthenticatedClient } from "./oauth";
import {
  getTokenByAdminUser,
  getTokensByTenant,
  refreshTokenIfNeeded,
} from "./tokenService";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";

const ACTION_CTX = { domain: "googleCalendar", action: "webhook" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

function scheduleTable(client: SupabaseAny) {
  return client.from("consultation_schedules");
}

interface WebhookNotification {
  channelId: string;
  resourceId: string;
  resourceState: string;
}

/**
 * Google Calendar webhook 알림 처리
 *
 * 1. channelId로 연결된 admin_user 찾기
 * 2. incremental sync로 변경된 이벤트 조회
 * 3. extendedProperties로 우리 이벤트 필터링
 * 4. 변경 사항을 consultation_schedules에 반영
 */
export async function processWebhookNotification(
  adminClient: SupabaseAny,
  notification: WebhookNotification
): Promise<void> {
  try {
    // channelId 형식: "gcal-{adminUserId}" (registerWebhook에서 설정)
    const adminUserId = notification.channelId.replace("gcal-", "");
    if (!adminUserId || adminUserId === notification.channelId) {
      logActionDebug(ACTION_CTX, "알 수 없는 채널 ID", {
        channelId: notification.channelId,
      });
      return;
    }

    const token = await getTokenByAdminUser(adminClient, adminUserId);
    if (!token) return;

    const refreshedToken = await refreshTokenIfNeeded(adminClient, token);
    const auth = createAuthenticatedClient(refreshedToken);
    const calendar = google.calendar({ version: "v3", auth });

    // 최근 변경된 이벤트 조회 (최근 5분)
    const timeMin = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data } = await calendar.events.list({
      calendarId: refreshedToken.calendar_id,
      updatedMin: timeMin,
      singleEvents: true,
      maxResults: 50,
    });

    const events = data.items ?? [];

    for (const event of events) {
      const scheduleId =
        event.extendedProperties?.private?.timelevelup_schedule_id;

      if (!scheduleId) continue; // 우리 이벤트가 아님

      // 삭제된 이벤트
      if (event.status === "cancelled") {
        await scheduleTable(adminClient)
          .update({
            status: "cancelled",
            google_calendar_event_id: null,
            google_sync_status: "synced",
            updated_at: new Date().toISOString(),
          })
          .eq("id", scheduleId);

        logActionDebug(ACTION_CTX, "Google에서 이벤트 삭제됨 → 앱 취소", {
          scheduleId,
        });
        continue;
      }

      // 시간 변경 감지
      if (event.start?.dateTime && event.end?.dateTime) {
        // KST로 변환하여 날짜/시간 추출
        const startDate = new Date(event.start.dateTime);
        const endDate = new Date(event.end.dateTime);

        const kstStart = new Date(startDate.getTime() + 9 * 60 * 60 * 1000);
        const kstEnd = new Date(endDate.getTime() + 9 * 60 * 60 * 1000);

        const scheduledDate = kstStart.toISOString().split("T")[0];
        const startTime = kstStart.toISOString().slice(11, 16);
        const endTime = kstEnd.toISOString().slice(11, 16);

        // Google event의 updated vs DB의 updated_at 비교 (last-write-wins)
        const { data: existing } = await scheduleTable(adminClient)
          .select("updated_at, google_sync_status")
          .eq("id", scheduleId)
          .maybeSingle();

        if (existing && event.updated) {
          const row = existing as { updated_at: string; google_sync_status: string };

          // 앱에서 방금 동기화한 건이면 skip (무한 루프 방지)
          if (row.google_sync_status === "synced") {
            const dbUpdated = new Date(row.updated_at).getTime();
            const timeSinceUpdate = Date.now() - dbUpdated;
            // 30초 이내에 synced 상태면 앱에서 방금 보낸 변경으로 간주
            if (timeSinceUpdate < 30 * 1000) {
              continue;
            }
          }

          const googleUpdated = new Date(event.updated).getTime();
          const dbUpdated = new Date(row.updated_at).getTime();

          // Google 쪽이 더 최신이면 DB 업데이트
          if (googleUpdated > dbUpdated) {
            await scheduleTable(adminClient)
              .update({
                scheduled_date: scheduledDate,
                start_time: startTime,
                end_time: endTime,
                description: event.description ?? null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", scheduleId);

            logActionDebug(ACTION_CTX, "Google에서 이벤트 수정됨 → 앱 반영", {
              scheduleId,
            });
          }
        }
      }
    }
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: "processWebhookNotification",
      channelId: notification.channelId,
    });
  }
}

/**
 * Google Calendar webhook 등록
 * 캘린더 연결 시 또는 webhook 갱신 cron에서 호출
 */
export async function registerWebhook(
  adminClient: SupabaseAny,
  adminUserId: string,
  webhookUrl: string
): Promise<{ success: boolean; expiration?: string }> {
  try {
    const token = await getTokenByAdminUser(adminClient, adminUserId);
    if (!token) {
      return { success: false };
    }

    const refreshedToken = await refreshTokenIfNeeded(adminClient, token);
    const auth = createAuthenticatedClient(refreshedToken);
    const calendar = google.calendar({ version: "v3", auth });

    const channelId = `gcal-${adminUserId}`;

    const res = await calendar.events.watch({
      calendarId: refreshedToken.calendar_id,
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
      },
    });

    const expiration = res.data.expiration
      ? new Date(Number(res.data.expiration)).toISOString()
      : undefined;

    logActionDebug(ACTION_CTX, "Webhook 등록 성공", {
      adminUserId,
      channelId,
      expiration,
    });

    return { success: true, expiration };
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: "registerWebhook",
      adminUserId,
    });
    return { success: false };
  }
}

/**
 * 테넌트의 모든 활성 토큰에 대해 webhook 갱신
 * 주간 cron에서 호출 (Google webhook은 ~7일 만료)
 */
export async function renewWebhooksForTenant(
  adminClient: SupabaseAny,
  tenantId: string,
  webhookUrl: string
): Promise<{ renewed: number; failed: number }> {
  const result = { renewed: 0, failed: 0 };

  try {
    const tokens = await getTokensByTenant(adminClient, tenantId);

    for (const token of tokens) {
      const res = await registerWebhook(
        adminClient,
        token.admin_user_id,
        webhookUrl
      );
      if (res.success) {
        result.renewed++;
      } else {
        result.failed++;
      }
    }
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: "renewWebhooksForTenant",
      tenantId,
    });
  }

  return result;
}
