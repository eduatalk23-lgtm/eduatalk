'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  calendarEventKeys,
  studentPrimaryCalendarQueryOptions,
  dailyCalendarEventsQueryOptions,
  multiDailyCalendarEventsQueryOptions,
  weeklyCalendarEventsQueryOptions,
  overdueCalendarEventsQueryOptions,
  getWeekRange,
} from '@/lib/query-options/calendarEvents';
import type {
  CalendarEventWithStudyData,
  EventType,
} from '@/lib/domains/calendar/types';
import { expandRecurringEvents } from '@/lib/domains/calendar/rrule';
import { extractDateYMD } from '@/lib/domains/calendar/adapters';

// ============================================
// Calendar-First Helpers
// ============================================

/**
 * studentId → primary calendarId 해석
 * Calendar-First: calendars WHERE owner_id=studentId AND is_student_primary=true
 */
export function usePrimaryCalendar(studentId: string | undefined) {
  const query = useQuery({
    ...studentPrimaryCalendarQueryOptions(studentId ?? ''),
    enabled: !!studentId,
  });

  return {
    calendarId: query.data?.id,
    calendar: query.data ?? null,
    isLoading: query.isLoading,
  };
}

// ============================================
// 이벤트 필터 헬퍼
// ============================================

const NON_STUDY_EVENT_TYPES: EventType[] = ['non_study', 'academy', 'break'];

function filterByType(
  events: CalendarEventWithStudyData[],
  types: EventType[]
): CalendarEventWithStudyData[] {
  return events.filter((e) => types.includes(e.event_type as EventType));
}

// ============================================
// 합성 쿼리 훅
// ============================================

/**
 * 일간 캘린더 이벤트 쿼리
 *
 * Calendar-First: calendarId를 직접 받습니다.
 * 모든 event_type을 한 번에 fetch 후 클라이언트에서 분리합니다.
 */
export function useDailyCalendarEvents(
  studentId: string,
  calendarId: string | undefined,
  date: string,
  visibleCalendarIds?: string[] | null,
) {
  const queryClient = useQueryClient();
  // visibleCalendarIds가 배열이면 멀티 캘린더 모드 (빈 배열 = 모든 캘린더 숨김)
  const isMultiCalendar = Array.isArray(visibleCalendarIds);

  // 단일 캘린더 모드
  const singleQuery = useQuery({
    ...dailyCalendarEventsQueryOptions(calendarId ?? '', date),
    enabled: !!calendarId && !isMultiCalendar,
  });

  // 멀티 캘린더 모드 (빈 배열이면 queryFn이 [] 반환)
  const multiQuery = useQuery({
    ...multiDailyCalendarEventsQueryOptions(visibleCalendarIds ?? [], date),
    enabled: isMultiCalendar,
  });

  const rawEvents = useMemo(
    () => (isMultiCalendar ? multiQuery.data : singleQuery.data) ?? [],
    [isMultiCalendar, multiQuery.data, singleQuery.data],
  );

  // RRULE 반복 이벤트 확장 (일간: date~date 범위)
  const events = useMemo(
    () => expandRecurringEvents(rawEvents, date, date),
    [rawEvents, date]
  );

  const studyEvents = useMemo(
    () => events.filter((e) => e.event_type === 'study' && !e.is_all_day),
    [events]
  );

  const nonStudyEvents = useMemo(
    () => events.filter(
      (e) => NON_STUDY_EVENT_TYPES.includes(e.event_type as EventType) && !e.is_all_day
    ),
    [events]
  );

  const allDayEvents = useMemo(
    () => events.filter((e) => e.is_all_day),
    [events]
  );

  const academyEvents = useMemo(
    () => events.filter((e) => e.event_type === 'academy' && !e.is_all_day),
    [events]
  );

  const invalidate = useCallback(() => {
    if (isMultiCalendar && visibleCalendarIds) {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.multiDaily(visibleCalendarIds, date),
      });
    } else if (calendarId) {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.daily(calendarId, date),
      });
    }
  }, [queryClient, calendarId, date, isMultiCalendar, visibleCalendarIds]);

  return {
    events,
    studyEvents,
    nonStudyEvents,
    allDayEvents,
    academyEvents,
    calendarId,
    isLoading: isMultiCalendar ? multiQuery.isLoading : singleQuery.isLoading,
    invalidate,
  };
}

