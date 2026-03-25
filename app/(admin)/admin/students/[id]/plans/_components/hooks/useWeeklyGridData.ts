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
  extractTimeHHMM,
} from '@/lib/domains/calendar/adapters';
import { classifyEventDuration } from '@/lib/domains/calendar/eventClassification';
import { resolveLogicalMinutes, shiftDate } from '../utils/logicalDayUtils';
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

  // 3b. 논리적 하루용 fetch 범위 버퍼 (±1일)
  // 첫날 새벽(01:00 이전) 이벤트 + 마지막날 연장(00:00~01:00) 이벤트 포함
  const fetchRange = useMemo(() => ({
    start: shiftDate(weekRange.start, -1),
    end: shiftDate(weekRange.end, 1),
  }), [weekRange.start, weekRange.end]);

  // 4a. 단일 캘린더 모드: fetch는 버퍼 범위, 캐시 키는 weekRange (안정적 캐시)
  const singleEventsQuery = useQuery({
    ...weeklyCalendarEventsQueryOptions(
      calendarId ?? '',
      fetchRange.start,
      fetchRange.end,
    ),
    // 캐시 키를 weekRange 기준으로 오버라이드 → 주간 네비게이션 시 안정적 캐시 히트
    queryKey: calendarEventKeys.weekly(calendarId ?? '', weekRange.start, weekRange.end),
    enabled: !!calendarId && !isMultiCalendar,
  });

  // 4b. 멀티 캘린더 모드: IN 쿼리 (동일 전략)
  const multiEventsQuery = useQuery({
    ...multiWeeklyCalendarEventsQueryOptions(
      visibleCalendarIds ?? [],
      fetchRange.start,
      fetchRange.end,
    ),
    queryKey: calendarEventKeys.multiWeekly(visibleCalendarIds ?? [], weekRange.start, weekRange.end),
    enabled: isMultiCalendar,
  });

  const rawEvents = useMemo(
    () => (isMultiCalendar ? multiEventsQuery.data : singleEventsQuery.data) ?? [],
    [isMultiCalendar, multiEventsQuery.data, singleEventsQuery.data],
  );

  // RRULE 반복 이벤트 확장 (버퍼 포함 범위)
  const allEvents = useMemo(
    () => expandRecurringEvents(rawEvents, fetchRange.start, fetchRange.end),
    [rawEvents, fetchRange.start, fetchRange.end],
  );

  const eventsLoading = isMultiCalendar ? multiEventsQuery.isLoading : singleEventsQuery.isLoading;

  // 5. 날짜별 그룹핑 → 어댑터 적용 → DayColumnData Map
  const dayDataMap = useMemo(() => {
    // 논리적 하루 기반 이벤트 그룹핑:
    // - same-day → time grid (00:00~00:59 이벤트는 전날 컬럼의 연장 영역에 배정)
    // - cross-day → spanning bar (all-day 영역)
    const eventsByDate = new Map<string, CalendarEventWithStudyData[]>();
    const crossDayEvents: CalendarEventWithStudyData[] = [];
    for (const date of weekDates) {
      eventsByDate.set(date, []);
    }
    for (const event of allEvents) {
      const displayMode = classifyEventDuration(event.start_at, event.end_at, event.is_all_day ?? false);

      if (displayMode === 'cross-day') {
        // 논리적 하루를 넘는 timed 이벤트 → spanning bar (all-day 영역)
        crossDayEvents.push(event);
        continue;
      }

      // same-day (종일 포함): 논리적 날짜 기반으로 컬럼 배정
      const physicalDate = event.start_date ?? extractDateYMD(event.start_at);
      const startTime = extractTimeHHMM(event.start_at);

      if (physicalDate && startTime) {
        // 00:00~00:59 이벤트 → 전날 컬럼 연장 영역에 배정 (중복 표시 방지)
        const { logicalDate } = resolveLogicalMinutes(physicalDate, startTime);
        if (eventsByDate.has(logicalDate)) {
          eventsByDate.get(logicalDate)!.push(event);
        }
      } else if (physicalDate && eventsByDate.has(physicalDate)) {
        // startTime 없는 경우 (종일 등) → 물리적 날짜 그대로
        eventsByDate.get(physicalDate)!.push(event);
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
