/**
 * 캘린더 기반 학원 일정 데이터 레이어
 *
 * academy_schedules → calendar_events (event_type='academy') 마이그레이션 어댑터.
 * 기존 academies.ts와 동일한 인터페이스를 calendar_events 기반으로 구현.
 *
 * 핵심 변환:
 * - 읽기: reconstructAcademyPatternsFromCalendarEvents()로 날짜별 이벤트 → 주간 패턴 복원
 * - 쓰기: generateNonStudyRecordsForDateRange()로 주간 패턴 → 날짜별 이벤트 전개
 *
 * @module lib/data/calendarAcademySchedules
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleQueryError } from "@/lib/data/core/errorHandler";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { logActionDebug } from "@/lib/logging/actionLogger";
import {
  reconstructAcademyPatternsFromCalendarEvents,
  generateNonStudyRecordsForDateRange,
} from "@/lib/domains/admin-plan/utils/nonStudyTimeGenerator";
import type { AcademyScheduleInput } from "@/lib/domains/admin-plan/utils/nonStudyTimeGenerator";
import type { AcademySchedule } from "@/lib/types/plan";
import { getSupabaseClient } from "./planGroups/utils";
import { extractTimeHHMM, extractDateYMD } from "@/lib/domains/calendar/adapters";

// ============================================
// 내부 헬퍼
// ============================================

/** 이벤트에서 날짜 추출 (start_date 우선, fallback: start_at → KST date) */
function getEventDate(evt: { start_date: string | null; start_at: string | null }): string | null {
  return evt.start_date ?? extractDateYMD(evt.start_at);
}

/** 오늘 시작 시각의 KST 타임스탬프 (start_at 기반 .gte() 필터용) */
function todayStartAtKST(): string {
  const todayDate = extractDateYMD(new Date().toISOString())!;
  return `${todayDate}T00:00:00+09:00`;
}

/**
 * 학원 이벤트 타이틀에서 학원명/과목 분리
 * 형식: "학원명 (과목)" 또는 "학원명"
 */
function parseAcademyTitle(title: string): {
  academyName: string;
  subject: string | null;
} {
  const match = title.match(/^(.+?)\s*\((.+)\)$/);
  if (match) {
    return { academyName: match[1], subject: match[2] };
  }
  return { academyName: title, subject: null };
}

/**
 * reconstructed 패턴 → AcademySchedule 변환
 */
function toAcademySchedule(
  pattern: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string;
    travel_time?: number;
  },
  representativeId: string,
  studentId: string,
  tenantId: string | null,
  createdAt?: string | null
): AcademySchedule {
  const { academyName, subject } = parseAcademyTitle(
    pattern.academy_name ?? "학원"
  );

  return {
    id: representativeId,
    tenant_id: tenantId,
    student_id: studentId,
    day_of_week: pattern.day_of_week,
    start_time: pattern.start_time,
    end_time: pattern.end_time,
    subject,
    created_at: createdAt ?? new Date().toISOString(),
    updated_at: createdAt ?? new Date().toISOString(),
    academy_name: academyName,
    travel_time: pattern.travel_time ?? 60,
  };
}

/**
 * raw academy calendar_events → AcademySchedule[] (패턴 복원 + 매핑)
 */
function eventsToAcademySchedules(
  events: Array<{
    id: string;
    tenant_id: string | null;
    student_id: string | null;
    start_at: string | null;
    end_at: string | null;
    start_date: string | null;
    event_type: string;
    event_subtype: string | null;
    title: string;
    created_at: string | null;
  }>,
  studentId: string,
  tenantId: string | null
): AcademySchedule[] {
  const patterns = reconstructAcademyPatternsFromCalendarEvents(events);

  return patterns.map((pattern) => {
    // 패턴에 매칭되는 첫 이벤트의 ID를 대표 ID로 사용
    const matchingEvent = events.find((e) => {
      const eDate = getEventDate(e);
      if (
        e.event_subtype !== "학원" ||
        !e.start_at ||
        !e.end_at ||
        !eDate
      )
        return false;
      const dayOfWeek = new Date(eDate + "T00:00:00").getDay();
      const startTime =
        (extractTimeHHMM(e.start_at) ?? "00:00") + ":00";
      const endTime =
        (extractTimeHHMM(e.end_at) ?? "00:00") + ":00";
      return (
        dayOfWeek === pattern.day_of_week &&
        startTime === pattern.start_time &&
        endTime === pattern.end_time
      );
    });

    return toAcademySchedule(
      pattern,
      matchingEvent?.id ?? crypto.randomUUID(),
      studentId,
      tenantId ?? matchingEvent?.tenant_id ?? null,
      matchingEvent?.created_at
    );
  });
}

