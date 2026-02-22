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
import { logActionError } from "@/lib/utils/serverActionLogger";
import {
  generateExclusionRecordsForDates,
  generateRecurringNonStudyRecords,
  generateNonStudyRecordsForDateRange,
  type AcademyScheduleInput,
} from "../utils/nonStudyTimeGenerator";
import { getStudentExclusions } from "@/lib/data/planGroups/exclusions";
import { getEffectiveAcademySchedulesForPlanner } from "@/lib/data/planGroups/academyOverrides";
import { resolvePrimaryCalendarId, mapExclusionType } from "@/lib/domains/calendar/helpers";
import { extractTimeHHMM } from "@/lib/domains/calendar/adapters";

// ============================================
// 타입 정의
// ============================================

export interface CalendarEvent {
  id: string;
  plannerId: string;
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

function eventToLegacyType(eventType: string, eventSubtype: string | null): string {
  if (eventType === 'exclusion') return '제외일';
  if (eventType === 'academy') return eventSubtype === '이동시간' ? '이동시간' : '학원';
  if (eventSubtype) return eventSubtype;
  return '기타';
}

// ============================================
// 조회
// ============================================

async function _getPlannerCalendarEvents(
  plannerId: string,
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const supabase = await createSupabaseServerClient();

  const calendarId = await resolvePrimaryCalendarId(plannerId);
  if (!calendarId) return [];

  const dateStart = `${startDate}T00:00:00+09:00`;
  const dateEnd = `${endDate}T23:59:59+09:00`;

  const { data, error } = await supabase
    .from("calendar_events")
    .select(
      "id, calendar_id, title, event_type, event_subtype, start_at, end_at, start_date, end_date, is_all_day, metadata, source, order_index, status"
    )
    .eq("calendar_id", calendarId)
    .is("deleted_at", null)
    .or(
      `and(is_all_day.eq.false,start_at.gte.${dateStart},start_at.lt.${dateEnd}),and(is_all_day.eq.true,start_date.gte.${startDate},start_date.lte.${endDate})`
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
      plannerId,
      planDate: row.start_date ?? (row.start_at?.split("T")[0] ?? ""),
      type: eventToLegacyType(row.event_type, row.event_subtype),
      startTime: extractTimeHHMM(row.start_at),
      endTime: extractTimeHHMM(row.end_at),
      label: row.title,
      isAllDay: row.is_all_day ?? false,
      groupId: (metadata?.group_id as string) ?? null,
      exclusionType: row.event_type === "exclusion" ? row.event_subtype : null,
      source: row.source ?? "template",
      sequence: row.order_index ?? 0,
      isTemplateBased: row.source === "template",
    };
  });
}

export const getPlannerCalendarEventsAction = withErrorHandling(
  _getPlannerCalendarEvents
);

// ============================================
// 제외일 추가
// ============================================

async function _addExclusionEvent(
  plannerId: string,
  date: string,
  exclusionType: string,
  reason?: string
): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient();

  // 플래너의 tenant_id, student_id 조회
  const { data: planner } = await supabase
    .from("planners")
    .select("tenant_id, student_id")
    .eq("id", plannerId)
    .single();

  if (!planner) {
    throw new AppError("플래너를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const calendarId = await resolvePrimaryCalendarId(plannerId);
  if (!calendarId) {
    throw new AppError("캘린더를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 중복 체크
  const { data: existing } = await supabase
    .from("calendar_events")
    .select("id")
    .eq("calendar_id", calendarId)
    .eq("event_type", "exclusion")
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
      tenant_id: planner.tenant_id,
      student_id: planner.student_id,
      title: reason || "제외일",
      event_type: "exclusion",
      event_subtype: mapExclusionType(exclusionType),
      start_date: date,
      end_date: date,
      is_all_day: true,
      status: "confirmed",
      transparency: "transparent",
      source: "manual",
      order_index: 0,
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
  plannerId: string,
  pattern: RecurringPattern
): Promise<{ groupId: string; count: number }> {
  const supabase = await createSupabaseServerClient();

  // 플래너 기간/tenant/student 조회
  const { data: planner } = await supabase
    .from("planners")
    .select("tenant_id, student_id, period_start, period_end")
    .eq("id", plannerId)
    .single();

  if (!planner) {
    throw new AppError("플래너를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const calendarId = await resolvePrimaryCalendarId(plannerId);
  if (!calendarId) {
    throw new AppError("캘린더를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const groupId = crypto.randomUUID();

  const records = generateRecurringNonStudyRecords(
    calendarId,
    planner.student_id,
    planner.tenant_id,
    {
      type: pattern.type,
      startTime: pattern.startTime,
      endTime: pattern.endTime,
      daysOfWeek: pattern.daysOfWeek,
      label: pattern.label,
      groupId,
    },
    planner.period_start,
    planner.period_end,
    "manual"
  );

  if (records.length === 0) {
    return { groupId, count: 0 };
  }

  // 배치 삽입
  const BATCH_SIZE = 500;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
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
      const planDate = event.start_date ?? event.start_at?.split("T")[0];
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
  plannerId: string,
  groupId: string
): Promise<{ deletedCount: number }> {
  const supabase = await createSupabaseServerClient();

  const calendarId = await resolvePrimaryCalendarId(plannerId);
  if (!calendarId) return { deletedCount: 0 };

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
  plannerId: string,
  studentId: string
): Promise<{ exclusionCount: number; academyCount: number }> {
  const supabase = await createSupabaseServerClient();

  // 플래너 정보 조회
  const { data: planner } = await supabase
    .from("planners")
    .select("tenant_id, period_start, period_end, non_study_time_blocks")
    .eq("id", plannerId)
    .single();

  if (!planner) {
    throw new AppError("플래너를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const calendarId = await resolvePrimaryCalendarId(plannerId);
  if (!calendarId) {
    throw new AppError("캘린더를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const tenantId = planner.tenant_id;
  let exclusionCount = 0;
  let academyCount = 0;

  // 1. 전역 제외일 → calendar_events (event_type='exclusion')
  const globalExclusions = await getStudentExclusions(studentId, tenantId, {
    useAdminClient: true,
  });

  const periodExclusions = globalExclusions.filter(
    (e) =>
      e.exclusion_date >= planner.period_start &&
      e.exclusion_date <= planner.period_end
  );

  if (periodExclusions.length > 0) {
    // 기존 calendar_events 제외일도 병합
    const { data: existingCalendarExclusions } = await supabase
      .from("calendar_events")
      .select("start_date, event_subtype, title")
      .eq("calendar_id", calendarId)
      .eq("event_type", "exclusion")
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
        .eq("event_type", "exclusion")
        .is("deleted_at", null);

      const existingDateSet = new Set(
        (existingDates || []).map((r) => r.start_date)
      );
      const newRecords = records.filter(
        (r) => !existingDateSet.has(r.start_date ?? null)
      );

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
  const effectiveSchedules = await getEffectiveAcademySchedulesForPlanner(
    plannerId,
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
      .eq("event_type", "academy")
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
        planner.period_start,
        planner.period_end,
        null,
        { academySchedules: academyInputs, excludedDates: exclusionDates }
      );

      // 학원/이동시간만 필터
      const academyRecords = records.filter(
        (r) => r.event_type === "academy"
      ).map((r) => ({ ...r, source: "migration" }));

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
