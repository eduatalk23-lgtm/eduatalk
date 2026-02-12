/**
 * Google Calendar 동기화 핵심 서비스
 * - createGoogleEvent: 일정 생성 시 Google Calendar에 이벤트 생성
 * - updateGoogleEvent: 일정 수정 시 이벤트 업데이트
 * - cancelGoogleEvent: 일정 취소 시 이벤트 삭제
 */

import { google } from "googleapis";
import { createAuthenticatedClient } from "./oauth";
import { getTokenByAdminUser, refreshTokenIfNeeded, updateLastSyncAt } from "./tokenService";
import { mapScheduleToEvent, toGoogleEventBody } from "./eventMapper";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import type { GoogleOAuthToken } from "./types";

const ACTION_CTX = { domain: "googleCalendar", action: "sync" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

function scheduleTable(client: SupabaseAny) {
  return client.from("consultation_schedules");
}

interface ScheduleRow {
  id: string;
  tenant_id: string;
  student_id: string;
  consultant_id: string;
  session_type: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  description: string | null;
  google_calendar_event_id: string | null;
  google_shared_calendar_event_id: string | null;
  student?: { name: string } | null;
  consultant?: { name: string } | null;
  enrollment?: { programs?: { name: string } | { name: string }[] | null } | null;
}

/**
 * 상담 일정에 대한 Google Calendar 이벤트 생성
 */
export async function createGoogleEvent(
  adminClient: SupabaseAny,
  scheduleId: string,
  consultantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const schedule = await fetchScheduleWithJoins(adminClient, scheduleId);
    if (!schedule) {
      return { success: false, error: "일정을 찾을 수 없습니다." };
    }

    const token = await getTokenByAdminUser(adminClient, consultantId);
    if (!token) {
      // 토큰 없음 = 미연결 상태이므로 not_applicable
      await updateSyncStatus(adminClient, scheduleId, "not_applicable");
      return { success: true }; // 동기화 불필요
    }

    const refreshedToken = await refreshTokenIfNeeded(adminClient, token);
    const eventData = mapScheduleToEvent({
      id: schedule.id,
      tenant_id: schedule.tenant_id,
      student_name: schedule.student?.name ?? "학생",
      session_type: schedule.session_type,
      scheduled_date: schedule.scheduled_date,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      location: schedule.location,
      description: schedule.description,
      consultant_name: schedule.consultant?.name ?? "",
      program_name: extractProgramName(schedule.enrollment),
    });

    const eventId = await insertGoogleCalendarEvent(
      refreshedToken,
      toGoogleEventBody(eventData)
    );

    if (!eventId) {
      await updateSyncStatus(adminClient, scheduleId, "failed");
      return { success: false, error: "Google 이벤트 ID를 받지 못했습니다." };
    }

    await scheduleTable(adminClient)
      .update({
        google_calendar_event_id: eventId,
        google_sync_status: "synced",
      })
      .eq("id", scheduleId);

    await updateLastSyncAt(adminClient, consultantId);

    logActionDebug(ACTION_CTX, "Google 이벤트 생성 성공", {
      scheduleId,
      eventId,
    });

    return { success: true };
  } catch (error) {
    logActionError(ACTION_CTX, error, { context: "createGoogleEvent", scheduleId });
    await updateSyncStatus(adminClient, scheduleId, "failed");
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
  scheduleId: string,
  consultantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const schedule = await fetchScheduleWithJoins(adminClient, scheduleId);
    if (!schedule) {
      return { success: false, error: "일정을 찾을 수 없습니다." };
    }

    if (!schedule.google_calendar_event_id) {
      // 기존 이벤트가 없으면 새로 생성
      return createGoogleEvent(adminClient, scheduleId, consultantId);
    }

    const token = await getTokenByAdminUser(adminClient, consultantId);
    if (!token) {
      return { success: true }; // 미연결
    }

    const refreshedToken = await refreshTokenIfNeeded(adminClient, token);
    const eventData = mapScheduleToEvent({
      id: schedule.id,
      tenant_id: schedule.tenant_id,
      student_name: schedule.student?.name ?? "학생",
      session_type: schedule.session_type,
      scheduled_date: schedule.scheduled_date,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      location: schedule.location,
      description: schedule.description,
      consultant_name: schedule.consultant?.name ?? "",
      program_name: extractProgramName(schedule.enrollment),
    });

    const auth = createAuthenticatedClient(refreshedToken);
    const calendar = google.calendar({ version: "v3", auth });

    await calendar.events.update({
      calendarId: refreshedToken.calendar_id,
      eventId: schedule.google_calendar_event_id,
      requestBody: toGoogleEventBody(eventData),
    });

    await updateSyncStatus(adminClient, scheduleId, "synced");
    await updateLastSyncAt(adminClient, consultantId);

    logActionDebug(ACTION_CTX, "Google 이벤트 업데이트 성공", {
      scheduleId,
      eventId: schedule.google_calendar_event_id,
    });

    return { success: true };
  } catch (error) {
    logActionError(ACTION_CTX, error, { context: "updateGoogleEvent", scheduleId });
    await updateSyncStatus(adminClient, scheduleId, "failed");
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
  scheduleId: string,
  consultantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: schedule } = await scheduleTable(adminClient)
      .select("google_calendar_event_id, google_shared_calendar_event_id")
      .eq("id", scheduleId)
      .maybeSingle();

    if (!schedule) {
      return { success: false, error: "일정을 찾을 수 없습니다." };
    }

    const row = schedule as {
      google_calendar_event_id: string | null;
      google_shared_calendar_event_id: string | null;
    };

    if (!row.google_calendar_event_id) {
      return { success: true }; // 동기화된 이벤트 없음
    }

    const token = await getTokenByAdminUser(adminClient, consultantId);
    if (!token) {
      return { success: true };
    }

    const refreshedToken = await refreshTokenIfNeeded(adminClient, token);
    const auth = createAuthenticatedClient(refreshedToken);
    const calendar = google.calendar({ version: "v3", auth });

    // 개인 캘린더 이벤트 삭제
    try {
      await calendar.events.delete({
        calendarId: refreshedToken.calendar_id,
        eventId: row.google_calendar_event_id,
      });
    } catch (deleteError) {
      // 404 = 이미 삭제됨 → 무시
      const err = deleteError as { code?: number };
      if (err.code !== 404) throw deleteError;
    }

    await scheduleTable(adminClient)
      .update({
        google_calendar_event_id: null,
        google_sync_status: "synced",
      })
      .eq("id", scheduleId);

    logActionDebug(ACTION_CTX, "Google 이벤트 삭제 성공", { scheduleId });
    return { success: true };
  } catch (error) {
    logActionError(ACTION_CTX, error, { context: "cancelGoogleEvent", scheduleId });
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

async function fetchScheduleWithJoins(
  client: SupabaseAny,
  scheduleId: string
): Promise<ScheduleRow | null> {
  const { data, error } = await scheduleTable(client)
    .select(`
      *,
      student:students!student_id(name),
      consultant:admin_users!consultant_id(name),
      enrollment:enrollments!enrollment_id(id, programs(name))
    `)
    .eq("id", scheduleId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ScheduleRow;
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

async function updateSyncStatus(
  client: SupabaseAny,
  scheduleId: string,
  status: "synced" | "failed" | "not_applicable"
): Promise<void> {
  await scheduleTable(client)
    .update({ google_sync_status: status })
    .eq("id", scheduleId);
}

function extractProgramName(
  enrollment: ScheduleRow["enrollment"]
): string | undefined {
  if (!enrollment?.programs) return undefined;
  const prog = enrollment.programs;
  return Array.isArray(prog) ? prog[0]?.name : prog.name;
}
