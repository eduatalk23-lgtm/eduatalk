/**
 * Calendar → Legacy Type Adapters
 *
 * 새 calendar_events 테이블 데이터를 기존 UI 컴포넌트가 소비하는
 * DailyPlan / NonStudyItem / AllDayItem / PlanItemData 형태로 변환합니다.
 */

import type { CalendarEventWithStudyData, EventType } from './types';
import type {
  DailyPlan,
  AdHocPlan,
  NonStudyItem,
  AllDayItem,
  UnfinishedPlan,
} from '@/lib/query-options/adminDock';
import type { PlanItemData } from '@/lib/types/planItem';
import type { PlanStatus } from '@/lib/types/plan';

// ============================================
// 헬퍼 함수
// ============================================

/**
 * ISO timestamp에서 HH:mm 추출
 * @example extractTimeHHMM("2026-02-22T09:00:00+09:00") → "09:00"
 */
export function extractTimeHHMM(isoString: string | null): string | null {
  if (!isoString) return null;
  // "T" 뒤의 HH:mm 부분 추출
  const match = isoString.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

/**
 * 캘린더 이벤트 상태 → 레거시 플랜 상태 매핑
 */
export function mapEventStatusToPlanStatus(
  eventStatus: string,
  completionStatus: string | null
): PlanStatus {
  // 학습 데이터의 completionStatus 우선
  if (completionStatus) {
    switch (completionStatus) {
      case 'completed': return 'completed';
      case 'in_progress': return 'in_progress';
      case 'skipped': return 'cancelled';
      case 'pending': return 'pending';
    }
  }

  // 이벤트 상태 기반 폴백
  switch (eventStatus) {
    case 'completed': return 'completed';
    case 'cancelled': return 'cancelled';
    case 'tentative': return 'draft';
    case 'confirmed':
    default: return 'pending';
  }
}

/**
 * event_type → NonStudyItem type 매핑
 */
function mapEventTypeToNonStudyType(
  eventType: EventType,
  eventSubtype: string | null
): NonStudyItem['type'] {
  if (eventType === 'academy') return '학원';

  const subtypeMap: Record<string, NonStudyItem['type']> = {
    '아침식사': '아침식사',
    '점심식사': '점심식사',
    '저녁식사': '저녁식사',
    '수면': '수면',
    '이동시간': '이동시간',
    '학원': '학원',
  };

  if (eventSubtype && eventSubtype in subtypeMap) {
    return subtypeMap[eventSubtype];
  }

  return '기타';
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
    status: mapEventStatusToPlanStatus(event.status, sd?.completion_status ?? null),
    actual_end_time: sd?.completed_at ?? null,
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
    plan_date: event.start_date ?? (event.start_at?.split('T')[0] ?? ''),
    carryover_count: null,
    carryover_from_date: null,
  };
}

/**
 * CalendarEvent → NonStudyItem (기존 DailyDock 호환)
 *
 * non_study / academy / break 이벤트 전용.
 */
export function calendarEventToNonStudyItem(
  event: CalendarEventWithStudyData
): NonStudyItem {
  const startTime = extractTimeHHMM(event.start_at) ?? '00:00';
  const endTime = extractTimeHHMM(event.end_at) ?? '00:00';

  return {
    id: event.id,
    type: mapEventTypeToNonStudyType(
      event.event_type as EventType,
      event.event_subtype
    ),
    start_time: startTime,
    end_time: endTime,
    label: event.title,
    hasOverride: false,
  };
}

/**
 * CalendarEvent → AllDayItem (종일 이벤트 표시)
 */
