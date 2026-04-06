'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  adminDockKeys,
  dailyPlansQueryOptions,
  overduePlansQueryOptions,
  type DailyPlan,
  type OverduePlan,
  type NonStudyItem,
} from '@/lib/query-options/adminDock';
import { calendarEventKeys, getWeekRange } from '@/lib/query-options/calendarEvents';
import { calendarViewKeys } from '@/lib/query-options/calendarViewQueryOptions';

/**
 * Daily Dock 쿼리 훅
 * @param studentId 학생 ID
 * @param date 날짜
 * @param calendarIdOrPlannerId 캘린더 ID 또는 플래너 ID
 * @param initialData SSR 프리페치 데이터
 * @param options.useCalendarId true면 calendarId 기반 필터링
 */
export function useDailyDockQuery(
  studentId: string,
  date: string,
  calendarIdOrPlannerId?: string,
  initialData?: { plans?: DailyPlan[] },
  options?: { useCalendarId?: boolean }
) {
  const queryClient = useQueryClient();

  const plansQuery = useQuery({
    ...dailyPlansQueryOptions(studentId, date, calendarIdOrPlannerId, options),
    initialData: initialData?.plans,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminDockKeys.daily(studentId, date, calendarIdOrPlannerId) });
  }, [queryClient, studentId, date, calendarIdOrPlannerId]);

  return {
    plans: plansQuery.data ?? [],
    isLoading: plansQuery.isLoading,
    isError: plansQuery.isError,
    error: plansQuery.error,
    invalidate,
    refetch: () => plansQuery.refetch(),
  };
}

// useNonStudyTimeQuery 삭제됨 (Calendar-First 쿼리로 대체)

/**
 * Overdue Plans 쿼리 훅
 * @param studentId 학생 ID
 * @param calendarIdOrPlannerId 캘린더 ID 또는 플래너 ID
 * @param initialData SSR 프리페치 데이터
 * @param options.useCalendarId true면 calendarId 기반 필터링
 */
export function useOverdueDockQuery(
  studentId: string,
  calendarIdOrPlannerId?: string,
  initialData?: OverduePlan[],
  options?: { useCalendarId?: boolean }
) {
  const queryClient = useQueryClient();

  const plansQuery = useQuery({
    ...overduePlansQueryOptions(studentId, calendarIdOrPlannerId, options),
    initialData,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminDockKeys.overdue(studentId, calendarIdOrPlannerId) });
  }, [queryClient, studentId, calendarIdOrPlannerId]);

  return {
    plans: plansQuery.data ?? [],
    isLoading: plansQuery.isLoading,
    isError: plansQuery.isError,
    error: plansQuery.error,
    invalidate,
    refetch: plansQuery.refetch,
  };
}

/**
 * 모든 Admin Dock 쿼리 무효화
 * AdminPlanManagement에서 전체 새로고침 시 사용
 *
 * @deprecated 가능하면 useTargetedDockInvalidation을 사용하세요
 */
export function useInvalidateAllDockQueries() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminDockKeys.all });
  }, [queryClient]);
}

/**
 * 타겟 Dock 쿼리 무효화 훅
 *
 * 전체 무효화 대신 필요한 Dock만 무효화하여 네트워크 요청을 줄입니다.
 *
 * @example
 * ```tsx
 * const { invalidateDaily, invalidateOverdue } = useTargetedDockInvalidation();
 *
 * // 플랜 수정 후 Daily만 무효화
 * invalidateDaily(studentId, date, calendarId);
 * ```
 */
export function useTargetedDockInvalidation() {
  const queryClient = useQueryClient();

  /**
   * Daily Dock만 무효화
   *
   * adminDock + calendarEvents 양쪽 모두 무효화.
   * DailyDock은 calendarEvents를 사용하므로 반드시 포함해야 함.
   */
  const invalidateDaily = useCallback(
    (studentId: string, date: string, calendarIdOrPlannerId?: string) => {
      queryClient.invalidateQueries({
        queryKey: adminDockKeys.daily(studentId, date, calendarIdOrPlannerId),
      });
      // Calendar-First: DailyDock은 calendarEventKeys를 사용
      if (calendarIdOrPlannerId) {
        queryClient.invalidateQueries({
          queryKey: calendarEventKeys.daily(calendarIdOrPlannerId, date),
        });
        // multiDaily도 무효화 (멀티 캘린더 모드)
        queryClient.invalidateQueries({
          queryKey: [...calendarEventKeys.all, 'multiDaily'],
          exact: false,
        });
      }
    },
    [queryClient]
  );

  /**
   * Daily + Weekly 무효화 (플랜 이동/날짜 변경 시)
   */
  const invalidateDailyAndWeekly = useCallback(
    (studentId: string, date: string, calendarIdOrPlannerId?: string) => {
      invalidateDaily(studentId, date, calendarIdOrPlannerId);
      // Weekly 캐시도 무효화
      if (calendarIdOrPlannerId) {
        const weekRange = getWeekRange(date);
        queryClient.invalidateQueries({
          queryKey: calendarEventKeys.weekly(calendarIdOrPlannerId, weekRange.start, weekRange.end),
        });
        queryClient.invalidateQueries({
          queryKey: [...calendarEventKeys.all, 'multiWeekly'],
          exact: false,
        });
      }
    },
    [queryClient, invalidateDaily]
  );

  /**
   * Unfinished Dock만 무효화
   */
  const invalidateOverdue = useCallback(
    (studentId: string, calendarIdOrPlannerId?: string) => {
      queryClient.invalidateQueries({
        queryKey: adminDockKeys.overdue(studentId, calendarIdOrPlannerId),
      });
      // Calendar-First: overdue 이벤트도 무효화
      if (calendarIdOrPlannerId) {
        queryClient.invalidateQueries({
          queryKey: calendarEventKeys.overdue(calendarIdOrPlannerId),
        });
      }
    },
    [queryClient]
  );

  /**
   * Daily + Unfinished 무효화 (플랜 완료/취소 시 주로 사용)
   */
  const invalidateDailyAndOverdue = useCallback(
    (studentId: string, date: string, calendarIdOrPlannerId?: string) => {
      invalidateDaily(studentId, date, calendarIdOrPlannerId);
      invalidateOverdue(studentId, calendarIdOrPlannerId);
    },
    [invalidateDaily, invalidateOverdue]
  );

  /**
   * 모든 Dock 무효화 (전체 새로고침)
   */
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminDockKeys.all });
    queryClient.invalidateQueries({ queryKey: calendarEventKeys.all });
    queryClient.invalidateQueries({ queryKey: calendarViewKeys.all });
  }, [queryClient]);

  return {
    invalidateDaily,
    invalidateDailyAndWeekly,
    invalidateOverdue,
    invalidateDailyAndOverdue,
    invalidateAll,
  };
}

// Re-export types
export type { DailyPlan, OverduePlan, NonStudyItem };
