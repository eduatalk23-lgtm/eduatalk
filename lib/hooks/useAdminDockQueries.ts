'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  adminDockKeys,
  dailyPlansQueryOptions,
  nonStudyTimeQueryOptions,
  overduePlansQueryOptions,
  type DailyPlan,
  type OverduePlan,
  type NonStudyItem,
} from '@/lib/query-options/adminDock';
import { calendarEventKeys } from '@/lib/query-options/calendarEvents';
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

/**
 * 비학습시간 쿼리 훅
 * @param studentId 학생 ID
 * @param date 날짜
 * @param plans 플랜 목록 (plan_group_id 추출용)
 * @param plansLoaded 플랜 로딩 완료 여부 (false면 쿼리 비활성화하여 플리커 방지)
 * @param calendarId 캘린더 ID (Calendar-First)
 * @param initialData SSR 프리페치 데이터
 */
export function useNonStudyTimeQuery(
  studentId: string,
  date: string,
  plans: DailyPlan[],
  plansLoaded: boolean = true,
  calendarId?: string,
  initialData?: NonStudyItem[]
) {
  const planGroupIds = useMemo(() => {
    const ids = plans
      .map(p => p.plan_group_id)
      .filter((id): id is string => id != null);
    return [...new Set(ids)];
  }, [plans]);

  const queryOpts = nonStudyTimeQueryOptions(studentId, date, planGroupIds, calendarId);

  const hasValidInitialData = useMemo(() => {
    if (!initialData || initialData.length === 0) return false;
    if (calendarId && !initialData[0].id) {
      return false;
    }
    return true;
  }, [initialData, calendarId]);

  const query = useQuery({
    ...queryOpts,
    initialData: hasValidInitialData ? initialData : undefined,
    enabled: hasValidInitialData || plansLoaded,
  });

  return {
    nonStudyItems: query.data ?? [],
    isLoading: query.isLoading,
  };
}

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
   */
  const invalidateDaily = useCallback(
    (studentId: string, date: string, calendarIdOrPlannerId?: string) => {
      queryClient.invalidateQueries({
        queryKey: adminDockKeys.daily(studentId, date, calendarIdOrPlannerId),
      });
    },
    [queryClient]
  );

  /**
   * Unfinished Dock만 무효화
   */
  const invalidateOverdue = useCallback(
    (studentId: string, calendarIdOrPlannerId?: string) => {
      queryClient.invalidateQueries({
        queryKey: adminDockKeys.overdue(studentId, calendarIdOrPlannerId),
      });
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
    invalidateOverdue,
    invalidateDailyAndOverdue,
    invalidateAll,
  };
}

// Re-export types
export type { DailyPlan, OverduePlan, NonStudyItem };
