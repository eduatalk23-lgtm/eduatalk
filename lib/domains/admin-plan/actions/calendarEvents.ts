"use server";

/**
 * 플래너 캘린더 이벤트 CRUD 서버 액션
 *
 * calendar_events 테이블을 통해 제외일/학원/비학습시간을 관리합니다.
 *
 * @module lib/domains/admin-plan/actions/calendarEvents
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { logActionError } from "@/lib/utils/serverActionLogger";
import {
  generateExclusionRecordsForDates,
  generateRecurringNonStudyRecords,
  generateNonStudyRecordsForDateRange,
  type AcademyScheduleInput,
} from "../utils/nonStudyTimeGenerator";
import { getStudentExclusionsFromCalendar } from "@/lib/data/calendarExclusions";
import { getEffectiveAcademySchedulesForCalendar } from "@/lib/data/planGroups/academyOverrides";
import { mapExclusionType, toTimestamptz } from "@/lib/domains/calendar/helpers";
import { extractTimeHHMM, extractDateYMD } from "@/lib/domains/calendar/adapters";
import type { EventType } from "@/lib/domains/calendar/types";

// ============================================
// 타입 정의
// ============================================

export interface CalendarEvent {
  id: string;
  calendarId: string;
  planDate: string;
  type: string;
  startTime: string | null;
  endTime: string | null;
  label: string | null;
  isAllDay: boolean;
  groupId: string | null;
  exclusionType: string | null;
  source: string;
  sequence: number;
  isTemplateBased: boolean;
}

export interface RecurringPattern {
  type: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  label?: string;
}

// ============================================
// 내부 헬퍼: event_type/subtype → legacy type 역매핑
// ============================================

function eventToLegacyType(row: { label?: string | null; is_exclusion?: boolean; event_type?: string; event_subtype?: string | null }): string {
  if (row.label) return row.label;
  // fallback for pre-migration rows
  if (row.is_exclusion || row.event_type === 'exclusion') return '제외일';
  if (row.event_subtype) return row.event_subtype;
  return '기타';
}

// ============================================
// 조회
// ============================================

async function _getCalendarEvents(
  calendarId: string,
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  if (!calendarId) return [];

  const supabase = await createSupabaseServerClient();

  const dateStart = `${startDate}T00:00:00+09:00`;
  const dateEnd = `${endDate}T23:59:59+09:00`;

  const { data, error } = await supabase
    .from("calendar_events")
    .select(
      "id, calendar_id, title, event_type, event_subtype, label, is_exclusion, start_at, end_at, start_date, end_date, is_all_day, metadata, source, order_index, status"
    )
    .eq("calendar_id", calendarId)
    .is("deleted_at", null)
    .or(
      `and(is_all_day.eq.false,start_at.lt.${dateEnd},end_at.gt.${dateStart}),and(is_all_day.eq.true,start_date.lte.${endDate},end_date.gte.${startDate})`
    )
    .order("start_at", { ascending: true, nullsFirst: false })
    .order("start_date", { ascending: true, nullsFirst: false });

  if (error) {
    throw new AppError(
      `캘린더 이벤트 조회 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return (data || []).map((row) => {
    const metadata = row.metadata as Record<string, unknown> | null;
    return {
      id: row.id,
      calendarId,
      planDate: row.start_date ?? (extractDateYMD(row.start_at ?? null) ?? ""),
      type: eventToLegacyType(row),
      startTime: extractTimeHHMM(row.start_at),
      endTime: extractTimeHHMM(row.end_at),
      label: row.title,
      isAllDay: row.is_all_day ?? false,
      groupId: (metadata?.group_id as string) ?? null,
      exclusionType: row.is_exclusion ? (row.label ?? row.event_subtype) : null,
      source: row.source ?? "template",
      sequence: row.order_index ?? 0,
      isTemplateBased: row.source === "template",
    };
  });
}

export const getCalendarEventsAction = withErrorHandling(
  _getCalendarEvents
);

/** @deprecated Use getCalendarEventsAction */
export const getPlannerCalendarEventsAction = getCalendarEventsAction;

// ============================================
// 일반 캘린더 이벤트 생성 (RRULE 반복 지원)
// ============================================