export function calendarEventToAllDayItem(
  event: CalendarEventWithStudyData
): AllDayItem {
  return {
    id: event.id,
    type: event.event_type,
    label: event.title,
    exclusionType: event.event_subtype,
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
    sd?.completion_status ?? null
  );

  return {
    id: event.id,
    type: 'plan',
    title: event.title,
    subject: sd?.subject_name ?? undefined,
    contentType: sd?.content_type ?? undefined,
    pageRangeStart: sd?.planned_start_page ?? null,
    pageRangeEnd: sd?.planned_end_page ?? null,
    completedAmount: sd?.completed_amount ?? null,
    progress: sd?.progress ?? null,
    status,
    isCompleted: status === 'completed' || sd?.completed_at != null,
    customTitle: event.title !== sd?.content_title ? event.title : null,
    customRangeDisplay: null,
    estimatedMinutes: sd?.estimated_minutes ?? null,
    planDate: event.start_date ?? event.start_at?.split('T')[0],
    startTime: extractTimeHHMM(event.start_at),
    endTime: extractTimeHHMM(event.end_at),
    carryoverCount: 0,
    carryoverFromDate: null,
    planGroupId: event.plan_group_id ?? null,
    timeSlotType: null,
  };
}

/**
 * AdHocPlan + start_time/end_time
 *
 * 기존 AdHocPlan에는 시간 필드가 없지만 WeeklyGridColumn이
 * unsafe cast로 접근합니다. 이 서브타입으로 안전하게 제공하며
 * AdHocPlan[]로 업캐스트 시 구조적 서브타이핑으로 호환됩니다.
 */
export interface AdHocPlanWithTime extends AdHocPlan {
  start_time: string | null;
  end_time: string | null;
}

/**
 * CalendarEvent → AdHocPlanWithTime (custom 이벤트)
 */
export function calendarEventToAdHocPlan(
  event: CalendarEventWithStudyData
): AdHocPlanWithTime {
  const sd = event.event_study_data;
  return {
    id: event.id,
    title: event.title,
    status: mapEventStatusToPlanStatus(event.status, sd?.completion_status ?? null),
    estimated_minutes: sd?.estimated_minutes ?? null,
    start_time: extractTimeHHMM(event.start_at),
    end_time: extractTimeHHMM(event.end_at),
  };
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

/** custom 이벤트 (종일 아님) → AdHocPlanWithTime[] */
export function calendarEventsToAdHocPlans(
  events: CalendarEventWithStudyData[]
): AdHocPlanWithTime[] {
  return events
    .filter((e) => e.event_type === 'custom' && !e.is_all_day)
    .map(calendarEventToAdHocPlan);
}

/** non_study/academy/break 이벤트 (종일 아님) → NonStudyItem[] */
export function calendarEventsToNonStudyItems(
  events: CalendarEventWithStudyData[]
): NonStudyItem[] {
  return events
    .filter(
      (e) =>
        ['non_study', 'academy', 'break'].includes(e.event_type) &&
        !e.is_all_day
    )
    .map(calendarEventToNonStudyItem);
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
 * CalendarEvent → UnfinishedPlan (미완료 이벤트)
 *
 * 과거 미완료 study 이벤트를 기존 UnfinishedDock 호환 형태로 변환합니다.
 */
export function calendarEventToUnfinishedPlan(
  event: CalendarEventWithStudyData
): UnfinishedPlan {
  const sd = event.event_study_data;
  return {
    id: event.id,
    plan_date: event.start_date ?? (event.start_at?.split('T')[0] ?? ''),
    content_title: sd?.content_title ?? event.title,
    content_subject: sd?.subject_name ?? null,
    content_type: sd?.content_type ?? null,
    planned_start_page_or_time: sd?.planned_start_page ?? null,
    planned_end_page_or_time: sd?.planned_end_page ?? null,
    carryover_from_date: null,
    carryover_count: 0,
    custom_title: event.title !== sd?.content_title ? event.title : null,
    status: mapEventStatusToPlanStatus(event.status, sd?.completion_status ?? null),
    plan_group_id: event.plan_group_id ?? null,
    time_slot_type: null,
    week: null,
    day: null,
    day_type: null,
    cycle_day_number: null,
    container_type: 'unfinished',
  };
}

/** 미완료 study 이벤트 → UnfinishedPlan[] */
export function calendarEventsToUnfinishedPlans(
  events: CalendarEventWithStudyData[]
): UnfinishedPlan[] {
  return events
    .filter((e) => e.event_type === 'study' && !e.is_all_day)
    .map(calendarEventToUnfinishedPlan);
}