/**
 * 주간 캘린더 이벤트 쿼리
 *
 * Calendar-First: calendarId를 직접 받습니다.
 * weekStart 기준으로 월~일 범위를 자동 계산합니다.
 */
export function useWeeklyCalendarEvents(
  studentId: string,
  calendarId: string | undefined,
  weekStartDate: string
) {
  const queryClient = useQueryClient();
  const weekRange = getWeekRange(weekStartDate);

  const eventsQuery = useQuery({
    ...weeklyCalendarEventsQueryOptions(
      calendarId ?? '',
      weekRange.start,
      weekRange.end
    ),
    enabled: !!calendarId,
  });

  const rawEvents = useMemo(
    () => eventsQuery.data ?? [],
    [eventsQuery.data]
  );

  // RRULE 반복 이벤트 확장 (주간: weekRange 범위)
  const events = useMemo(
    () => expandRecurringEvents(rawEvents, weekRange.start, weekRange.end),
    [rawEvents, weekRange.start, weekRange.end]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventWithStudyData[]>();
    for (const event of events) {
      const dateKey = event.start_date ?? extractDateYMD(event.start_at) ?? '';
      if (!dateKey) continue;
      const existing = map.get(dateKey) ?? [];
      existing.push(event);
      map.set(dateKey, existing);
    }
    return map;
  }, [events]);

  const invalidate = useCallback(() => {
    if (calendarId) {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.weekly(calendarId, weekRange.start, weekRange.end),
      });
    }
  }, [queryClient, calendarId, weekRange.start, weekRange.end]);

  return {
    events,
    eventsByDate,
    calendarId,
    weekRange,
    isLoading: eventsQuery.isLoading,
    invalidate,
  };
}

/**
 * 미완료 캘린더 이벤트 쿼리
 *
 * Calendar-First: calendarId를 직접 받습니다.
 * 오늘 이전의 미완료(confirmed/tentative) 이벤트를 조회합니다.
 */
export function useOverdueCalendarEvents(
  studentId: string,
  calendarId: string | undefined
) {
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({
    ...overdueCalendarEventsQueryOptions(calendarId ?? ''),
    enabled: !!calendarId,
  });

  const invalidate = useCallback(() => {
    if (calendarId) {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.overdue(calendarId),
      });
    }
  }, [queryClient, calendarId]);

  return {
    events: eventsQuery.data ?? [],
    calendarId,
    isLoading: eventsQuery.isLoading,
    invalidate,
  };
}

// ============================================
// 타겟 무효화 훅
// ============================================

/**
 * 캘린더 이벤트 타겟 무효화
 *
 * 전체 무효화 대신 필요한 뷰만 무효화하여 네트워크 요청을 줄입니다.
 */
export function useCalendarEventInvalidation() {
  const queryClient = useQueryClient();

  const invalidateDaily = useCallback(
    (calendarId: string, date: string) => {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.daily(calendarId, date),
      });
    },
    [queryClient]
  );

  const invalidateWeekly = useCallback(
    (calendarId: string, date: string) => {
      const weekRange = getWeekRange(date);
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.weekly(
          calendarId,
          weekRange.start,
          weekRange.end
        ),
      });
    },
    [queryClient]
  );

  const invalidateOverdue = useCallback(
    (calendarId: string) => {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.overdue(calendarId),
      });
    },
    [queryClient]
  );

  /** events prefix로 daily/weekly/monthly/unfinished 일괄 무효화 */
  const invalidateAllEvents = useCallback(
    (calendarId: string) => {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.events(calendarId),
      });
    },
    [queryClient]
  );

  return {
    invalidateDaily,
    invalidateWeekly,
    invalidateOverdue,
    invalidateAllEvents,
  };
}

// Re-export for convenience
export { filterByType, NON_STUDY_EVENT_TYPES };
