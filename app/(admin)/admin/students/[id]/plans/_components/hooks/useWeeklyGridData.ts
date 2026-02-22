'use client';

import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  calendarEventKeys,
  calendarsByPlannerQueryOptions,
  weeklyCalendarEventsQueryOptions,
} from '@/lib/query-options/calendarEvents';
import type { CalendarEventWithStudyData } from '@/lib/domains/calendar/types';
import {
  calendarEventsToDailyPlans,
  calendarEventsToAdHocPlans,
  calendarEventsToNonStudyItems,
  calendarEventsToAllDayItems,
} from '@/lib/domains/calendar/adapters';
import type {
  DailyPlan,
  AdHocPlan,
  NonStudyItem,
  AllDayItem,
} from '@/lib/query-options/adminDock';
import { getWeekDates, getWeekRangeSunSat } from '../utils/weekDateUtils';

export interface DayColumnData {
  date: string;
  plans: DailyPlan[];
  adHocPlans: AdHocPlan[];
  nonStudyItems: NonStudyItem[];
  allDayItems: AllDayItem[];
  isLoading: boolean;
}

/**
 * 주간 그리드 데이터 훅 (1-query 아키텍처)
 *
 * 기존 28개 병렬 쿼리(7일 × 4 타입)를 단일 weeklyCalendarEvents 쿼리로 교체.
 * calendarId 해석(calendars 쿼리) → 주간 이벤트 fetch → 날짜별 그룹핑 + 어댑터 변환.
 *
 * calendars 쿼리는 CACHE_STALE_TIME_STABLE(30분)으로 세션 중 1회만 fetch.
 * 2번째 주간 네비게이션부터는 events 쿼리 1개만 발사.
 */
export function useWeeklyGridData(
  studentId: string,
  selectedDate: string,
  plannerId?: string,
) {
  const queryClient = useQueryClient();

  // 1. 일~토 7일 배열
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  // 2. 주간 범위 (Sun-Sat, calendarEvents.ts의 Mon-Sun과 구분)
  const weekRange = useMemo(() => getWeekRangeSunSat(selectedDate), [selectedDate]);

  // 3. plannerId → primary calendarId 해석
  const calendarsQuery = useQuery({
    ...calendarsByPlannerQueryOptions(plannerId ?? ''),
    enabled: !!plannerId,
  });

  const calendarId = useMemo(() => {
    if (!calendarsQuery.data?.length) return undefined;
    const primary = calendarsQuery.data.find((c) => c.is_primary);
    return (primary ?? calendarsQuery.data[0])?.id;
  }, [calendarsQuery.data]);

  // 4. 주간 전체 이벤트 1회 fetch
  const eventsQuery = useQuery({
    ...weeklyCalendarEventsQueryOptions(
      calendarId ?? '',
      weekRange.start,
      weekRange.end,
    ),
    enabled: !!calendarId,
  });

  const allEvents = useMemo(
    () => eventsQuery.data ?? [],
    [eventsQuery.data],
  );

  // 5. 날짜별 그룹핑 → 어댑터 적용 → DayColumnData Map
  const dayDataMap = useMemo(() => {
    // 날짜별 이벤트 그룹핑
    const eventsByDate = new Map<string, CalendarEventWithStudyData[]>();
    for (const date of weekDates) {
      eventsByDate.set(date, []);
    }
    for (const event of allEvents) {
      const dateKey = event.start_date ?? event.start_at?.split('T')[0] ?? '';
      if (eventsByDate.has(dateKey)) {
        eventsByDate.get(dateKey)!.push(event);
      }
      // 주 범위 밖 이벤트는 무시 (map.has 가드)
    }

    const isLoading = calendarsQuery.isLoading || eventsQuery.isLoading;

    // 어댑터 변환
    const map = new Map<string, DayColumnData>();
    for (const date of weekDates) {
      const dayEvents = eventsByDate.get(date) ?? [];
      map.set(date, {
        date,
        plans: calendarEventsToDailyPlans(dayEvents),
        adHocPlans: calendarEventsToAdHocPlans(dayEvents),
        nonStudyItems: calendarEventsToNonStudyItems(dayEvents),
        allDayItems: calendarEventsToAllDayItems(dayEvents),
        isLoading,
      });
    }
    return map;
  }, [weekDates, allEvents, calendarsQuery.isLoading, eventsQuery.isLoading]);

  const isAnyLoading = calendarsQuery.isLoading || eventsQuery.isLoading;

  /** 특정 날짜의 캐시 무효화 (주간 단위로 통합 — date 파라미터는 API 호환용) */
  const invalidateDate = useCallback(
    (_date: string) => {
      if (calendarId) {
        queryClient.invalidateQueries({
          queryKey: calendarEventKeys.weekly(calendarId, weekRange.start, weekRange.end),
        });
      }
    },
    [queryClient, calendarId, weekRange.start, weekRange.end],
  );

  /** 전체 주간 캐시 무효화 */
  const invalidateAll = useCallback(() => {
    if (calendarId) {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.weekly(calendarId, weekRange.start, weekRange.end),
      });
    }
  }, [queryClient, calendarId, weekRange.start, weekRange.end]);

  return {
    weekDates,
    dayDataMap,
    isAnyLoading,
    invalidateDate,
    invalidateAll,
  };
}