/**
 * 학생의 활성 플래너에서 캘린더 + 기간 조회
 *
 * Calendar-First: planner.calendar_id 직접 사용 (fan-out 제거).
 */
async function resolveCalendarPeriodsForStudent(
  studentId: string,
  useAdminClient: boolean = false
): Promise<
  Array<{
    calendarId: string;
    periodStart: string;
    periodEnd: string;
  }>
> {
  const supabase = await getSupabaseClient(useAdminClient);

  // Calendar-First: calendars 직접 조회
  const { data: calendars } = await supabase
    .from("calendars")
    .select("id")
    .eq("owner_id", studentId)
    .is("deleted_at", null);

  if (!calendars?.length) return [];

  const calendarIds = calendars.map((c) => c.id);

  // 각 캘린더의 활성 plan_groups 기간 조회
  const { data: planGroups } = await supabase
    .from("plan_groups")
    .select("calendar_id, period_start, period_end")
    .in("calendar_id", calendarIds)
    .is("deleted_at", null)
    .not("status", "eq", "cancelled");

  if (!planGroups?.length) return [];

  // 캘린더별 기간 병합 (최소 start ~ 최대 end)
  const calendarPeriods = new Map<string, { start: string; end: string }>();
  for (const pg of planGroups) {
    if (!pg.calendar_id) continue;
    const existing = calendarPeriods.get(pg.calendar_id);
    if (!existing) {
      calendarPeriods.set(pg.calendar_id, {
        start: pg.period_start,
        end: pg.period_end,
      });
    } else {
      if (pg.period_start < existing.start) existing.start = pg.period_start;
      if (pg.period_end > existing.end) existing.end = pg.period_end;
    }
  }

  return calendars
    .filter((c) => calendarPeriods.has(c.id))
    .map((c) => {
      const period = calendarPeriods.get(c.id)!;
      return {
        calendarId: c.id,
        periodStart: period.start,
        periodEnd: period.end,
      };
    });
}

// ============================================
// 읽기
// ============================================

/**
 * 학생의 전체 학원 일정 조회 (calendar_events 기반, 패턴 복원)
 */
export async function getStudentAcademySchedulesFromCalendar(
  studentId: string,
  tenantId?: string | null,
  options?: { useAdminClient?: boolean }
): Promise<AcademySchedule[]> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  let query = supabase
    .from("calendar_events")
    .select(
      "id, tenant_id, student_id, start_at, end_at, start_date, event_type, event_subtype, title, created_at"
    )
    .eq("student_id", studentId)
    .eq("event_type", "academy")
    .is("deleted_at", null)
    .order("start_at", { ascending: true });

  if (tenantId) {
    query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    handleQueryError(error, {
      context:
        "[data/calendarAcademySchedules] getStudentAcademySchedulesFromCalendar",
    });
    return [];
  }

  return eventsToAcademySchedules(data ?? [], studentId, tenantId ?? null);
}

/**
 * 플랜 그룹의 학원 일정 조회 (calendar_events 기반)
 * plan_group → student_id 조회 → getStudentAcademySchedulesFromCalendar 위임
 */
export async function getAcademySchedulesFromCalendar(
  groupId: string,
  tenantId?: string | null
): Promise<AcademySchedule[]> {
  const supabase = await createSupabaseServerClient();

  const { data: planGroup } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!planGroup?.student_id) return [];

  return getStudentAcademySchedulesFromCalendar(planGroup.student_id, tenantId);
}

/**
 * 플랜 그룹의 학원 일정 조회 (source, is_locked 포함)
 */
export async function getPlanGroupAcademySchedulesFromCalendar(
  groupId: string,
  tenantId?: string | null
): Promise<
  Array<
    AcademySchedule & {
      source: "template" | "student" | "time_management";
      is_locked: boolean;
    }
  >
