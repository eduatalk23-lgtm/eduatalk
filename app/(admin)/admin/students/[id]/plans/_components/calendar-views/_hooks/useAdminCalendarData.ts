"use client";

/**
 * 관리자 캘린더 데이터 훅
 *
 * 월간 플랜 데이터를 페칭하고 날짜별로 그룹핑합니다.
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
  monthlyPlansQueryOptions,
  adminCalendarKeys,
  type CalendarPlanData,
} from "@/lib/query-options/adminCalendar";
import type { PlansByDate, CalendarPlan } from "../_types/adminCalendar";

interface UseAdminCalendarDataOptions {
  studentId: string;
  currentMonth: Date;
  plannerId?: string;
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
 * 월간 플랜 데이터를 페칭하고 날짜별로 그룹핑합니다.
 * 캘린더 뷰에 맞게 6주 범위(이전 월 마지막 주 ~ 다음 월 첫 주)를 페칭합니다.
 */
export function useAdminCalendarData({
  studentId,
  currentMonth,
  plannerId,
}: UseAdminCalendarDataOptions): UseAdminCalendarDataReturn {
  const queryClient = useQueryClient();

  // 캘린더 범위 계산 (6주 범위: 이전 월 마지막 주 ~ 다음 월 첫 주)
  const dateRange = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return {
      start: format(calendarStart, "yyyy-MM-dd"),
      end: format(calendarEnd, "yyyy-MM-dd"),
    };
  }, [currentMonth]);

  // 쿼리
  const query = useQuery(
    monthlyPlansQueryOptions(studentId, dateRange.start, dateRange.end, plannerId)
  );

  // 플랜 데이터를 CalendarPlan 타입으로 변환
  const plans = useMemo<CalendarPlan[]>(() => {
    if (!query.data) return [];

    // plan_date가 없는 플랜은 캘린더에 표시할 수 없으므로 필터링
    return query.data
      .filter((plan): plan is CalendarPlanData & { plan_date: string } =>
        plan.plan_date !== null
      )
      .map((plan) => ({
        id: plan.id,
        plan_date: plan.plan_date,
        content_type: (plan.content_type || "custom") as CalendarPlan["content_type"],
        content_id: plan.content_id,
        content_title: plan.content_title,
        content_subject: plan.content_subject,
        content_subject_category: plan.content_subject_category,
        status: plan.status as CalendarPlan["status"],
        start_time: plan.start_time,
        end_time: plan.end_time,
        estimated_minutes: plan.estimated_minutes,
        planned_start_page_or_time: plan.planned_start_page_or_time,
        planned_end_page_or_time: plan.planned_end_page_or_time,
        progress: plan.progress,
        custom_title: plan.custom_title,
        custom_range_display: plan.custom_range_display,
        plan_group_id: plan.plan_group_id,
        container_type: plan.container_type as CalendarPlan["container_type"],
        sequence: plan.sequence,
      } satisfies CalendarPlan));
  }, [query.data]);

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

  // 캐시 무효화
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: adminCalendarKeys.monthly(
        studentId,
        dateRange.start,
        dateRange.end,
        plannerId
      ),
    });
  }, [queryClient, studentId, dateRange.start, dateRange.end, plannerId]);

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
