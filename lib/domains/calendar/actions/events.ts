"use server";

/**
 * Calendar Event CRUD 서버 액션
 *
 * Google Event Resource 패턴 기반 이벤트 관리.
 * calendar_events + event_study_data 테이블 대상 (Phase 1 신규 테이블).
 *
 * @module lib/domains/calendar/actions/events
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import type { Json } from "@/lib/supabase/database.types";
import type {
  CalendarEvent,
  CalendarEventInsert,
  CalendarEventUpdate,
  CalendarEventWithStudyData,
  EventStudyData,
  EventStudyDataInsert,
  EventStudyDataUpdate,
  EventType,
  EventStatus,
  ContainerType,
  EventMetadata,
} from "../types";

// ============================================
// 입력 타입
// ============================================

export interface CreateEventInput {
  calendarId: string;
  tenantId: string;
  studentId: string;
  title: string;
  description?: string;
  location?: string;
  eventType: EventType;
  eventSubtype?: string;

  // 시간 (상호 배타적)
  startAt?: string;
  endAt?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  isAllDay?: boolean;

  // 상태
  status?: EventStatus;
  transparency?: "opaque" | "transparent";

  // 도메인 연결
  planGroupId?: string;
  containerType?: ContainerType;
  orderIndex?: number;

  // UI
  color?: string;
  icon?: string;
  priority?: number;
  tags?: string[];

  // 메타
  source?: string;
  metadata?: EventMetadata;
  createdBy?: string;
}

export interface CreateStudyEventInput extends CreateEventInput {
  eventType: "study";
  studyData: {
    contentType?: "book" | "lecture" | "custom";
    contentId?: string;
    masterContentId?: string;
    flexibleContentId?: string;
    contentTitle?: string;
    subjectName?: string;
    subjectCategory?: string;
    plannedStartPage?: number;
    plannedEndPage?: number;
    chapter?: string;
    originPlanItemId?: string;
    estimatedMinutes?: number;
  };
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  location?: string;
  eventSubtype?: string;
  startAt?: string;
  endAt?: string;
  startDate?: string;
  endDate?: string;
  isAllDay?: boolean;
  status?: EventStatus;
  transparency?: "opaque" | "transparent";
  containerType?: ContainerType;
  orderIndex?: number;
  color?: string;
  icon?: string;
  priority?: number;
  tags?: string[];
  metadata?: EventMetadata;
}

export interface UpdateStudyDataInput {
  completionStatus?: "pending" | "in_progress" | "completed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  pausedAt?: string | null;
  pausedDurationSeconds?: number;
  pauseCount?: number;
  completedAmount?: number;
  progress?: number;
  simpleCompletion?: boolean;
  simpleCompletedAt?: string;
  memo?: string;
}

// ============================================
// 조회
// ============================================

/** 캘린더별 이벤트 조회 (시간 범위) */
async function _getEventsByCalendar(
  calendarId: string,
  startDate: string,
  endDate: string,
  options?: {
    eventTypes?: EventType[];
    statuses?: EventStatus[];
    includeStudyData?: boolean;
  }
): Promise<CalendarEventWithStudyData[]> {
  const supabase = await createSupabaseServerClient();

  const selectFields = options?.includeStudyData !== false
    ? "*, event_study_data(*)"
    : "*, event_study_data(*)";

  let query = supabase
    .from("calendar_events")
    .select(selectFields)
    .eq("calendar_id", calendarId)
    .is("deleted_at", null);

  // 시간 범위: 시간 이벤트 OR 종일 이벤트
  query = query.or(
    `and(is_all_day.eq.false,start_at.gte.${startDate},start_at.lte.${endDate}T23:59:59+09:00),and(is_all_day.eq.true,start_date.gte.${startDate},start_date.lte.${endDate})`
  );

  if (options?.eventTypes?.length) {
    query = query.in("event_type", options.eventTypes);
  }

  if (options?.statuses?.length) {
    query = query.in("status", options.statuses);
  }

  query = query
    .order("start_at", { ascending: true, nullsFirst: false })
    .order("order_index", { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new AppError(
      `이벤트 조회 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return (data ?? []) as CalendarEventWithStudyData[];
}

export const getEventsByCalendarAction = withErrorHandling(
  _getEventsByCalendar
);

/** 미완료 이벤트 조회 (Unfinished Dock) */
async function _getUnfinishedEvents(
  calendarId: string,
  beforeDate: string
): Promise<CalendarEventWithStudyData[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*, event_study_data(*)")
    .eq("calendar_id", calendarId)
    .not("status", "in", '("completed","cancelled")')
    .eq("is_all_day", false)
    .lt("start_at", beforeDate)
    .is("deleted_at", null)
    .order("start_at", { ascending: true });

  if (error) {
    throw new AppError(
      `미완료 이벤트 조회 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return (data ?? []) as CalendarEventWithStudyData[];
}

export const getUnfinishedEventsAction = withErrorHandling(
  _getUnfinishedEvents
);

// ============================================
// 생성
// ============================================

/** 일반 이벤트 생성 */
async function _createEvent(
  input: CreateEventInput
): Promise<CalendarEvent> {
  const supabase = await createSupabaseServerClient();

  const insertData: CalendarEventInsert = {
    calendar_id: input.calendarId,
    tenant_id: input.tenantId,
    student_id: input.studentId,
    title: input.title,
    description: input.description ?? null,
    location: input.location ?? null,
    event_type: input.eventType,
    event_subtype: input.eventSubtype ?? null,
    start_at: input.startAt ?? null,
    end_at: input.endAt ?? null,
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    timezone: input.timezone ?? "Asia/Seoul",
    is_all_day: input.isAllDay ?? false,
    status: input.status ?? "confirmed",
    transparency: input.transparency ?? "opaque",
    plan_group_id: input.planGroupId ?? null,
    container_type: input.containerType ?? "daily",
    order_index: input.orderIndex ?? 0,
    color: input.color ?? null,
    icon: input.icon ?? null,
    priority: input.priority ?? 0,
    tags: input.tags ?? [],
    source: input.source ?? "manual",
    metadata: (input.metadata ?? {}) as Json,
    created_by: input.createdBy ?? null,
  };

  const { data, error } = await supabase
    .from("calendar_events")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new AppError(
      `이벤트 생성 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return data;
}

export const createEventAction = withErrorHandling(_createEvent);

/** 학습 이벤트 생성 (event + study_data 동시) */
async function _createStudyEvent(
  input: CreateStudyEventInput
): Promise<CalendarEventWithStudyData> {
  const event = await _createEvent(input);

  const supabase = await createSupabaseServerClient();
  const sd = input.studyData;

  const studyInsert: EventStudyDataInsert = {
    event_id: event.id,
    content_type: sd.contentType ?? null,
    content_id: sd.contentId ?? null,
    master_content_id: sd.masterContentId ?? null,
    flexible_content_id: sd.flexibleContentId ?? null,
    content_title: sd.contentTitle ?? null,
    subject_name: sd.subjectName ?? null,
    subject_category: sd.subjectCategory ?? null,
    planned_start_page: sd.plannedStartPage ?? null,
    planned_end_page: sd.plannedEndPage ?? null,
    chapter: sd.chapter ?? null,
    origin_plan_item_id: sd.originPlanItemId ?? null,
    estimated_minutes: sd.estimatedMinutes ?? 30,
    completion_status: "pending",
  };

  const { data: studyData, error } = await supabase
    .from("event_study_data")
    .insert(studyInsert)
    .select()
    .single();

  if (error) {
    throw new AppError(
      `학습 데이터 생성 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return { ...event, event_study_data: studyData };
}

export const createStudyEventAction = withErrorHandling(_createStudyEvent);

/** 이벤트 배치 생성 (스케줄 생성 시) */
async function _createEventsBatch(
  events: CalendarEventInsert[]
): Promise<{ count: number }> {
  const supabase = await createSupabaseServerClient();

  const BATCH_SIZE = 500;
  let totalCount = 0;

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("calendar_events")
      .insert(batch);

    if (error) {
      throw new AppError(
        `배치 이벤트 생성 실패 (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${error.message}`,
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    totalCount += batch.length;
  }

  return { count: totalCount };
}

export const createEventsBatchAction = withErrorHandling(_createEventsBatch);

// ============================================
// 수정
// ============================================

/** 이벤트 수정 */
async function _updateEvent(
  eventId: string,
  updates: UpdateEventInput
): Promise<CalendarEvent> {
  const supabase = await createSupabaseServerClient();

  const updateData: CalendarEventUpdate = {};
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined)
    updateData.description = updates.description;
  if (updates.location !== undefined) updateData.location = updates.location;
  if (updates.eventSubtype !== undefined)
    updateData.event_subtype = updates.eventSubtype;
  if (updates.startAt !== undefined) updateData.start_at = updates.startAt;
  if (updates.endAt !== undefined) updateData.end_at = updates.endAt;
  if (updates.startDate !== undefined)
    updateData.start_date = updates.startDate;
  if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
  if (updates.isAllDay !== undefined) updateData.is_all_day = updates.isAllDay;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.transparency !== undefined)
    updateData.transparency = updates.transparency;
  if (updates.containerType !== undefined)
    updateData.container_type = updates.containerType;
  if (updates.orderIndex !== undefined)
    updateData.order_index = updates.orderIndex;
  if (updates.color !== undefined) updateData.color = updates.color;
  if (updates.icon !== undefined) updateData.icon = updates.icon;
  if (updates.priority !== undefined) updateData.priority = updates.priority;
  if (updates.tags !== undefined) updateData.tags = updates.tags;
  if (updates.metadata !== undefined)
    updateData.metadata = updates.metadata as Json;

  const { data, error } = await supabase
    .from("calendar_events")
    .update(updateData)
    .eq("id", eventId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    throw new AppError(
      `이벤트 수정 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return data;
}

export const updateEventAction = withErrorHandling(_updateEvent);

/** 학습 추적 데이터 수정 */
async function _updateStudyData(
  eventId: string,
  updates: UpdateStudyDataInput
): Promise<EventStudyData> {
  const supabase = await createSupabaseServerClient();

  const updateData: EventStudyDataUpdate = {};
  if (updates.completionStatus !== undefined)
    updateData.completion_status = updates.completionStatus;
  if (updates.startedAt !== undefined)
    updateData.started_at = updates.startedAt;
  if (updates.completedAt !== undefined)
    updateData.completed_at = updates.completedAt;
  if (updates.estimatedMinutes !== undefined)
    updateData.estimated_minutes = updates.estimatedMinutes;
  if (updates.actualMinutes !== undefined)
    updateData.actual_minutes = updates.actualMinutes;
  if (updates.pausedAt !== undefined) updateData.paused_at = updates.pausedAt;
  if (updates.pausedDurationSeconds !== undefined)
    updateData.paused_duration_seconds = updates.pausedDurationSeconds;
  if (updates.pauseCount !== undefined)
    updateData.pause_count = updates.pauseCount;
  if (updates.completedAmount !== undefined)
    updateData.completed_amount = updates.completedAmount;
  if (updates.progress !== undefined) updateData.progress = updates.progress;
  if (updates.simpleCompletion !== undefined)
    updateData.simple_completion = updates.simpleCompletion;
  if (updates.simpleCompletedAt !== undefined)
    updateData.simple_completed_at = updates.simpleCompletedAt;
  if (updates.memo !== undefined) updateData.memo = updates.memo;

  const { data, error } = await supabase
    .from("event_study_data")
    .update(updateData)
    .eq("event_id", eventId)
    .select()
    .single();

  if (error) {
    throw new AppError(
      `학습 데이터 수정 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return data;
}

export const updateStudyDataAction = withErrorHandling(_updateStudyData);

/** 이벤트 상태 변경 (간편) */
async function _updateEventStatus(
  eventId: string,
  status: EventStatus
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("calendar_events")
    .update({ status })
    .eq("id", eventId)
    .is("deleted_at", null);

  if (error) {
    throw new AppError(
      `이벤트 상태 변경 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }
}

export const updateEventStatusAction = withErrorHandling(_updateEventStatus);

// ============================================
// 삭제 (soft delete)
// ============================================

async function _deleteEvent(eventId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("calendar_events")
    .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
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

export const deleteEventAction = withErrorHandling(_deleteEvent);

/** plan_group 기반 이벤트 일괄 삭제 */
async function _deleteEventsByPlanGroup(
  planGroupId: string
): Promise<{ deletedCount: number }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("calendar_events")
    .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
    .eq("plan_group_id", planGroupId)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    throw new AppError(
      `이벤트 일괄 삭제 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return { deletedCount: data?.length ?? 0 };
}

export const deleteEventsByPlanGroupAction = withErrorHandling(
  _deleteEventsByPlanGroup
);
