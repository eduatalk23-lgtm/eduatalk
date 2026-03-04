/**
 * Calendar → Legacy Type Adapters
 *
 * 새 calendar_events 테이블 데이터를 기존 UI 컴포넌트가 소비하는
 * DailyPlan / NonStudyItem / AllDayItem / PlanItemData 형태로 변환합니다.
 */

import type { CalendarEventWithStudyData } from './types';
import type {
  DailyPlan,
  AllDayItem,
  OverduePlan,
} from '@/lib/query-options/adminDock';
import type { PlanItemData, PlanItemType } from '@/lib/types/planItem';
import type { PlanStatus } from '@/lib/types/plan';

// ============================================
// 헬퍼 함수
// ============================================

/** KST offset (UTC+9, Korea has no DST) */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** UTC Date → KST Date (UTC 기준으로 +9h 시프트, getUTC* 메서드로 KST 추출) */
function toKST(d: Date): Date {
  return new Date(d.getTime() + KST_OFFSET_MS);
}

/**
 * ISO timestamptz에서 KST HH:mm 추출
 *
 * Supabase PostgREST는 timestamptz를 UTC로 반환합니다.
 * 서버(UTC)/브라우저(KST) 환경 무관하게 KST 시간을 반환합니다.
 *
 * @example extractTimeHHMM("2026-02-23T05:15:00+00:00") → "14:15"
 */
export function extractTimeHHMM(isoString: string | null): string | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  const kst = toKST(d);
  const hh = kst.getUTCHours().toString().padStart(2, '0');
  const mm = kst.getUTCMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * ISO timestamptz에서 KST YYYY-MM-DD 추출
 *
 * UTC 자정 근처 이벤트의 경우 split('T')[0]으로는 잘못된 날짜가 추출됩니다.
 * 서버/브라우저 환경 무관하게 KST 날짜를 반환합니다.
 *
 * @example extractDateYMD("2026-02-22T16:00:00+00:00") → "2026-02-23" (KST 01:00)
 */
