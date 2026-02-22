'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  calendarEventKeys,
  calendarsByPlannerQueryOptions,
  dailyCalendarEventsQueryOptions,
  weeklyCalendarEventsQueryOptions,
  unfinishedCalendarEventsQueryOptions,
  availabilitySchedulesQueryOptions,
  getWeekRange,
} from '@/lib/query-options/calendarEvents';
import type {
  CalendarEventWithStudyData,
  EventType,
} from '@/lib/domains/calendar/types';

// ============================================
// Internal Helper: Primary Calendar 해석
// ============================================

/**
 * plannerId → primary calendarId 해석
 * calendars 테이블에서 is_primary=true인 캘린더를 찾습니다.
 */
function usePrimaryCalendar(plannerId: string | undefined) {
  const query = useQuery({
    ...calendarsByPlannerQueryOptions(plannerId ?? ''),
    enabled: !!plannerId,
  });

  const calendarId = useMemo(() => {
    if (!query.data?.length) return undefined;
    const primary = query.data.find((c) => c.is_primary);
    return (primary ?? query.data[0])?.id;
  }, [query.data]);

  return {
    calendarId,
    calendars: query.data ?? [],
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
 * 모든 event_type을 한 번에 fetch 후 클라이언트에서 분리합니다.
 * calendarId가 없으면(plannerId → calendar 해석 대기 중) 쿼리를 비활성화합니다.
 */
export function useDailyCalendarEvents(
  studentId: string,
  plannerId: string | undefined,
  date: string
) {
  const queryClient = useQueryClient();
  const { calendarId, isLoading: calendarLoading } = usePrimaryCalendar(plannerId);

  const eventsQuery = useQuery({
    ...dailyCalendarEventsQueryOptions(calendarId ?? '', date),
    enabled: !!calendarId,
  });

  const events = useMemo(
    () => eventsQuery.data ?? [],
    [eventsQuery.data]
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
    if (calendarId) {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.daily(calendarId, date),
      });
    }
  }, [queryClient, calendarId, date]);

  return {
    events,
    studyEvents,
    nonStudyEvents,
    allDayEvents,
    academyEvents,
    calendarId,
    isLoading: calendarLoading || eventsQuery.isLoading,
    invalidate,
  };
}

/**
 * 주간 캘린더 이벤트 쿼리
 *
 * weekStart 기준으로 월~일 범위를 자동 계산합니다.
 * eventsByDate Map을 반환하여 각 날짜별 이벤트 접근을 편리하게 합니다.
 */
export function useWeeklyCalendarEvents(
  studentId: string,
  plannerId: string | undefined,
  weekStartDate: string
) {
  const queryClient = useQueryClient();
  const { calendarId, isLoading: calendarLoading } = usePrimaryCalendar(plannerId);
  const weekRange = getWeekRange(weekStartDate);

  const eventsQuery = useQuery({
    ...weeklyCalendarEventsQueryOptions(
      calendarId ?? '',
      weekRange.start,
      weekRange.end
    ),
    enabled: !!calendarId,
  });

  const events = useMemo(
    () => eventsQuery.data ?? [],
    [eventsQuery.data]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventWithStudyData[]>();
    for (const event of events) {
      const dateKey = event.start_date ?? event.start_at?.split('T')[0] ?? '';
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
    isLoading: calendarLoading || eventsQuery.isLoading,
    invalidate,
  };
}

/**
 * 미완료 캘린더 이벤트 쿼리
 *
 * 오늘 이전의 미완료(confirmed/tentative) 이벤트를 조회합니다.
 */
export function useUnfinishedCalendarEvents(
  studentId: string,
  plannerId: string | undefined
) {
  const queryClient = useQueryClient();
  const { calendarId, isLoading: calendarLoading } = usePrimaryCalendar(plannerId);

  const eventsQuery = useQuery({
    ...unfinishedCalendarEventsQueryOptions(calendarId ?? ''),
    enabled: !!calendarId,
  });

  const invalidate = useCallback(() => {
    if (calendarId) {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.unfinished(calendarId),
      });
    }
  }, [queryClient, calendarId]);

  return {
    events: eventsQuery.data ?? [],
    calendarId,
    isLoading: calendarLoading || eventsQuery.isLoading,
    invalidate,
  };
}

/**
 * 가용성 스케줄 쿼리
 *
 * 플래너별 availability_schedules + availability_windows를 조회합니다.
 * defaultSchedule: is_default=true인 스케줄을 자동 추출합니다.
 */
export function useAvailabilitySchedules(plannerId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    ...availabilitySchedulesQueryOptions(plannerId ?? ''),
    enabled: !!plannerId,
  });

  const schedules = useMemo(
    () => query.data ?? [],
    [query.data]
  );

  const defaultSchedule = useMemo(() => {
    return schedules.find((s) => s.is_default) ?? schedules[0] ?? null;
  }, [schedules]);

  const invalidate = useCallback(() => {
    if (plannerId) {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.availabilitySchedules(plannerId),
      });
    }
  }, [queryClient, plannerId]);

  return {
    schedules,
    defaultSchedule,
    isLoading: query.isLoading,
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

  const invalidateUnfinished = useCallback(
    (calendarId: string) => {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.unfinished(calendarId),
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

  const invalidateAvailability = useCallback(
    (plannerId: string) => {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.availability(plannerId),
      });
    },
    [queryClient]
  );

  return {
    invalidateDaily,
    invalidateWeekly,
    invalidateUnfinished,
    invalidateAllEvents,
    invalidateAvailability,
  };
}

// Re-export for convenience
export { filterByType, NON_STUDY_EVENT_TYPES };
