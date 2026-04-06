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
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { invalidateCalendarSchedule } from "@/lib/cache/calendarCache";
import {
  checkCalendarAccess,
  checkCalendarAccessByCalendarId,
  checkCalendarAccessByEventId,
  checkCalendarAccessByPlanGroupId,
} from "./calendarAuth";
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

/** 스케줄에 영향을 주는 이벤트인지 확인 (제외일, 학원, 이동시간) */
const SCHEDULE_AFFECTING_LABELS = new Set(["학원", "이동시간"]);
function isScheduleAffectingEvent(event: { is_exclusion?: boolean | null; label?: string | null }): boolean {
  return !!(event.is_exclusion || (event.label && SCHEDULE_AFFECTING_LABELS.has(event.label)));
}

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
  /** @deprecated label + isTask + isExclusion 사용 */
  eventType: EventType;
  /** @deprecated label 사용 */
  eventSubtype?: string;
  label?: string;
  isTask?: boolean;
  isExclusion?: boolean;

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
  done?: boolean;
  doneAt?: string | null;
  doneBy?: string | null;
  startedAt?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  pausedAt?: string | null;
  pausedDurationSeconds?: number;
  pauseCount?: number;
  completedAmount?: number;
  progress?: number;
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
  await checkCalendarAccessByCalendarId(calendarId);
  const supabase = await createSupabaseServerClient();

  // NOTE: includeStudyData=false 시 JOIN 생략하려면 반환 타입도 분리 필요
  const selectFields = "*, event_study_data(*), consultation_event_data(*)";

  let query = supabase
    .from("calendar_events")
    .select(selectFields)
    .eq("calendar_id", calendarId)
    .is("deleted_at", null);

  // 시간 범위: 시간 이벤트(overlap) OR 종일 이벤트(overlap)
  query = query.or(
    `and(is_all_day.eq.false,start_at.lte.${endDate}T23:59:59+09:00,end_at.gte.${startDate}),and(is_all_day.eq.true,start_date.lte.${endDate},end_date.gte.${startDate})`
  );

  // eventTypes filter (deprecated, kept for backward compatibility)
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
  await checkCalendarAccessByCalendarId(calendarId);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*, event_study_data(*), consultation_event_data(*)")
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
  await checkCalendarAccess(input.studentId);
  const supabase = await createSupabaseServerClient();

  // created_by / creator_role 자동 설정
  const currentUser = await getCurrentUser();
  const createdBy = input.createdBy ?? currentUser?.userId ?? null;
  const creatorRole = currentUser?.role === 'student' ? 'student' : 'admin';

  const label = input.label ?? input.eventSubtype ?? (input.eventType === 'study' ? '학습' : '일반');
  const isTask = input.isTask ?? (input.eventType === 'study' || input.eventType === 'custom');
  const isExclusion = input.isExclusion ?? (input.eventType === 'exclusion');

  const insertData: CalendarEventInsert = {
    calendar_id: input.calendarId,
    tenant_id: input.tenantId,
    student_id: input.studentId,
    title: input.title,
    description: input.description ?? null,
    location: input.location ?? null,
    event_type: input.eventType,
    event_subtype: input.eventSubtype ?? null,
    label,
    is_task: isTask,
    is_exclusion: isExclusion,
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
    created_by: createdBy,
    creator_role: creatorRole,
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

  // 제외일/학원 이벤트 생성 시 스케줄 캐시 무효화
  if (data.calendar_id && isScheduleAffectingEvent(data)) {
    invalidateCalendarSchedule(data.calendar_id);
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
    done: false,
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
  if (events.length === 0) return { count: 0 };
  // 배치의 첫 이벤트 기준으로 접근 권한 확인
  await checkCalendarAccess(events[0].student_id);
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

  // 배치 생성 후 스케줄 캐시 무효화 (제외일/학원 포함 가능)
  const calendarIds = new Set(events.map((e) => e.calendar_id).filter(Boolean));
  for (const cid of calendarIds) {
    if (cid) invalidateCalendarSchedule(cid);
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
  await checkCalendarAccessByEventId(eventId);
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

  // 제외일/학원 이벤트 수정 시 스케줄 캐시 무효화
  if (data.calendar_id && isScheduleAffectingEvent(data)) {
    invalidateCalendarSchedule(data.calendar_id);
  }

  return data;
}

export const updateEventAction = withErrorHandling(_updateEvent);

/** 학습 추적 데이터 수정 */
async function _updateStudyData(
  eventId: string,
  updates: UpdateStudyDataInput
): Promise<EventStudyData> {
  await checkCalendarAccessByEventId(eventId);
  const supabase = await createSupabaseServerClient();

  const updateData: EventStudyDataUpdate = {};
  if (updates.done !== undefined) updateData.done = updates.done;
  if (updates.doneAt !== undefined) updateData.done_at = updates.doneAt;
  if (updates.doneBy !== undefined) updateData.done_by = updates.doneBy;
  if (updates.startedAt !== undefined)
    updateData.started_at = updates.startedAt;
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
  await checkCalendarAccessByEventId(eventId);
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
  await checkCalendarAccessByEventId(eventId);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("calendar_events")
    .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
    .eq("id", eventId)
    .is("deleted_at", null)
    .select("calendar_id, is_exclusion, label")
    .maybeSingle();

  if (error) {
    throw new AppError(
      `이벤트 삭제 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  // 제외일/학원 이벤트 삭제 시 스케줄 캐시 무효화
  if (data?.calendar_id && isScheduleAffectingEvent(data)) {
    invalidateCalendarSchedule(data.calendar_id);
  }
}

export const deleteEventAction = withErrorHandling(_deleteEvent);

/** plan_group 기반 이벤트 일괄 삭제 */
async function _deleteEventsByPlanGroup(
  planGroupId: string
): Promise<{ deletedCount: number }> {
  await checkCalendarAccessByPlanGroupId(planGroupId);
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
