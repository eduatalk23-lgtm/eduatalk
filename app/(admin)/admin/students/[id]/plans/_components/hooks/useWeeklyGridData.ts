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
  calendarEventToMultiDayBar,
  extractDateYMD,
} from '@/lib/domains/calendar/adapters';
import { classifyEventDuration } from '@/lib/domains/calendar/eventClassification';
import type {
  DailyPlan,
  AllDayItem,
} from '@/lib/query-options/adminDock';
import type { PlanItemData } from '@/lib/types/planItem';
import { getWeekDates, getWeekRangeSunSat, getCustomDayDates, getCustomDayRange } from '../utils/weekDateUtils';

export interface DayColumnData {
  date: string;
  plans: DailyPlan[];
  customItems: PlanItemData[];
  nonStudyItems: PlanItemData[];
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
 *
 * @param visibleCalendarIds 멀티 캘린더 모드: 표시할 캘린더 ID 목록 (null = 현재 플래너만)
 */
export function useWeeklyGridData(
  studentId: string,
  selectedDate: string,
  calendarIdProp?: string,
  visibleCalendarIds?: string[] | null,
  weekStartsOn = 0,
  dayCount = 7,
) {
  const queryClient = useQueryClient();
  // visibleCalendarIds가 배열이면 멀티 캘린더 모드 (빈 배열 = 모든 캘린더 숨김)
  const isMultiCalendar = Array.isArray(visibleCalendarIds);

  // 1. weekStartsOn 기반 N일 배열 (커스텀 일수 지원)
  const weekDates = useMemo(
    () => dayCount < 7
      ? getCustomDayDates(selectedDate, dayCount, weekStartsOn)
      : getWeekDates(selectedDate, weekStartsOn),
    [selectedDate, weekStartsOn, dayCount],
  );

  // 2. 범위 (weekStartsOn 기반)
  const weekRange = useMemo(
    () => dayCount < 7
      ? getCustomDayRange(selectedDate, dayCount, weekStartsOn)
      : getWeekRangeSunSat(selectedDate, weekStartsOn),
    [selectedDate, weekStartsOn, dayCount],
  );

  // 3. calendarId 직접 사용 (브릿지 쿼리 제거)
  const calendarId = useMemo(() => {
    if (isMultiCalendar && visibleCalendarIds!.length > 0) return visibleCalendarIds![0];
    if (isMultiCalendar) return calendarIdProp; // 빈 배열: 대표 ID 없음
    return calendarIdProp;
  }, [calendarIdProp, isMultiCalendar, visibleCalendarIds]);

  // 4a. 단일 캘린더 모드: 기존 쿼리
  const singleEventsQuery = useQuery({
    ...weeklyCalendarEventsQueryOptions(
      calendarId ?? '',
      weekRange.start,
      weekRange.end,
    ),
    enabled: !!calendarId && !isMultiCalendar,
  });

  // 4b. 멀티 캘린더 모드: IN 쿼리
  const multiEventsQuery = useQuery({
    ...multiWeeklyCalendarEventsQueryOptions(
      visibleCalendarIds ?? [],
      weekRange.start,
      weekRange.end,
    ),
    enabled: isMultiCalendar,
  });

  const rawEvents = useMemo(
    () => (isMultiCalendar ? multiEventsQuery.data : singleEventsQuery.data) ?? [],
    [isMultiCalendar, multiEventsQuery.data, singleEventsQuery.data],
  );

  // RRULE 반복 이벤트 확장
  const allEvents = useMemo(
    () => expandRecurringEvents(rawEvents, weekRange.start, weekRange.end),
    [rawEvents, weekRange.start, weekRange.end],
  );

  const eventsLoading = isMultiCalendar ? multiEventsQuery.isLoading : singleEventsQuery.isLoading;

  // 5. 날짜별 그룹핑 → 어댑터 적용 → DayColumnData Map
  const dayDataMap = useMemo(() => {
    // 날짜별 이벤트 그룹핑 (GCal 기준: same-day → time grid, cross-day → spanning bar)
    const eventsByDate = new Map<string, CalendarEventWithStudyData[]>();
    const crossDayEvents: CalendarEventWithStudyData[] = [];
    for (const date of weekDates) {
      eventsByDate.set(date, []);
    }
    for (const event of allEvents) {
      const displayMode = classifyEventDuration(event.start_at, event.end_at, event.is_all_day ?? false);

      if (displayMode === 'cross-day') {
        // 날이 넘어가는 timed 이벤트 → spanning bar (all-day 영역)
        crossDayEvents.push(event);
        continue;
      }

      // same-day (종일 포함): 해당 날짜 time grid
      const dateKey = event.start_date ?? extractDateYMD(event.start_at);
      if (dateKey && eventsByDate.has(dateKey)) {
        eventsByDate.get(dateKey)!.push(event);
      }
    }

    const isLoading = eventsLoading;

    // 어댑터 변환
    const map = new Map<string, DayColumnData>();
    for (const date of weekDates) {
      const dayEvents = eventsByDate.get(date) ?? [];
      const allDayItems = calendarEventsToAllDayItems(dayEvents);

      // cross-day timed spanning bars 추가
      for (const cdEvent of crossDayEvents) {
        const bar = calendarEventToMultiDayBar(cdEvent);
        if (bar && bar.startDate && bar.endDate && date >= bar.startDate && date <= bar.endDate) {
          allDayItems.push(bar);
        }
      }

      map.set(date, {
        date,
        plans: calendarEventsToDailyPlans(dayEvents),
        customItems: calendarEventsToCustomPlanItems(dayEvents),
        nonStudyItems: calendarEventsToNonStudyPlanItems(dayEvents),
        allDayItems,
        isLoading,
      });
    }
    return map;
  }, [weekDates, allEvents, eventsLoading, isMultiCalendar]);

  const isAnyLoading = eventsLoading;

  /** 특정 날짜의 캐시 무효화 (주간 단위로 통합 — date 파라미터는 API 호환용) */
  const invalidateDate = useCallback(
    (_date: string) => {
      if (isMultiCalendar && visibleCalendarIds) {
        queryClient.invalidateQueries({
          queryKey: calendarEventKeys.multiWeekly(visibleCalendarIds, weekRange.start, weekRange.end),
        });
      } else if (calendarId) {
        queryClient.invalidateQueries({
          queryKey: calendarEventKeys.weekly(calendarId, weekRange.start, weekRange.end),
        });
      }
    },
    [queryClient, calendarId, weekRange.start, weekRange.end, isMultiCalendar, visibleCalendarIds],
  );

  /** 전체 주간 캐시 무효화 */
  const invalidateAll = useCallback(() => {
    if (isMultiCalendar && visibleCalendarIds) {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.multiWeekly(visibleCalendarIds, weekRange.start, weekRange.end),
      });
    } else if (calendarId) {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.weekly(calendarId, weekRange.start, weekRange.end),
      });
    }
  }, [queryClient, calendarId, weekRange.start, weekRange.end, isMultiCalendar, visibleCalendarIds]);

  return {
    weekDates,
    dayDataMap,
    calendarId,
    isAnyLoading,
    invalidateDate,
    invalidateAll,
  };
}
