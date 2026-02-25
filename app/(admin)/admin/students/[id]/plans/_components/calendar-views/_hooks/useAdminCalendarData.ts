"use client";

/**
 * 관리자 캘린더 데이터 훅
 *
 * Calendar-First: calendar_events 테이블에서 월간 이벤트를 조회하고
 * 날짜별로 그룹핑합니다.
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
import { calendarEventToMonthlyPlan } from "@/lib/domains/calendar/adapters";
import { expandRecurringEvents } from "@/lib/domains/calendar/rrule";
import type { PlansByDate, CalendarPlan } from "../_types/adminCalendar";

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
  /** 날짜별 플랜 맵 */
  plansByDate: PlansByDate;
  /** 전체 플랜 목록 */
  plans: CalendarPlan[];
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
  // visibleCalendarIds가 배열이면 멀티 캘린더 모드 (빈 배열 = 모든 캘린더 숨김)
  const isMultiCalendar = Array.isArray(visibleCalendarIds);

  // 캘린더 범위 계산
  // yearMode: 1/1 ~ 12/31 | 기본: 6주 범위 (이전 월 마지막 주 ~ 다음 월 첫 주)
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

  // CalendarEvent → CalendarPlan 변환
  const plans = useMemo<CalendarPlan[]>(() => {
    return expandedEvents.map(calendarEventToMonthlyPlan);
  }, [expandedEvents]);

  // 날짜별 플랜 그룹핑
  const plansByDate = useMemo<PlansByDate>(() => {
    const grouped: PlansByDate = {};

    for (const plan of plans) {
      if (!plan.plan_date) continue;

      if (!grouped[plan.plan_date]) {
        grouped[plan.plan_date] = [];
      }
      grouped[plan.plan_date].push(plan);
    }

    return grouped;
  }, [plans]);

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
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch,
    invalidate,
  };
}
