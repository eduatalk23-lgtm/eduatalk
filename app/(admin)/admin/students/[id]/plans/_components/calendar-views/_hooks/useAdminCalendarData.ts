"use client";

/**
 * 관리자 캘린더 데이터 훅
 *
 * Calendar-First: calendar_events 테이블에서 월간 이벤트를 조회하고
 * 날짜별로 그룹핑합니다.
 *
 * GCal 패리티: cross-day/all-day 이벤트는 AllDayItem으로 분리 → spanning bar 렌더링
 */

import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
} from "date-fns";

import {
  monthlyCalendarEventsQueryOptions,
  multiMonthlyCalendarEventsQueryOptions,
  calendarEventKeys,
} from "@/lib/query-options/calendarEvents";
import {
  calendarEventToMonthlyPlan,
  calendarEventToAllDayItem,
  calendarEventToMultiDayBar,
} from "@/lib/domains/calendar/adapters";
import { expandRecurringEvents } from "@/lib/domains/calendar/rrule";
import { classifyEventDuration } from "@/lib/domains/calendar/eventClassification";
import type { PlansByDate, CalendarPlan } from "../_types/adminCalendar";
import type { AllDayItem } from "@/lib/query-options/adminDock";

interface UseAdminCalendarDataOptions {
  /** @deprecated calendarId로 필터링되므로 사용되지 않음. 호출부 호환성을 위해 유지. */
  studentId?: string;
  currentMonth: Date;
  calendarId?: string;
  weekStartsOn?: number;
  /** 멀티 캘린더: 표시할 캘린더 ID 목록 (null = 단일 calendarId 사용) */
  visibleCalendarIds?: string[] | null;
  /** 연간 뷰 모드: currentMonth의 연도 기준 1/1 ~ 12/31 범위 조회 */
  yearMode?: boolean;
  /** 쿼리 활성화 여부 (기본 true) */
  enabled?: boolean;
}

interface UseAdminCalendarDataReturn {
  /** 날짜별 플랜 맵 (same-day timed 이벤트만) */
  plansByDate: PlansByDate;
  /** 전체 플랜 목록 */
  plans: CalendarPlan[];
  /** 날짜별 AllDayItem 맵 (all-day + cross-day → spanning bar용) */
  allDayItemsByDate: Record<string, AllDayItem[]>;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 상태 */
  isError: boolean;
  /** 에러 객체 */
  error: Error | null;
  /** 데이터 새로고침 */
  refetch: () => void;
  /** 캐시 무효화 */
  invalidate: () => void;
}

/**
 * 관리자 캘린더 데이터 훅
 *
 * Calendar-First: calendar_events에서 월간 이벤트를 조회하고 날짜별로 그룹핑합니다.
 * 캘린더 뷰에 맞게 6주 범위(이전 월 마지막 주 ~ 다음 월 첫 주)를 페칭합니다.
 *
 * GCal 패리티:
 * - same-day timed → plansByDate (cell 내부 chip/dot)
 * - all-day / cross-day → allDayItemsByDate (spanning bar)
 */
