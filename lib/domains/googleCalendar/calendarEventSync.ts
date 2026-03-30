/**
 * Calendar Events → Google Calendar 동기화
 *
 * - mapCalendarEventToGoogleEvent: calendar_events → Google event body
 * - syncCalendarEventToGoogle: CRUD 연동 (fire-and-forget)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { google } from 'googleapis';
import { createAuthenticatedClient } from './oauth';
import { getTokenByAdminUser, refreshTokenIfNeeded, updateLastSyncAt } from './tokenService';
import { toGoogleEventBody } from './eventMapper';
import { logActionError, logActionDebug } from '@/lib/logging/actionLogger';
import type { GoogleCalendarEventData, GoogleOAuthToken, SyncAction } from './types';
import type { EventMetadata } from '@/lib/domains/calendar/types';

const ACTION_CTX = { domain: 'googleCalendar', action: 'calendarEventSync' };

type TypedSupabaseClient = SupabaseClient<Database>;

/** calendar_events 행 (필요한 필드만) */
interface CalendarEventRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string | null;
  end_at: string | null;
  start_date: string | null;
  end_date: string | null;
  is_all_day: boolean | null;
  label: string;
  is_task: boolean;
  is_exclusion: boolean;
  color: string | null;
  student_id: string;
  tenant_id: string;
  metadata: EventMetadata | null;
}

/** 라벨 → Google Calendar 색상 ID */
const LABEL_GOOGLE_COLOR: Record<string, string> = {
  '학습': '1',       // Lavender (파랑)
  '학원': '3',       // Grape (보라)
  '이동시간': '3',   // Grape (보라)
  '제외일': '11',    // Tomato (빨강)
  '휴식': '2',       // Sage (초록)
  '수면': '8',       // Graphite (회색)
};

/**
 * calendar_events → Google Calendar 이벤트 데이터 매핑
 */
export function mapCalendarEventToGoogleEvent(
  event: CalendarEventRow,
): GoogleCalendarEventData | null {
  // 종일 이벤트
  if (event.is_all_day && event.start_date) {
    return {
      summary: event.title,
      description: event.description ?? '',
      location: event.location,
      // Google Calendar all-day: date만 사용 (no dateTime)
      startDateTime: event.start_date,
      endDateTime: event.end_date ?? event.start_date,
      colorId: LABEL_GOOGLE_COLOR[event.label] ?? '8',
      extendedProperties: {
        private: {
          timelevelup_schedule_id: event.id,
          timelevelup_tenant_id: event.tenant_id,
        },
      },
    };
  }

  // 시간 이벤트
  if (!event.start_at || !event.end_at) return null;

  return {
    summary: event.title,
    description: event.description ?? '',
    location: event.location,
    startDateTime: event.start_at,
    endDateTime: event.end_at,
    colorId: event.color
      ? mapAppColorToGoogleColorId(event.color)
      : (LABEL_GOOGLE_COLOR[event.label] ?? '8'),
    extendedProperties: {
      private: {
        timelevelup_schedule_id: event.id,
        timelevelup_tenant_id: event.tenant_id,
      },
    },
  };
}

/** 앱 색상(hex/name) → Google Calendar colorId 근사 매핑 */
function mapAppColorToGoogleColorId(color: string): string {
  const c = color.toLowerCase();
  if (c.includes('blue') || c.includes('#3b82f6')) return '1';  // Lavender
  if (c.includes('green') || c.includes('#22c55e')) return '2'; // Sage
  if (c.includes('purple') || c.includes('#a855f7')) return '3'; // Grape
  if (c.includes('red') || c.includes('#ef4444')) return '11';  // Tomato
  if (c.includes('orange') || c.includes('#f97316')) return '6'; // Tangerine
  if (c.includes('yellow') || c.includes('#eab308')) return '5'; // Banana
  if (c.includes('pink') || c.includes('#ec4899')) return '4';  // Flamingo
  if (c.includes('teal') || c.includes('#14b8a6')) return '7';  // Peacock
  return '8'; // Graphite (default)
}

