'use client';

import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  calendarEventKeys,
  weeklyCalendarEventsQueryOptions,
  multiWeeklyCalendarEventsQueryOptions,
} from '@/lib/query-options/calendarEvents';
import type { CalendarEventWithStudyData } from '@/lib/domains/calendar/types';
import { expandRecurringEvents } from '@/lib/domains/calendar/rrule';
import {
  calendarEventsToDailyPlans,
  calendarEventsToCustomPlanItems,
  calendarEventsToNonStudyPlanItems,
  calendarEventsToAllDayItems,
  extractDateYMD,
} from '@/lib/domains/calendar/adapters';
import type { DayColumnData } from './useWeeklyGridData';
import { getTwoWeekDates, getTwoWeekRange } from '../utils/weekDateUtils';

/**
 * 2주간 그리드 데이터 훅
 *
 * useWeeklyGridData와 동일한 1-query 아키텍처를 따르되,
 * 14일 범위를 단일 쿼리로 가져와 week1/week2로 분리 반환.
 */
export function useTwoWeekGridData(
  studentId: string,
  selectedDate: string,
  calendarIdProp?: string,
  visibleCalendarIds?: string[] | null,
  weekStartsOn = 0,
) {
  const queryClient = useQueryClient();
  const isMultiCalendar = Array.isArray(visibleCalendarIds);

  // 1. 2주 날짜 배열
  const [week1Dates, week2Dates] = useMemo(
    () => getTwoWeekDates(selectedDate, weekStartsOn),
    [selectedDate, weekStartsOn],
  );

  const allDates = useMemo(() => [...week1Dates, ...week2Dates], [week1Dates, week2Dates]);

  // 2. 14일 범위
  const range = useMemo(
    () => getTwoWeekRange(selectedDate, weekStartsOn),
    [selectedDate, weekStartsOn],
  );

  // 3. calendarId
  const calendarId = useMemo(() => {
    if (isMultiCalendar && visibleCalendarIds!.length > 0) return visibleCalendarIds![0];
    return calendarIdProp;
  }, [calendarIdProp, isMultiCalendar, visibleCalendarIds]);

  // 4a. 단일 캘린더 모드
  const singleEventsQuery = useQuery({
    ...weeklyCalendarEventsQueryOptions(
      calendarId ?? '',
      range.start,
      range.end,
    ),
    enabled: !!calendarId && !isMultiCalendar,
  });

  // 4b. 멀티 캘린더 모드
  const multiEventsQuery = useQuery({
    ...multiWeeklyCalendarEventsQueryOptions(
      visibleCalendarIds ?? [],
      range.start,
      range.end,
    ),
    enabled: isMultiCalendar,
  });

  const rawEvents = useMemo(
    () => (isMultiCalendar ? multiEventsQuery.data : singleEventsQuery.data) ?? [],
    [isMultiCalendar, multiEventsQuery.data, singleEventsQuery.data],
  );

  const allEvents = useMemo(
    () => expandRecurringEvents(rawEvents, range.start, range.end),
    [rawEvents, range.start, range.end],
  );

  const eventsLoading = isMultiCalendar ? multiEventsQuery.isLoading : singleEventsQuery.isLoading;

  // 5. 날짜별 그룹핑 → DayColumnData Map (14일 전체)
  const dayDataMap = useMemo(() => {
    const eventsByDate = new Map<string, CalendarEventWithStudyData[]>();
    for (const date of allDates) {
      eventsByDate.set(date, []);
    }
    for (const event of allEvents) {
      const dateKey = event.start_date ?? extractDateYMD(event.start_at) ?? '';
      if (eventsByDate.has(dateKey)) {
        eventsByDate.get(dateKey)!.push(event);
      }
    }

    const map = new Map<string, DayColumnData>();
    for (const date of allDates) {
      const dayEvents = eventsByDate.get(date) ?? [];
      map.set(date, {
        date,
        plans: calendarEventsToDailyPlans(dayEvents),
        customItems: calendarEventsToCustomPlanItems(dayEvents),
        nonStudyItems: calendarEventsToNonStudyPlanItems(dayEvents),
        allDayItems: calendarEventsToAllDayItems(dayEvents),
        isLoading: eventsLoading,
      });
    }
    return map;
  }, [allDates, allEvents, eventsLoading]);

  // 6. 캐시 무효화
  const invalidateAll = useCallback(() => {
    if (isMultiCalendar && visibleCalendarIds) {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.multiWeekly(visibleCalendarIds, range.start, range.end),
      });
    } else if (calendarId) {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.weekly(calendarId, range.start, range.end),
      });
    }
  }, [queryClient, calendarId, range.start, range.end, isMultiCalendar, visibleCalendarIds]);

  const invalidateDate = useCallback(
    (_date: string) => invalidateAll(),
    [invalidateAll],
  );

  return {
    week1Dates,
    week2Dates,
    allDates,
    dayDataMap,
    calendarId,
    isAnyLoading: eventsLoading,
    invalidateDate,
    invalidateAll,
  };
}