export function extractDateYMD(isoString: string | null): string | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  const kst = toKST(d);
  const yyyy = kst.getUTCFullYear();
  const mm = (kst.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = kst.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 캘린더 이벤트 상태 → 레거시 플랜 상태 매핑
 *
 * Event/Task 분리: done(boolean)이 완료 여부의 단일 진실 공급원.
 * eventStatus는 순수 이벤트 상태(confirmed/tentative/cancelled)만 표현.
 */
export function mapEventStatusToPlanStatus(
  eventStatus: string,
  done: boolean
): PlanStatus {
  if (done) return 'completed';

  switch (eventStatus) {
    case 'cancelled': return 'cancelled';
    case 'tentative': return 'draft';
    case 'confirmed':
    default: return 'pending';
  }
}


// ============================================
// 단일 변환 함수
// ============================================

/**
 * CalendarEvent → DailyPlan (기존 PlanItemCard 호환)
 *
 * study 이벤트 전용. event_study_data에서 학습 관련 필드를 매핑합니다.
 */
export function calendarEventToDailyPlan(
  event: CalendarEventWithStudyData
): DailyPlan {
  const sd = event.event_study_data;
  const startTime = extractTimeHHMM(event.start_at);
  const endTime = extractTimeHHMM(event.end_at);

  return {
    id: event.id,
    content_title: sd?.content_title ?? event.title,
    content_subject: sd?.subject_name ?? null,
    content_type: sd?.content_type ?? null,
    planned_start_page_or_time: sd?.planned_start_page ?? null,
    planned_end_page_or_time: sd?.planned_end_page ?? null,
    completed_amount: sd?.completed_amount ?? null,
    progress: sd?.progress ?? null,
    status: mapEventStatusToPlanStatus(event.status, sd?.done ?? false),
    actual_end_time: sd?.done_at ?? null,
    custom_title: event.title !== sd?.content_title ? event.title : null,
    custom_range_display: null,
    sequence: event.order_index ?? null,
    plan_group_id: event.plan_group_id ?? null,
    start_time: startTime,
    end_time: endTime,
    estimated_minutes: sd?.estimated_minutes ?? null,
    time_slot_type: null,
    week: null,
    day: null,
    day_type: null,
    cycle_day_number: null,
    plan_date: event.start_date ?? (extractDateYMD(event.start_at) ?? ''),
    carryover_count: null,
    carryover_from_date: null,
    color: event.color ?? null,
    calendar_id: event.calendar_id ?? null,
    rrule: event.rrule ?? null,
    recurring_event_id: event.recurring_event_id ?? null,
    is_exception: event.is_exception ?? null,
    exdates: (event.exdates as string[] | null) ?? null,
    reminder_minutes: event.reminder_minutes ?? null,
    description: event.description ?? null,
  };
}

/**
 * CalendarEvent → AllDayItem (종일 이벤트 표시)
 *
 * 멀티데이 이벤트: start_date ≠ end_date 이면 spanDays 계산
 */
export function calendarEventToAllDayItem(
  event: CalendarEventWithStudyData
): AllDayItem {
  const startDate = event.start_date ?? undefined;
  const endDate = event.end_date ?? undefined;

  let spanDays: number | undefined;
  if (startDate && endDate && startDate !== endDate) {
    const s = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    spanDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  return {
    id: event.id,
    type: event.event_type,
    label: event.title,
    exclusionType: event.event_subtype,
    color: event.color,
    calendarId: event.calendar_id,
    startDate,
    endDate,
    spanDays,
  };
}

/**
 * CalendarEvent → PlanItemData (통합 DnD/카드 컴포넌트)
 */
export function calendarEventToPlanItemData(
  event: CalendarEventWithStudyData
): PlanItemData {
  const sd = event.event_study_data;
  const status = mapEventStatusToPlanStatus(
    event.status,
    sd?.done ?? false
  );

  const eventKind = event.event_type as PlanItemData['eventKind'];
  const itemType: PlanItemType = event.event_type === 'custom' ? 'adhoc' : 'plan';

  return {
    id: event.id,
    type: itemType,
    title: event.title,
    subject: sd?.subject_name ?? undefined,
    contentType: sd?.content_type ?? undefined,
    pageRangeStart: sd?.planned_start_page ?? null,
    pageRangeEnd: sd?.planned_end_page ?? null,
    completedAmount: sd?.completed_amount ?? null,
    progress: sd?.progress ?? null,
    status,
    isCompleted: sd?.done ?? false,
    customTitle: event.title !== sd?.content_title ? event.title : null,
    customRangeDisplay: null,
    estimatedMinutes: sd?.estimated_minutes ?? null,
    planDate: event.start_date ?? extractDateYMD(event.start_at) ?? undefined,
    startTime: extractTimeHHMM(event.start_at),
    endTime: extractTimeHHMM(event.end_at),
    carryoverCount: 0,
    carryoverFromDate: null,
    planGroupId: event.plan_group_id ?? null,
    timeSlotType: null,
    color: event.color ?? null,
    calendarId: event.calendar_id ?? null,
    rrule: event.rrule ?? null,
    recurringEventId: event.recurring_event_id ?? null,
    isException: event.is_exception ?? null,
    exdates: (event.exdates as string[] | null) ?? null,
    reminderMinutes: event.reminder_minutes ?? null,
    description: event.description ?? null,
    eventKind,
    eventSubtype: event.event_subtype ?? undefined,
    isTask: event.is_task ?? false,
  };
}

/** custom 이벤트 (종일 아님) → PlanItemData[] (calendar_events 직접 변환) */
export function calendarEventsToCustomPlanItems(
  events: CalendarEventWithStudyData[]
): PlanItemData[] {
  return events
    .filter((e) => e.event_type === 'custom' && !e.is_all_day)
    .map(calendarEventToPlanItemData);
}

// ============================================
// 배치 변환 유틸리티
// ============================================

/** study 이벤트 (종일 아님) → DailyPlan[] */
export function calendarEventsToDailyPlans(
  events: CalendarEventWithStudyData[]
): DailyPlan[] {
  return events
    .filter((e) => e.event_type === 'study' && !e.is_all_day)
    .map(calendarEventToDailyPlan);
}

/** non_study/academy/break 이벤트 (종일 아님) → PlanItemData[] (통합 UI용) */
export function calendarEventsToNonStudyPlanItems(
  events: CalendarEventWithStudyData[]
): PlanItemData[] {
  return events
    .filter(
      (e) =>
        ['non_study', 'academy', 'break', 'focus_time'].includes(e.event_type) &&
        !e.is_all_day
    )
    .map(calendarEventToPlanItemData);
}

/** 종일 이벤트 → AllDayItem[] */
export function calendarEventsToAllDayItems(
  events: CalendarEventWithStudyData[]
): AllDayItem[] {
  return events
    .filter((e) => e.is_all_day)
    .map(calendarEventToAllDayItem);
}

/**
 * CalendarEvent → OverduePlan (미완료 이벤트)
 *
 * 과거 미완료 study 이벤트를 OverduePlan 형태로 변환합니다.
 */
export function calendarEventToOverduePlan(
  event: CalendarEventWithStudyData
): OverduePlan {
  const sd = event.event_study_data;
  return {
    id: event.id,
    plan_date: event.start_date ?? (extractDateYMD(event.start_at) ?? ''),
    content_title: sd?.content_title ?? event.title,
    content_subject: sd?.subject_name ?? null,
    content_type: sd?.content_type ?? null,
    planned_start_page_or_time: sd?.planned_start_page ?? null,
    planned_end_page_or_time: sd?.planned_end_page ?? null,
    carryover_from_date: null,
    carryover_count: 0,
    custom_title: event.title !== sd?.content_title ? event.title : null,
    status: mapEventStatusToPlanStatus(event.status, sd?.done ?? false),
    plan_group_id: event.plan_group_id ?? null,
    time_slot_type: null,
    week: null,
    day: null,
    day_type: null,
    cycle_day_number: null,
    container_type: 'daily',
  };
}

/** 미완료 study 이벤트 → OverduePlan[] */
export function calendarEventsToOverduePlans(
  events: CalendarEventWithStudyData[]
): OverduePlan[] {
  return events
    .filter((e) => e.event_type === 'study' && !e.is_all_day)
    .map(calendarEventToOverduePlan);
}

// ============================================
// 월간 캘린더 뷰 어댑터
// ============================================

/**
 * CalendarEvent → 월간/어젠다 뷰용 플랜 데이터
 *
 * CalendarPlan 타입(@see _types/adminCalendar.ts)과 호환되는 객체를 반환합니다.
 * 종일 이벤트를 포함한 모든 이벤트를 변환합니다.
 */
export function calendarEventToMonthlyPlan(
  event: CalendarEventWithStudyData
) {
  const sd = event.event_study_data;
  const startTime = extractTimeHHMM(event.start_at);
  const endTime = extractTimeHHMM(event.end_at);
  const planDate = event.start_date ?? extractDateYMD(event.start_at) ?? '';

  return {
    id: event.id,
    plan_date: planDate,
    content_type: sd?.content_type ?? event.event_type,
    content_id: sd?.content_id ?? null,
    content_title: sd?.content_title ?? event.title,
    content_subject: sd?.subject_name ?? null,
    content_subject_category: sd?.subject_category ?? null,
    status: mapEventStatusToPlanStatus(event.status, sd?.done ?? false) as string | null,
    start_time: event.is_all_day ? null : startTime,
    end_time: event.is_all_day ? null : endTime,
    estimated_minutes: sd?.estimated_minutes ?? null,
    planned_start_page_or_time: sd?.planned_start_page ?? null,
    planned_end_page_or_time: sd?.planned_end_page ?? null,
    progress: sd?.progress ?? null,
    custom_title: event.title !== sd?.content_title ? event.title : null,
    custom_range_display: null,
    plan_group_id: event.plan_group_id ?? null,
    container_type: 'daily' as const,
    sequence: event.order_index ?? null,
    time_slot_type: null as 'study' | 'self_study' | null,
    week: null as number | null,
    day: null as number | null,
    day_type: null as string | null,
    cycle_day_number: null as number | null,
    color: event.color ?? null,
    calendar_id: event.calendar_id ?? null,
    rrule: event.rrule ?? null,
    recurring_event_id: event.recurring_event_id ?? null,
    is_exception: event.is_exception ?? null,
  };
}