// ============================================
// Sync operations
// ============================================

/**
 * calendar_events → Google Calendar 동기화 (1건)
 *
 * fire-and-forget 패턴: 성공/실패를 반환하되 예외는 throw하지 않음
 */
export async function syncCalendarEventToGoogle(
  adminClient: TypedSupabaseClient,
  eventId: string,
  adminUserId: string,
  action: SyncAction,
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 이벤트 조회
    const { data: event, error: fetchError } = await adminClient
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !event) {
      return { success: false, error: '이벤트를 찾을 수 없습니다.' };
    }

    // metadata는 DB에서 Json으로 반환되지만 실제로는 EventMetadata 구조
    const typedEvent = event as typeof event & { metadata: EventMetadata | null };

    // 2. 토큰 조회
    const token = await getTokenByAdminUser(adminClient, adminUserId);
    if (!token) {
      await updateMetadataSyncStatus(adminClient, eventId, typedEvent.metadata, 'not_applicable');
      return { success: true }; // 미연결 → 동기화 불필요
    }

    // 3. 토큰 갱신
    const freshToken = await refreshTokenIfNeeded(adminClient, token);

    // 4. 액션별 처리
    switch (action) {
      case 'create':
        return await createCalendarGoogleEvent(adminClient, typedEvent, freshToken);
      case 'update':
        return await updateCalendarGoogleEvent(adminClient, typedEvent, freshToken);
      case 'cancel':
        return await cancelCalendarGoogleEvent(adminClient, typedEvent, freshToken);
    }
  } catch (error) {
    logActionError(ACTION_CTX, error, { eventId, action });
    return { success: false, error: String(error) };
  }
}