> {
  const schedules = await getAcademySchedulesFromCalendar(groupId, tenantId);

  return schedules.map((schedule) => ({
    ...schedule,
    source: "student" as const,
    is_locked: false,
  }));
}

// ============================================
// 쓰기
// ============================================

/**
 * 학생의 모든 활성 플래너 캘린더에 학원 일정 fan-out 삽입
 *
 * 주간 패턴 → generateNonStudyRecordsForDateRange()로 날짜별 전개 → 배치 INSERT
 */
export async function createStudentAcademySchedulesViaCalendar(
  studentId: string,
  tenantId: string,
  schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
  }>,
  useAdminClient: boolean = false
): Promise<{ success: boolean; error?: string }> {
  if (schedules.length === 0) return { success: true };

  const supabase = await getSupabaseClient(useAdminClient);

  // 기존 패턴 중복 체크
  const existing = await getStudentAcademySchedulesFromCalendar(
    studentId,
    tenantId,
    { useAdminClient }
  );
  const existingKeys = new Set(
    existing.map((s) => `${s.day_of_week}:${s.start_time}:${s.end_time}`)
  );

  const newSchedules = schedules.filter((s) => {
    // start_time을 HH:mm:ss 형식으로 정규화
    const st =
      s.start_time.length === 5 ? s.start_time + ":00" : s.start_time;
    const et = s.end_time.length === 5 ? s.end_time + ":00" : s.end_time;
    return !existingKeys.has(`${s.day_of_week}:${st}:${et}`);
  });

  if (newSchedules.length === 0) return { success: true };

  // 활성 플래너 캘린더 + 기간 조회
  const calendarPeriods = await resolveCalendarPeriodsForStudent(
    studentId,
    useAdminClient
  );

  if (calendarPeriods.length === 0) {
    if (process.env.NODE_ENV === "development") {
      logActionDebug(
        { domain: "data", action: "createStudentAcademySchedulesViaCalendar" },
        "활성 캘린더 없음 (플래너 생성 시 자연 마이그레이션 예정)",
        { studentId }
      );
    }
    return { success: true };
  }

  // AcademyScheduleInput 변환
  const academyInputs: AcademyScheduleInput[] = newSchedules.map((s) => ({
    dayOfWeek: s.day_of_week,
    startTime: s.start_time.substring(0, 5), // HH:mm:ss → HH:mm
    endTime: s.end_time.substring(0, 5),
    academyName: s.academy_name ?? undefined,
    subject: s.subject ?? undefined,
    travelTime: 60,
  }));

  for (const { calendarId, periodStart, periodEnd } of calendarPeriods) {
    // 해당 캘린더의 기존 학원 이벤트 키 (중복 방지)
    const { data: existingEvents } = await supabase
      .from("calendar_events")
      .select("start_date, start_at, end_at, event_subtype")
      .eq("calendar_id", calendarId)
      .eq("event_type", "academy")
      .is("deleted_at", null);

    const existingEventKeys = new Set(
      (existingEvents ?? []).map(
        (e) => `${e.start_at}-${e.end_at}-${e.event_subtype}`
      )
    );

    // 날짜별 전개
    const records = generateNonStudyRecordsForDateRange(
      calendarId,
      studentId,
      tenantId,
      periodStart,
      periodEnd,
      null, // nonStudyTimeBlocks 없음 (학원만 전개)
      { academySchedules: academyInputs }
    );

    // 중복 필터링
    const newRecords = records.filter((r) => {
      const key = `${r.start_at}-${r.end_at}-${r.event_subtype}`;
      return !existingEventKeys.has(key);
    });

    if (newRecords.length > 0) {
      const { error } = await supabase
        .from("calendar_events")
        .insert(newRecords);

      if (error) {
        handleQueryError(error, {
          context:
            "[data/calendarAcademySchedules] createStudentAcademySchedulesViaCalendar",
        });
        return { success: false, error: error.message };
      }
    }
  }

  return { success: true };
}

/**
 * 플랜 그룹을 통해 학원 일정 생성 (간편 버전)
 */
export async function createAcademySchedulesViaCalendar(
  groupId: string,
  tenantId: string,
  schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { data: group } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group?.student_id) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }

  return createStudentAcademySchedulesViaCalendar(
    group.student_id,
    tenantId,
    schedules
  );
}