export function useAdminCalendarData({
  currentMonth,
  calendarId,
  weekStartsOn = 0,
  visibleCalendarIds,
  yearMode = false,
  enabled = true,
}: UseAdminCalendarDataOptions): UseAdminCalendarDataReturn {
  const queryClient = useQueryClient();
  const isMultiCalendar = Array.isArray(visibleCalendarIds);

  // 캘린더 범위 계산
  const dateRange = useMemo(() => {
    if (yearMode) {
      const year = currentMonth.getFullYear();
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    }
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const wso = weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: wso });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: wso });

    return {
      start: format(calendarStart, "yyyy-MM-dd"),
      end: format(calendarEnd, "yyyy-MM-dd"),
    };
  }, [currentMonth, weekStartsOn, yearMode]);

  // 단일 캘린더 모드
  const singleQuery = useQuery({
    ...monthlyCalendarEventsQueryOptions(
      calendarId ?? '',
      dateRange.start,
      dateRange.end
    ),
    enabled: enabled && !!calendarId && !isMultiCalendar,
  });

  // 멀티 캘린더 모드
  const multiQuery = useQuery({
    ...multiMonthlyCalendarEventsQueryOptions(
      visibleCalendarIds ?? [],
      dateRange.start,
      dateRange.end
    ),
    enabled: enabled && isMultiCalendar,
  });

  const rawEvents = useMemo(
    () => (isMultiCalendar ? multiQuery.data : singleQuery.data) ?? [],
    [isMultiCalendar, multiQuery.data, singleQuery.data],
  );

  // RRULE 반복 이벤트 확장
  const expandedEvents = useMemo(
    () => expandRecurringEvents(rawEvents, dateRange.start, dateRange.end),
    [rawEvents, dateRange.start, dateRange.end]
  );

  // GCal 패리티: 이벤트 분류 → plansByDate + allDayItemsByDate
  const { plans, plansByDate, allDayItemsByDate } = useMemo(() => {
    const plansByDate: PlansByDate = {};
    const sameDayPlans: CalendarPlan[] = [];
    const allDayItems: AllDayItem[] = [];

    for (const event of expandedEvents) {
      const mode = classifyEventDuration(
        event.start_at,
        event.end_at,
        event.is_all_day ?? false,
      );

      if (mode === 'cross-day' || event.is_all_day) {
        // cross-day timed 또는 all-day → AllDayItem (spanning bar)
        if (event.is_all_day) {
          allDayItems.push(calendarEventToAllDayItem(event));
        } else {
          const bar = calendarEventToMultiDayBar(event);
          if (bar) allDayItems.push(bar);
        }
        // all-day도 plansByDate에는 포함하지 않음 (bar로 표시)
      } else {
        // same-day timed → CalendarPlan (cell 내부 chip/dot)
        const plan = calendarEventToMonthlyPlan(event);
        sameDayPlans.push(plan);
        if (!plansByDate[plan.plan_date]) plansByDate[plan.plan_date] = [];
        plansByDate[plan.plan_date].push(plan);
      }
    }

    // allDayItemsByDate: 각 날짜에 해당하는 bar 목록
    const allDayItemsByDate: Record<string, AllDayItem[]> = {};
    for (const item of allDayItems) {
      const start = item.startDate;
      const end = item.endDate ?? start;
      if (!start || !end) continue;
      const d = new Date(start + 'T00:00:00Z');
      const endD = new Date(end + 'T00:00:00Z');
      if (isNaN(d.getTime()) || isNaN(endD.getTime())) continue;
      // 안전 가드: 최대 90일 (무한 루프 방지)
      const MAX_SPAN = 90;
      let count = 0;
      while (d <= endD && count < MAX_SPAN) {
        const key = d.toISOString().split('T')[0];
        if (!allDayItemsByDate[key]) allDayItemsByDate[key] = [];
        allDayItemsByDate[key].push(item);
        d.setDate(d.getDate() + 1);
        count++;
      }
    }

    return { plans: sameDayPlans, plansByDate, allDayItemsByDate };
  }, [expandedEvents]);

  const query = isMultiCalendar ? multiQuery : singleQuery;

  // 캐시 무효화
  const invalidate = useCallback(() => {
    if (isMultiCalendar && visibleCalendarIds) {
      queryClient.invalidateQueries({
        queryKey: [...calendarEventKeys.all, 'multiMonthly', visibleCalendarIds.join(','), dateRange.start, dateRange.end],
      });
    } else if (calendarId) {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.monthly(
          calendarId,
          dateRange.start,
          dateRange.end
        ),
      });
    }
  }, [queryClient, calendarId, dateRange.start, dateRange.end, isMultiCalendar, visibleCalendarIds]);

  // 리페치
  const refetch = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    plansByDate,
    plans,
    allDayItemsByDate,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch,
    invalidate,
  };
}