async function createCalendarGoogleEvent(
  adminClient: TypedSupabaseClient,
  event: CalendarEventRow & { metadata: EventMetadata | null },
  token: GoogleOAuthToken,
): Promise<{ success: boolean; error?: string }> {
  const mapped = mapCalendarEventToGoogleEvent(event);
  if (!mapped) return { success: false, error: '이벤트 매핑 실패 (시간 정보 없음)' };

  const oauth2Client = createAuthenticatedClient({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const body = toCalendarEventBody(mapped, event.is_all_day ?? false);

  const res = await calendar.events.insert({
    calendarId: token.calendar_id || 'primary',
    requestBody: body,
  });

  const googleEventId = res.data.id;
  if (googleEventId) {
    await updateMetadataSyncStatus(adminClient, event.id, event.metadata, 'synced', {
      google_event_id: googleEventId,
      google_etag: res.data.etag ?? undefined,
      google_html_link: res.data.htmlLink ?? undefined,
    });
    await updateLastSyncAt(adminClient, token.admin_user_id);
  }

  logActionDebug(ACTION_CTX, `Google Calendar 이벤트 생성: ${googleEventId}`, { eventId: event.id });
  return { success: true };
}

async function updateCalendarGoogleEvent(
  adminClient: TypedSupabaseClient,
  event: CalendarEventRow & { metadata: EventMetadata | null },
  token: GoogleOAuthToken,
): Promise<{ success: boolean; error?: string }> {
  const meta = (event.metadata ?? {}) as EventMetadata;
  const googleEventId = meta.google_event_id;
  if (!googleEventId) {
    // Google에 없으면 create로 전환
    return createCalendarGoogleEvent(adminClient, event, token);
  }

  const mapped = mapCalendarEventToGoogleEvent(event);
  if (!mapped) return { success: false, error: '이벤트 매핑 실패' };

  const oauth2Client = createAuthenticatedClient({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const body = toCalendarEventBody(mapped, event.is_all_day ?? false);

  const res = await calendar.events.update({
    calendarId: token.calendar_id || 'primary',
    eventId: googleEventId,
    requestBody: body,
  });

  await updateMetadataSyncStatus(adminClient, event.id, event.metadata, 'synced', {
    google_etag: res.data.etag ?? undefined,
  });
  await updateLastSyncAt(adminClient, token.admin_user_id);

  logActionDebug(ACTION_CTX, `Google Calendar 이벤트 업데이트: ${googleEventId}`, { eventId: event.id });
  return { success: true };
}

async function cancelCalendarGoogleEvent(
  adminClient: TypedSupabaseClient,
  event: CalendarEventRow & { metadata: EventMetadata | null },
  token: GoogleOAuthToken,
): Promise<{ success: boolean; error?: string }> {
  const meta = (event.metadata ?? {}) as EventMetadata;
  const googleEventId = meta.google_event_id;
  if (!googleEventId) {
    return { success: true }; // Google에 없으면 삭제할 것도 없음
  }

  const oauth2Client = createAuthenticatedClient({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  await calendar.events.delete({
    calendarId: token.calendar_id || 'primary',
    eventId: googleEventId,
  });

  await updateMetadataSyncStatus(adminClient, event.id, event.metadata, 'not_applicable', {
    google_event_id: undefined,
    google_etag: undefined,
    google_html_link: undefined,
  });

  logActionDebug(ACTION_CTX, `Google Calendar 이벤트 삭제: ${googleEventId}`, { eventId: event.id });
  return { success: true };
}

// ============================================
// Helpers
// ============================================

/** metadata 내 google_sync_status 업데이트 */
async function updateMetadataSyncStatus(
  adminClient: TypedSupabaseClient,
  eventId: string,
  currentMetadata: EventMetadata | null,
  status: EventMetadata['google_sync_status'],
  extra?: Partial<EventMetadata>,
) {
  const merged: EventMetadata = {
    ...(currentMetadata ?? {}),
    google_sync_status: status,
    ...extra,
  };

  await adminClient
    .from('calendar_events')
    .update({ metadata: merged })
    .eq('id', eventId);
}

/** Google Calendar API 요청 body 변환 (종일 이벤트 대응) */
function toCalendarEventBody(
  event: GoogleCalendarEventData,
  isAllDay: boolean,
) {
  if (isAllDay) {
    return {
      summary: event.summary,
      description: event.description,
      location: event.location ?? undefined,
      start: { date: event.startDateTime },
      end: { date: event.endDateTime },
      colorId: event.colorId,
      extendedProperties: event.extendedProperties,
    };
  }

  return toGoogleEventBody(event);
}

// ============================================
// Fire-and-forget enqueue (calendar_events용)
// ============================================

/**
 * calendar_events CRUD 후 Google Calendar 동기화를 비동기로 트리거
 *
 * 기존 enqueueGoogleCalendarSync 패턴과 동일:
 * 1. 즉시 동기화 시도
 * 2. 실패 시 로그만 남김 (calendar_events용 별도 큐는 향후 추가)
 * 3. 어떤 경우든 예외를 throw하지 않음
 */
export async function enqueueCalendarEventSync(params: {
  eventId: string;
  tenantId: string;
  adminUserId: string;
  action: SyncAction;
}): Promise<void> {
  try {
    const { getSupabaseClientForRLSBypass } = await import('@/lib/supabase/clientSelector');
    const adminClient = await getSupabaseClientForRLSBypass({
      forceAdmin: true,
      fallbackToServer: false,
    });

    if (!adminClient) {
      logActionDebug(ACTION_CTX, 'Admin client 없음, 동기화 건너뜀');
      return;
    }

    const result = await syncCalendarEventToGoogle(
      adminClient,
      params.eventId,
      params.adminUserId,
      params.action,
    );

    if (!result.success) {
      logActionDebug(ACTION_CTX, `동기화 실패: ${result.error}`, {
        eventId: params.eventId,
        action: params.action,
      });
    }
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: 'enqueueCalendarEventSync',
      eventId: params.eventId,
      action: params.action,
    });
  }
}