/**
 * 플랜 그룹에 학원 일정 생성 (상세 버전 - source, is_locked, travel_time 지원)
 */
export async function createPlanAcademySchedulesViaCalendar(
  groupId: string,
  tenantId: string,
  schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
    travel_time?: number;
    source?: "template" | "student" | "time_management";
    is_locked?: boolean;
  }>,
  useAdminClient: boolean = false
): Promise<{ success: boolean; error?: string }> {
  if (schedules.length === 0) return { success: true };

  const supabase = await getSupabaseClient(useAdminClient);

  const { data: group } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group?.student_id) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }

  return createStudentAcademySchedulesViaCalendar(
    group.student_id,
    tenantId,
    schedules,
    useAdminClient
  );
}

// ============================================
// Update / Delete
// ============================================

/**
 * 학원 일정 업데이트 (패턴 기반 일괄 UPDATE)
 *
 * 대표 event ID → 동일 패턴의 모든 미래 events 일괄 변경
 */
export async function updateAcademyScheduleViaCalendar(
  eventId: string,
  data: {
    academy_name?: string | null;
    subject?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // 대표 이벤트에서 패턴 정보 추출
  const { data: refEvent, error: refError } = await supabase
    .from("calendar_events")
    .select(
      "student_id, start_at, end_at, start_date, title, event_subtype"
    )
    .eq("id", eventId)
    .eq("event_type", "academy")
    .maybeSingle();

  const refDate = refEvent ? getEventDate(refEvent) : null;
  if (
    refError ||
    !refDate ||
    !refEvent?.start_at ||
    !refEvent.end_at
  ) {
    return { success: false, error: "학원 일정을 찾을 수 없습니다." };
  }

  const origDayOfWeek = new Date(refDate + "T00:00:00").getDay();
  const origStartTime = extractTimeHHMM(refEvent.start_at);
  const origEndTime = extractTimeHHMM(refEvent.end_at);

  if (!origStartTime || !origEndTime) {
    return { success: false, error: "시간 정보를 추출할 수 없습니다." };
  }

  // 동일 패턴의 미래 학원 이벤트 검색
  const { data: allAcademyEvents } = await supabase
    .from("calendar_events")
    .select("id, start_date, start_at, end_at, event_subtype")
    .eq("student_id", refEvent.student_id)
    .eq("event_type", "academy")
    .gte("start_at", todayStartAtKST())
    .is("deleted_at", null);

  const targetIds: string[] = [];

  for (const evt of allAcademyEvents ?? []) {
    const evtDate = getEventDate(evt);
    if (
      evt.event_subtype !== "학원" ||
      !evt.start_at ||
      !evt.end_at ||
      !evtDate
    )
      continue;
    const evtDay = new Date(evtDate + "T00:00:00").getDay();
    const evtStart = extractTimeHHMM(evt.start_at);
    const evtEnd = extractTimeHHMM(evt.end_at);
    if (
      evtDay === origDayOfWeek &&
      evtStart === origStartTime &&
      evtEnd === origEndTime
    ) {
      targetIds.push(evt.id);
    }
  }

  if (targetIds.length === 0) return { success: true };

  // 새 title 계산
  const parsed = parseAcademyTitle(refEvent.title);
  const newAcademyName = data.academy_name ?? parsed.academyName;
  const newSubject =
    data.subject !== undefined ? data.subject : parsed.subject;
  const subjectLabel = newSubject ? ` (${newSubject})` : "";
  const newTitle = `${newAcademyName}${subjectLabel}`;

  const { error } = await supabase
    .from("calendar_events")
    .update({ title: newTitle })
    .in("id", targetIds);

  if (error) {
    handleQueryError(error, {
      context:
        "[data/calendarAcademySchedules] updateAcademyScheduleViaCalendar",
    });
    return { success: false, error: error.message };
  }

  // 연관 이동시간 이벤트 title도 업데이트
  const travelIds: string[] = [];
  for (const evt of allAcademyEvents ?? []) {
    const travelDate = getEventDate(evt);
    if (
      evt.event_subtype !== "이동시간" ||
      !evt.end_at ||
      !travelDate
    )
      continue;
    const evtDay = new Date(travelDate + "T00:00:00").getDay();
    const teEndTime = extractTimeHHMM(evt.end_at);
    if (evtDay === origDayOfWeek && teEndTime === origStartTime) {
      travelIds.push(evt.id);
    }
  }

  if (travelIds.length > 0) {
    await supabase
      .from("calendar_events")
      .update({ title: `${newAcademyName} 이동` })
      .in("id", travelIds);
  }

  return { success: true };
}

/**
 * 학원 일정 삭제 (패턴 기반 일괄 soft-delete)
 *
 * 대표 event ID → 동일 패턴의 모든 미래 events + 이동시간 일괄 soft-delete
 */
export async function deleteAcademyScheduleViaCalendar(
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // 대표 이벤트에서 패턴 정보 추출
  const { data: refEvent, error: refError } = await supabase
    .from("calendar_events")
    .select("student_id, start_at, end_at, start_date, event_subtype")
    .eq("id", eventId)
    .eq("event_type", "academy")
    .maybeSingle();

  const refDate = refEvent ? getEventDate(refEvent) : null;
  if (
    refError ||
    !refDate ||
    !refEvent?.start_at ||
    !refEvent.end_at
  ) {
    return { success: false, error: "학원 일정을 찾을 수 없습니다." };
  }

  const origDayOfWeek = new Date(refDate + "T00:00:00").getDay();
  const origStartTime = extractTimeHHMM(refEvent.start_at);
  const origEndTime = extractTimeHHMM(refEvent.end_at);

  if (!origStartTime || !origEndTime) {
    return { success: false, error: "시간 정보를 추출할 수 없습니다." };
  }

  // 동일 패턴의 모든 미래 이벤트 검색 (학원 + 이동시간)
  const { data: allEvents } = await supabase
    .from("calendar_events")
    .select("id, start_date, start_at, end_at, event_subtype")
    .eq("student_id", refEvent.student_id)
    .eq("event_type", "academy")
    .gte("start_at", todayStartAtKST())
    .is("deleted_at", null);

  const idsToDelete: string[] = [];

  for (const evt of allEvents ?? []) {
    const evtDate = getEventDate(evt);
    if (!evtDate) continue;
    const evtDay = new Date(evtDate + "T00:00:00").getDay();

    if (evt.event_subtype === "학원" && evt.start_at && evt.end_at) {
      const evtStart = extractTimeHHMM(evt.start_at);
      const evtEnd = extractTimeHHMM(evt.end_at);
      if (
        evtDay === origDayOfWeek &&
        evtStart === origStartTime &&
        evtEnd === origEndTime
      ) {
        idsToDelete.push(evt.id);
      }
    } else if (evt.event_subtype === "이동시간" && evt.end_at) {
      const teEndTime = extractTimeHHMM(evt.end_at);
      if (evtDay === origDayOfWeek && teEndTime === origStartTime) {
        idsToDelete.push(evt.id);
      }
    }
  }

  if (idsToDelete.length > 0) {
    const { error } = await supabase
      .from("calendar_events")
      .update({
        deleted_at: new Date().toISOString(),
        status: "cancelled",
      })
      .in("id", idsToDelete);

    if (error) {
      handleQueryError(error, {
        context:
          "[data/calendarAcademySchedules] deleteAcademyScheduleViaCalendar",
      });
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}

// ============================================
// 가상 학원 CRUD (academies 테이블 없이 calendar_events에서 도출)
// ============================================

/**
 * 가상 학원 타입 (calendar_events 그룹핑에서 도출)
 */
export type VirtualAcademy = {
  name: string;
  travel_time: number;
  schedule_count: number;
  first_event_id: string;
};

/**
 * 학생의 학원 목록 조회 (calendar_events에서 학원명 그룹핑)
 *
 * academies 테이블 대신 calendar_events의 academy 이벤트를 그룹핑하여
 * 가상 학원 목록을 도출합니다.
 */
export async function getDistinctAcademiesFromCalendar(
  studentId: string,
  tenantId?: string | null,
  options?: { useAdminClient?: boolean }
): Promise<VirtualAcademy[]> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  let query = supabase
    .from("calendar_events")
    .select("id, title, metadata, created_at")
    .eq("student_id", studentId)
    .eq("event_type", "academy")
    .eq("event_subtype", "학원")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (tenantId) {
    query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    handleQueryError(error, {
      context: "[data/calendarAcademySchedules] getDistinctAcademiesFromCalendar",
    });
    return [];
  }

  // 학원명 기준 그룹핑
  const academyMap = new Map<
    string,
    { travel_time: number; count: number; first_event_id: string }
  >();

  for (const event of data ?? []) {
    const { academyName } = parseAcademyTitle(event.title);
    const existing = academyMap.get(academyName);
    const travelTime =
      (event.metadata as Record<string, unknown> | null)?.travel_time as number | undefined;

    if (!existing) {
      academyMap.set(academyName, {
        travel_time: travelTime ?? 60,
        count: 1,
        first_event_id: event.id,
      });
    } else {
      existing.count += 1;
    }
  }

  return Array.from(academyMap.entries()).map(([name, info]) => ({
    name,
    travel_time: info.travel_time,
    schedule_count: info.count,
    first_event_id: info.first_event_id,
  }));
}

/**
 * 학원명 변경 (해당 학원의 모든 미래 이벤트 title 일괄 업데이트)
 */
export async function renameAcademyViaCalendar(
  studentId: string,
  oldName: string,
  newName: string,
  useAdminClient: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseClient(useAdminClient);

  // 해당 학원명의 모든 미래 학원 이벤트 조회
  const { data: events } = await supabase
    .from("calendar_events")
    .select("id, title, event_subtype")
    .eq("student_id", studentId)
    .eq("event_type", "academy")
    .like("title", `${oldName}%`)
    .gte("start_at", todayStartAtKST())
    .is("deleted_at", null);

  if (!events?.length) return { success: true };

  // 학원 이벤트와 이동시간 이벤트 분리하여 처리
  const travelIds: string[] = [];

  for (const evt of events) {
    if (evt.event_subtype === "학원") {
      const newTitle = evt.title.replace(oldName, newName);
      await supabase
        .from("calendar_events")
        .update({ title: newTitle })
        .eq("id", evt.id);
    } else if (evt.event_subtype === "이동시간") {
      travelIds.push(evt.id);
    }
  }

  // 이동시간 이벤트 title 일괄 업데이트
  if (travelIds.length > 0) {
    await supabase
      .from("calendar_events")
      .update({ title: `${newName} 이동` })
      .in("id", travelIds);
  }

  return { success: true };
}

/**
 * 학원 이동시간 변경 (해당 학원의 모든 미래 이벤트 metadata 일괄 업데이트)
 */
export async function updateAcademyTravelTimeViaCalendar(
  studentId: string,
  name: string,
  travelTime: number,
  useAdminClient: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseClient(useAdminClient);

  // 해당 학원명의 모든 미래 이벤트 조회
  const { data: events } = await supabase
    .from("calendar_events")
    .select("id, metadata")
    .eq("student_id", studentId)
    .eq("event_type", "academy")
    .eq("event_subtype", "학원")
    .like("title", `${name}%`)
    .gte("start_at", todayStartAtKST())
    .is("deleted_at", null);

  if (!events?.length) return { success: true };

  // metadata.travel_time 업데이트
  for (const evt of events) {
    const currentMetadata = (evt.metadata as Record<string, unknown>) ?? {};
    const updatedMetadata = { ...currentMetadata, travel_time: travelTime };

    await supabase
      .from("calendar_events")
      .update({ metadata: updatedMetadata })
      .eq("id", evt.id);
  }

  return { success: true };
}

/**
 * 학원 삭제 (해당 학원의 모든 미래 이벤트 soft-delete)
 *
 * 학원 + 이동시간 이벤트 모두 soft-delete
 */
export async function deleteAcademyViaCalendar(
  studentId: string,
  name: string,
  useAdminClient: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseClient(useAdminClient);

  // 해당 학원명의 모든 미래 이벤트 (학원 + 이동시간) soft-delete
  const { error } = await supabase
    .from("calendar_events")
    .update({
      deleted_at: new Date().toISOString(),
      status: "cancelled",
    })
    .eq("student_id", studentId)
    .eq("event_type", "academy")
    .like("title", `${name}%`)
    .gte("start_at", todayStartAtKST())
    .is("deleted_at", null);

  if (error) {
    handleQueryError(error, {
      context: "[data/calendarAcademySchedules] deleteAcademyViaCalendar",
    });
    return { success: false, error: error.message };
  }

  return { success: true };
}