export interface CreateCalendarEventInput {
  /** 캘린더 ID */
  calendarId: string;
  title: string;
  planDate: string;        // YYYY-MM-DD (시작 날짜)
  /** 종료 날짜 (multi-day 이벤트용, 미지정 시 planDate와 동일) */
  endDate?: string;        // YYYY-MM-DD
  startTime?: string;      // HH:mm (null이면 종일)
  endTime?: string;        // HH:mm
  isAllDay?: boolean;
  subject?: string;
  subjectCategory?: string;
  rrule?: string | null;   // RFC 5545 RRULE
  /** @deprecated label + isTask + isExclusion 사용 */
  eventType?: EventType;
  /** @deprecated label 사용 */
  eventSubtype?: string;
  label?: string;
  isTask?: boolean;
  isExclusion?: boolean;
  containerType?: string;  // 'daily'
  color?: string;
  reminderMinutes?: number | null;
  description?: string;
  estimatedMinutes?: number | null;
}

async function _createCalendarEvent(
  input: CreateCalendarEventInput,
): Promise<{ eventId: string }> {
  // 서버 검증
  if (!input.title?.trim()) {
    throw new AppError("제목은 필수입니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }
  if (!input.calendarId) {
    throw new AppError("캘린더 ID는 필수입니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentUser();

  // Calendar-First: calendarId에서 직접 조회
  const { data: cal } = await supabase
    .from("calendars")
    .select("id, tenant_id, owner_id")
    .eq("id", input.calendarId)
    .is("deleted_at", null)
    .single();

  if (!cal) {
    throw new AppError("캘린더를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }
  const calendarId = cal.id;
  const tenantId = cal.tenant_id;
  const studentId = cal.owner_id;

  const isAllDay = input.isAllDay ?? !input.startTime;
  const eventType = input.eventType ?? "custom";
  const label = input.label ?? input.eventSubtype ?? input.subject ?? '일반';
  const isTask = input.isTask ?? (eventType === 'study' || eventType === 'custom');
  const isExclusion = input.isExclusion ?? (eventType === 'exclusion');

  const insertData: Record<string, unknown> = {
    calendar_id: calendarId,
    tenant_id: tenantId,
    student_id: studentId,
    title: input.title,
    description: input.description ?? null,
    event_type: eventType,
    event_subtype: input.eventSubtype ?? input.subject ?? null,
    label,
    is_task: isTask,
    is_exclusion: isExclusion,
    is_all_day: isAllDay,
    status: "confirmed",
    source: "manual",
    order_index: 0,
    rrule: input.rrule ?? null,
    color: input.color ?? null,
    container_type: input.containerType ?? "daily",
    created_by: currentUser?.userId ?? null,
    creator_role: currentUser?.role === 'student' ? 'student' : 'admin',
  };

  // reminder_minutes: 마이그레이션 미적용 시 컬럼이 없을 수 있으므로 값이 있을 때만 포함
  if (input.reminderMinutes != null) {
    insertData.reminder_minutes = [input.reminderMinutes];
  }

  const effectiveEndDate = input.endDate ?? input.planDate;

  if (isAllDay) {
    insertData.start_date = input.planDate;
    insertData.end_date = effectiveEndDate;
  } else {
    insertData.start_at = toTimestamptz(input.planDate, input.startTime!);
    insertData.end_at = toTimestamptz(effectiveEndDate, input.endTime ?? input.startTime!);
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .insert(insertData)
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new AppError(
      `캘린더 이벤트 생성 실패: ${error?.message ?? 'ID가 반환되지 않았습니다.'}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true,
    );
  }

  // study 이벤트: event_study_data 레코드 생성
  if (eventType === "study") {
    const studyData: Record<string, unknown> = {
      event_id: data.id,
      subject_category: input.subjectCategory ?? input.subject ?? null,
    };
    if (input.estimatedMinutes != null) {
      studyData.estimated_minutes = input.estimatedMinutes;
    }
    await supabase.from("event_study_data").insert(studyData);
  }

  return { eventId: data.id };
}

export const createCalendarEventAction = withErrorHandling(_createCalendarEvent);

// ============================================
// 제외일 추가
// ============================================

async function _addExclusionEvent(
  calendarId: string,
  date: string,
  exclusionType: string,
  reason?: string
): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentUser();

  // Calendar-First: calendars에서 tenant_id, owner_id 직접 조회
  const { data: cal } = await supabase
    .from("calendars")
    .select("id, tenant_id, owner_id")
    .eq("id", calendarId)
    .is("deleted_at", null)
    .single();

  if (!cal) {
    throw new AppError("캘린더를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 중복 체크
  const { data: existing } = await supabase
    .from("calendar_events")
    .select("id")
    .eq("calendar_id", calendarId)
    .eq("is_exclusion", true)
    .eq("is_all_day", true)
    .eq("start_date", date)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    throw new AppError(
      "해당 날짜에 이미 제외일이 설정되어 있습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      calendar_id: calendarId,
      tenant_id: cal.tenant_id,
      student_id: cal.owner_id,
      title: reason || "제외일",
      event_type: "exclusion",
      event_subtype: mapExclusionType(exclusionType),
      label: mapExclusionType(exclusionType),
      is_task: false,
      is_exclusion: true,
      start_date: date,
      end_date: date,
      is_all_day: true,
      status: "confirmed",
      transparency: "transparent",
      source: "manual",
      order_index: 0,
      created_by: currentUser?.userId ?? null,
      creator_role: currentUser?.role === 'student' ? 'student' : 'admin',
    })
    .select("id")
    .single();

  if (error) {
    throw new AppError(
      `제외일 추가 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return { id: data.id };
}

export const addExclusionEventAction = withErrorHandling(_addExclusionEvent);

// ============================================
// 반복 일정 추가
// ============================================

async function _addRecurringEvent(
  calendarId: string,
  pattern: RecurringPattern
): Promise<{ groupId: string; count: number }> {
  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentUser();

  // Calendar-First: calendars에서 tenant_id, owner_id, period 직접 조회
  const { data: cal } = await supabase
    .from("calendars")
    .select("id, tenant_id, owner_id, period_start, period_end")
    .eq("id", calendarId)
    .is("deleted_at", null)
    .single();

  if (!cal) {
    throw new AppError("캘린더를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const groupId = crypto.randomUUID();

  const records = generateRecurringNonStudyRecords(
    calendarId,
    cal.owner_id,
    cal.tenant_id,
    {
      type: pattern.type,
      startTime: pattern.startTime,
      endTime: pattern.endTime,
      daysOfWeek: pattern.daysOfWeek,
      label: pattern.label,
      groupId,
    },
    cal.period_start,
    cal.period_end,
    "manual"
  );

  if (records.length === 0) {
    return { groupId, count: 0 };
  }

  // created_by / creator_role 주입
  const userId = currentUser?.userId ?? null;
  const creatorRole = currentUser?.role === 'student' ? 'student' : 'admin';
  const recordsWithCreatedBy = records.map((r) => ({ ...r, created_by: userId, creator_role: creatorRole }));

  // 배치 삽입
  const BATCH_SIZE = 500;
  for (let i = 0; i < recordsWithCreatedBy.length; i += BATCH_SIZE) {
    const batch = recordsWithCreatedBy.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("calendar_events")
      .insert(batch);

    if (error) {
      throw new AppError(
        `반복 일정 추가 실패: ${error.message}`,
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
  }

  return { groupId, count: records.length };
}

export const addRecurringEventAction = withErrorHandling(_addRecurringEvent);

// ============================================
// 단일 이벤트 수정
// ============================================

async function _updateCalendarEvent(
  eventId: string,
  updates: {
    startTime?: string;
    endTime?: string;
    label?: string;
    exclusionType?: string;
    color?: string | null;
    status?: string;
    reminderMinutes?: number[] | null;
    description?: string | null;
    rrule?: string | null;
    eventSubtype?: string;
  }
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const updateData: Record<string, unknown> = {};

  // 시간 업데이트를 위해 기존 이벤트의 날짜 정보가 필요
  if (updates.startTime !== undefined || updates.endTime !== undefined) {
    const { data: event } = await supabase
      .from("calendar_events")
      .select("start_at, start_date")
      .eq("id", eventId)
      .is("deleted_at", null)
      .single();

    if (event) {
      const planDate = event.start_date ?? extractDateYMD(event.start_at ?? null);
      if (planDate) {
        if (updates.startTime !== undefined) {
          updateData.start_at = updates.startTime
            ? `${planDate}T${updates.startTime}:00+09:00`
            : null;
        }
        if (updates.endTime !== undefined) {
          updateData.end_at = updates.endTime
            ? `${planDate}T${updates.endTime}:00+09:00`
            : null;
        }
      }
    }
  }

  if (updates.label !== undefined) updateData.title = updates.label || null;
  if (updates.exclusionType !== undefined) updateData.event_subtype = updates.exclusionType;
  if (updates.color !== undefined) updateData.color = updates.color;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.reminderMinutes !== undefined) updateData.reminder_minutes = updates.reminderMinutes;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.rrule !== undefined) updateData.rrule = updates.rrule;
  if (updates.eventSubtype !== undefined) updateData.event_subtype = updates.eventSubtype;

  const { error } = await supabase
    .from("calendar_events")
    .update(updateData)
    .eq("id", eventId)
    .is("deleted_at", null);

  if (error) {
    throw new AppError(
      `이벤트 수정 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }
}

export const updateCalendarEventAction = withErrorHandling(
  _updateCalendarEvent
);

// ============================================
// 단일 이벤트 삭제 (soft delete)
// ============================================

async function _deleteCalendarEvent(eventId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("calendar_events")
    .update({
      deleted_at: new Date().toISOString(),
      status: "cancelled",
    })
    .eq("id", eventId)
    .is("deleted_at", null);

  if (error) {
    throw new AppError(
      `이벤트 삭제 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }
}

export const deleteCalendarEventAction = withErrorHandling(
  _deleteCalendarEvent
);

// ============================================
// 반복 일정 일괄 삭제 (soft delete by group_id)
// ============================================

async function _deleteEventGroup(
  calendarId: string,
  groupId: string
): Promise<{ deletedCount: number }> {
  if (!calendarId) return { deletedCount: 0 };

  const supabase = await createSupabaseServerClient();

  // metadata->>group_id로 필터하여 soft delete
  const { data, error } = await supabase
    .from("calendar_events")
    .update({
      deleted_at: new Date().toISOString(),
      status: "cancelled",
    })
    .eq("calendar_id", calendarId)
    .filter("metadata->>group_id", "eq", groupId)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    throw new AppError(
      `반복 일정 일괄 삭제 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return { deletedCount: data?.length ?? 0 };
}

export const deleteEventGroupAction = withErrorHandling(_deleteEventGroup);

// ============================================
// 전역 데이터 → 캘린더 이벤트 변환 (마이그레이션)
// ============================================

async function _importTimeManagement(
  calendarId: string,
  studentId: string
): Promise<{ exclusionCount: number; academyCount: number }> {
  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentUser();
  const userId = currentUser?.userId ?? null;

  // Calendar-First: calendars에서 tenant_id, period, non_study_time_blocks 직접 조회
  const { data: cal } = await supabase
    .from("calendars")
    .select("id, tenant_id, period_start, period_end, non_study_time_blocks")
    .eq("id", calendarId)
    .is("deleted_at", null)
    .single();

  if (!cal) {
    throw new AppError("캘린더를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const tenantId = cal.tenant_id;
  let exclusionCount = 0;
  let academyCount = 0;

  // 1. 전역 제외일 → calendar_events (event_type='exclusion')
  const globalExclusions = await getStudentExclusionsFromCalendar(studentId, tenantId, {
    useAdminClient: true,
  });

  const periodExclusions = globalExclusions.filter(
    (e) =>
      e.exclusion_date >= cal.period_start &&
      e.exclusion_date <= cal.period_end
  );

  if (periodExclusions.length > 0) {
    // 기존 calendar_events 제외일도 병합
    const { data: existingCalendarExclusions } = await supabase
      .from("calendar_events")
      .select("start_date, event_subtype, title")
      .eq("calendar_id", calendarId)
      .eq("is_exclusion", true)
      .eq("is_all_day", true)
      .is("deleted_at", null);

    const exclusionMap = new Map<
      string,
      { date: string; exclusionType: string; reason?: string }
    >();

    for (const exc of periodExclusions) {
      exclusionMap.set(exc.exclusion_date, {
        date: exc.exclusion_date,
        exclusionType: exc.exclusion_type || "기타",
        reason: exc.reason ?? undefined,
      });
    }

    for (const exc of existingCalendarExclusions || []) {
      if (exc.start_date && !exclusionMap.has(exc.start_date)) {
        exclusionMap.set(exc.start_date, {
          date: exc.start_date,
          exclusionType: exc.event_subtype || "기타",
          reason: exc.title ?? undefined,
        });
      }
    }

    const records = generateExclusionRecordsForDates(
      calendarId,
      studentId,
      tenantId,
      Array.from(exclusionMap.values()),
      "migration"
    );

    if (records.length > 0) {
      // 이미 존재하는 제외일은 건너뜀
      const { data: existingDates } = await supabase
        .from("calendar_events")
        .select("start_date")
        .eq("calendar_id", calendarId)
        .eq("is_exclusion", true)
        .is("deleted_at", null);

      const existingDateSet = new Set(
        (existingDates || []).map((r) => r.start_date)
      );
      const newRecords = records
        .filter((r) => !existingDateSet.has(r.start_date ?? null))
        .map((r) => ({ ...r, created_by: userId, creator_role: currentUser?.role === 'student' ? 'student' as const : 'admin' as const }));

      if (newRecords.length > 0) {
        const { error } = await supabase
          .from("calendar_events")
          .insert(newRecords);

        if (error) {
          logActionError(
            "calendarEvents.importTimeManagement",
            `제외일 마이그레이션 실패: ${error.message}`
          );
        } else {
          exclusionCount = newRecords.length;
        }
      }
    }
  }

  // 2. 학원 일정 → calendar_events (event_type='academy')
  const effectiveSchedules = await getEffectiveAcademySchedulesForCalendar(
    calendarId,
    studentId,
    tenantId,
    { useAdminClient: true }
  );

  if (effectiveSchedules.length > 0) {
    // 기존 학원 레코드 확인
    const { data: existingAcademyRecords } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("calendar_id", calendarId)
      .eq("label", "학원")
      .is("deleted_at", null)
      .limit(1);

    if (!existingAcademyRecords || existingAcademyRecords.length === 0) {
      const academyInputs: AcademyScheduleInput[] = effectiveSchedules.map(
        (s) => ({
          id: s.id,
          academyName: s.academy_name ?? undefined,
          dayOfWeek: s.day_of_week,
          startTime: s.start_time.substring(0, 5),
          endTime: s.end_time.substring(0, 5),
          subject: s.subject ?? undefined,
          travelTime: s.travel_time ?? undefined,
        })
      );

      const exclusionDates = periodExclusions.map((e) => e.exclusion_date);

      const records = generateNonStudyRecordsForDateRange(
        calendarId,
        studentId,
        tenantId,
        cal.period_start,
        cal.period_end,
        null,
        { academySchedules: academyInputs, excludedDates: exclusionDates }
      );

      // 학원/이동시간만 필터 (label 기반)
      const academyRecords = records.filter(
        (r) => r.label === "학원" || r.label === "이동시간"
      ).map((r) => ({ ...r, source: "migration", created_by: userId, creator_role: currentUser?.role === 'student' ? 'student' as const : 'admin' as const }));

      if (academyRecords.length > 0) {
        const BATCH_SIZE = 500;
        for (let i = 0; i < academyRecords.length; i += BATCH_SIZE) {
          const batch = academyRecords.slice(i, i + BATCH_SIZE);
          const { error } = await supabase
            .from("calendar_events")
            .insert(batch);

          if (error) {
            logActionError(
              "calendarEvents.importTimeManagement",
              `학원 레코드 마이그레이션 실패: ${error.message}`
            );
          } else {
            academyCount += batch.length;
          }
        }
      }
    }
  }

  return { exclusionCount, academyCount };
}

export const importTimeManagementAction = withErrorHandling(
  _importTimeManagement
);
