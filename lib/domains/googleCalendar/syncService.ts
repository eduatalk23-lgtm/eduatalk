/**
 * Google Calendar 동기화 핵심 서비스
 * - createGoogleEvent: 일정 생성 시 Google Calendar에 이벤트 생성
 * - updateGoogleEvent: 일정 수정 시 이벤트 업데이트
 * - cancelGoogleEvent: 일정 취소 시 이벤트 삭제
 *
 * Phase 4: calendar_events + consultation_event_data 기반으로 전환
 */

import { google } from "googleapis";
import { createAuthenticatedClient } from "./oauth";
import { getTokenByAdminUser, refreshTokenIfNeeded, updateLastSyncAt } from "./tokenService";
import { mapScheduleToEvent, toGoogleEventBody } from "./eventMapper";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import type { GoogleOAuthToken } from "./types";
import { extractDateYMD, extractTimeHHMM } from "@/lib/domains/calendar/adapters";

const ACTION_CTX = { domain: "googleCalendar", action: "sync" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

interface ConsultationEventRow {
  // calendar_events fields
  id: string;
  title: string | null;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  location: string | null;
  tenant_id: string | null;
  student_id: string | null;
  // consultation_event_data fields (nested)
  consultation_event_data: {
    consultant_id: string;
    session_type: string;
    program_name: string | null;
    google_calendar_event_id: string | null;
    google_shared_calendar_event_id: string | null;
    enrollment_id: string | null;
  } | null;
  // JOINed relations
  student?: { name: string } | null;
}

/**
 * 상담 이벤트에 대한 Google Calendar 이벤트 생성
 * @param eventId - calendar_events.id
 */
export async function createGoogleEvent(
  adminClient: SupabaseAny,
  eventId: string,
  consultantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const event = await fetchEventWithConsultationData(adminClient, eventId);
    if (!event || !event.consultation_event_data) {
      return { success: false, error: "상담 이벤트를 찾을 수 없습니다." };
    }

    const token = await getTokenByAdminUser(adminClient, consultantId);
    if (!token) {
      await updateConsultationSyncStatus(adminClient, eventId, "not_applicable");
      return { success: true };
    }

    const consultantName = await fetchConsultantName(adminClient, consultantId);
    const refreshedToken = await refreshTokenIfNeeded(adminClient, token);
    const cd = event.consultation_event_data;

    const eventData = mapScheduleToEvent({
      id: event.id,
      tenant_id: event.tenant_id ?? "",
      student_name: event.student?.name ?? "학생",
      session_type: cd.session_type,
      scheduled_date: extractDateYMD(event.start_at ?? "") ?? "",
      start_time: extractTimeHHMM(event.start_at ?? "") ?? "",
      end_time: extractTimeHHMM(event.end_at ?? "") ?? "",
      location: event.location,
      description: event.description,
      consultant_name: consultantName,
      program_name: cd.program_name ?? undefined,
    });

    const gcalEventId = await insertGoogleCalendarEvent(
      refreshedToken,
      toGoogleEventBody(eventData)
    );

    if (!gcalEventId) {
      await updateConsultationSyncStatus(adminClient, eventId, "failed");
      return { success: false, error: "Google 이벤트 ID를 받지 못했습니다." };
    }

    await adminClient
      .from("consultation_event_data")
      .update({
        google_calendar_event_id: gcalEventId,
        google_sync_status: "synced",
      })
      .eq("event_id", eventId);

    await updateLastSyncAt(adminClient, consultantId);

    logActionDebug(ACTION_CTX, "Google 이벤트 생성 성공", { eventId, gcalEventId });
    return { success: true };
  } catch (error) {
    logActionError(ACTION_CTX, error, { context: "createGoogleEvent", eventId });
    await updateConsultationSyncStatus(adminClient, eventId, "failed");
    return {
      success: false,
      error: error instanceof Error ? error.message : "이벤트 생성 실패",
    };
  }
}

/**
 * Google Calendar 이벤트 업데이트
 */
export async function updateGoogleEvent(
  adminClient: SupabaseAny,
  eventId: string,
  consultantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const event = await fetchEventWithConsultationData(adminClient, eventId);
    if (!event || !event.consultation_event_data) {
      return { success: false, error: "상담 이벤트를 찾을 수 없습니다." };
    }

    const cd = event.consultation_event_data;

    if (!cd.google_calendar_event_id) {
      return createGoogleEvent(adminClient, eventId, consultantId);
    }

    const token = await getTokenByAdminUser(adminClient, consultantId);
    if (!token) {
      return { success: true };
    }

    const consultantName = await fetchConsultantName(adminClient, consultantId);
    const refreshedToken = await refreshTokenIfNeeded(adminClient, token);

    const eventData = mapScheduleToEvent({
      id: event.id,
      tenant_id: event.tenant_id ?? "",
      student_name: event.student?.name ?? "학생",
      session_type: cd.session_type,
      scheduled_date: extractDateYMD(event.start_at ?? "") ?? "",
      start_time: extractTimeHHMM(event.start_at ?? "") ?? "",
      end_time: extractTimeHHMM(event.end_at ?? "") ?? "",
      location: event.location,
      description: event.description,
      consultant_name: consultantName,
      program_name: cd.program_name ?? undefined,
    });

    const auth = createAuthenticatedClient(refreshedToken);
    const calendar = google.calendar({ version: "v3", auth });

    await calendar.events.update({
      calendarId: refreshedToken.calendar_id,
      eventId: cd.google_calendar_event_id,
      requestBody: toGoogleEventBody(eventData),
    });

    await updateConsultationSyncStatus(adminClient, eventId, "synced");
    await updateLastSyncAt(adminClient, consultantId);

    logActionDebug(ACTION_CTX, "Google 이벤트 업데이트 성공", {
      eventId,
      gcalEventId: cd.google_calendar_event_id,
    });

    return { success: true };
  } catch (error) {
    logActionError(ACTION_CTX, error, { context: "updateGoogleEvent", eventId });
    await updateConsultationSyncStatus(adminClient, eventId, "failed");
    return {
      success: false,
      error: error instanceof Error ? error.message : "이벤트 업데이트 실패",
    };
  }
}

/**
 * Google Calendar 이벤트 삭제 (취소)
 */
export async function cancelGoogleEvent(
  adminClient: SupabaseAny,
  eventId: string,
  consultantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: cd } = await adminClient
      .from("consultation_event_data")
      .select("google_calendar_event_id, google_shared_calendar_event_id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (!cd) {
      return { success: false, error: "상담 이벤트 데이터를 찾을 수 없습니다." };
    }

    if (!cd.google_calendar_event_id) {
      return { success: true };
    }

    const token = await getTokenByAdminUser(adminClient, consultantId);
    if (!token) {
      return { success: true };
    }

    const refreshedToken = await refreshTokenIfNeeded(adminClient, token);
    const auth = createAuthenticatedClient(refreshedToken);
    const calendar = google.calendar({ version: "v3", auth });

    try {
      await calendar.events.delete({
        calendarId: refreshedToken.calendar_id,
        eventId: cd.google_calendar_event_id,
      });
    } catch (deleteError) {
      const err = deleteError as { code?: number };
      if (err.code !== 404) throw deleteError;
    }

    await adminClient
      .from("consultation_event_data")
      .update({
        google_calendar_event_id: null,
        google_sync_status: "synced",
      })
      .eq("event_id", eventId);

    logActionDebug(ACTION_CTX, "Google 이벤트 삭제 성공", { eventId });
    return { success: true };
  } catch (error) {
    logActionError(ACTION_CTX, error, { context: "cancelGoogleEvent", eventId });
    return {
      success: false,
      error: error instanceof Error ? error.message : "이벤트 삭제 실패",
    };
  }
}

/**
 * 연결된 계정의 캘린더 목록 조회
 */
export async function listCalendars(
  token: GoogleOAuthToken
): Promise<Array<{ id: string; summary: string; primary: boolean }>> {
  try {
    const auth = createAuthenticatedClient(token);
    const calendar = google.calendar({ version: "v3", auth });

    const res = await calendar.calendarList.list();
    return (res.data.items ?? []).map((item) => ({
      id: item.id ?? "",
      summary: item.summary ?? "",
      primary: item.primary ?? false,
    }));
  } catch (error) {
    logActionError(ACTION_CTX, error, { context: "listCalendars" });
    return [];
  }
}

// ── 내부 함수 ──

async function fetchEventWithConsultationData(
  client: SupabaseAny,
  eventId: string
): Promise<ConsultationEventRow | null> {
  const { data, error } = await client
    .from("calendar_events")
    .select(`
      id, title, description, start_at, end_at, location, tenant_id, student_id,
      consultation_event_data(
        consultant_id, session_type, program_name,
        google_calendar_event_id, google_shared_calendar_event_id, enrollment_id
      ),
      student:students!student_id(name)
    `)
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return data as ConsultationEventRow;
}

async function fetchConsultantName(
  client: SupabaseAny,
  consultantId: string
): Promise<string> {
  const { data } = await client
    .from("admin_users")
    .select("name")
    .eq("id", consultantId)
    .maybeSingle();
  return (data as { name: string } | null)?.name ?? "";
}

async function insertGoogleCalendarEvent(
  token: GoogleOAuthToken,
  eventBody: ReturnType<typeof toGoogleEventBody>
): Promise<string | null> {
  const auth = createAuthenticatedClient(token);
  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.insert({
    calendarId: token.calendar_id,
    requestBody: eventBody,
  });

  return res.data.id ?? null;
}

async function updateConsultationSyncStatus(
  client: SupabaseAny,
  eventId: string,
  status: "synced" | "failed" | "not_applicable"
): Promise<void> {
  await client
    .from("consultation_event_data")
    .update({ google_sync_status: status })
    .eq("event_id", eventId);
}
