'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  adminDockKeys,
  dailyPlansQueryOptions,
  dailyAdHocPlansQueryOptions,
  nonStudyTimeQueryOptions,
  weeklyPlansQueryOptions,
  weeklyAdHocPlansQueryOptions,
  unfinishedPlansQueryOptions,
  getWeekRange,
  type DailyPlan,
  type WeeklyPlan,
  type UnfinishedPlan,
  type AdHocPlan,
  type NonStudyItem,
} from '@/lib/query-options/adminDock';

/**
 * Daily Dock 쿼리 훅
 * @param studentId 학생 ID
 * @param date 날짜
 * @param plannerId 플래너 ID (선택, 플래너 기반 필터링용)
 */
export function useDailyDockQuery(studentId: string, date: string, plannerId?: string) {
  const queryClient = useQueryClient();

  const plansQuery = useQuery(dailyPlansQueryOptions(studentId, date, plannerId));
  const adHocQuery = useQuery(dailyAdHocPlansQueryOptions(studentId, date));

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminDockKeys.daily(studentId, date, plannerId) });
    queryClient.invalidateQueries({ queryKey: adminDockKeys.dailyAdHoc(studentId, date) });
  }, [queryClient, studentId, date, plannerId]);

  return {
    plans: plansQuery.data ?? [],
    adHocPlans: adHocQuery.data ?? [],
    isLoading: plansQuery.isLoading || adHocQuery.isLoading,
    isError: plansQuery.isError || adHocQuery.isError,
    error: plansQuery.error || adHocQuery.error,
    invalidate,
    refetch: () => {
      plansQuery.refetch();
      adHocQuery.refetch();
    },
  };
}

/**
 * 비학습시간 쿼리 훅
 * @param studentId 학생 ID
 * @param date 날짜
 * @param plans 플랜 목록 (plan_group_id 추출용)
 * @param plansLoaded 플랜 로딩 완료 여부 (false면 쿼리 비활성화하여 플리커 방지)
 */
export function useNonStudyTimeQuery(
  studentId: string,
  date: string,
  plans: DailyPlan[],
  plansLoaded: boolean = true
) {
  const planGroupIds = useMemo(() => {
    const ids = plans
      .map(p => p.plan_group_id)
      .filter((id): id is string => id != null);
    return [...new Set(ids)];
  }, [plans]);

  const queryOpts = nonStudyTimeQueryOptions(studentId, date, planGroupIds);
  const query = useQuery({
    ...queryOpts,
    enabled: plansLoaded,
  });

  return {
    nonStudyItems: query.data ?? [],
    isLoading: query.isLoading,
  };
}

/**
 * Weekly Dock 쿼리 훅
 * @param studentId 학생 ID
 * @param selectedDate 선택된 날짜
 * @param plannerId 플래너 ID (선택, 플래너 기반 필터링용)
 */
export function useWeeklyDockQuery(studentId: string, selectedDate: string, plannerId?: string) {
  const queryClient = useQueryClient();
  const weekRange = getWeekRange(selectedDate);

  const plansQuery = useQuery(
    weeklyPlansQueryOptions(studentId, weekRange.start, weekRange.end, plannerId)
  );
  const adHocQuery = useQuery(
    weeklyAdHocPlansQueryOptions(studentId, weekRange.start, weekRange.end)
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: adminDockKeys.weekly(studentId, weekRange.start, weekRange.end, plannerId),
    });
    queryClient.invalidateQueries({
      queryKey: adminDockKeys.weeklyAdHoc(studentId, weekRange.start, weekRange.end),
    });
  }, [queryClient, studentId, weekRange.start, weekRange.end, plannerId]);

  return {
    plans: plansQuery.data ?? [],
    adHocPlans: adHocQuery.data ?? [],
    isLoading: plansQuery.isLoading || adHocQuery.isLoading,
    isError: plansQuery.isError || adHocQuery.isError,
    error: plansQuery.error || adHocQuery.error,
    weekRange,
    invalidate,
    refetch: () => {
      plansQuery.refetch();
      adHocQuery.refetch();
    },
  };
}

/**
 * Unfinished Dock 쿼리 훅
 * @param studentId 학생 ID
 * @param plannerId 플래너 ID (선택, 플래너 기반 필터링용)
 */
export function useUnfinishedDockQuery(studentId: string, plannerId?: string) {
  const queryClient = useQueryClient();

  const plansQuery = useQuery(unfinishedPlansQueryOptions(studentId, plannerId));

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminDockKeys.unfinished(studentId, plannerId) });
  }, [queryClient, studentId, plannerId]);

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
 * const { invalidateDaily, invalidateWeekly, invalidateDailyAndWeekly } = useTargetedDockInvalidation();
 *
 * // 플랜 수정 후 Daily만 무효화
 * invalidateDaily(studentId, date, plannerId);
 *
 * // 플랜 이동 후 Daily + Weekly 무효화
 * invalidateDailyAndWeekly(studentId, date, plannerId);
 * ```
 */
export function useTargetedDockInvalidation() {
  const queryClient = useQueryClient();

  /**
   * Daily Dock만 무효화
   */
  const invalidateDaily = useCallback(
    (studentId: string, date: string, plannerId?: string) => {
      queryClient.invalidateQueries({
        queryKey: adminDockKeys.daily(studentId, date, plannerId),
      });
      queryClient.invalidateQueries({
        queryKey: adminDockKeys.dailyAdHoc(studentId, date),
      });
    },
    [queryClient]
  );

  /**
   * Weekly Dock만 무효화
   */
  const invalidateWeekly = useCallback(
    (studentId: string, selectedDate: string, plannerId?: string) => {
      const weekRange = getWeekRange(selectedDate);
      queryClient.invalidateQueries({
        queryKey: adminDockKeys.weekly(studentId, weekRange.start, weekRange.end, plannerId),
      });
      queryClient.invalidateQueries({
        queryKey: adminDockKeys.weeklyAdHoc(studentId, weekRange.start, weekRange.end),
      });
    },
    [queryClient]
  );

  /**
   * Unfinished Dock만 무효화
   */
  const invalidateUnfinished = useCallback(
    (studentId: string, plannerId?: string) => {
      queryClient.invalidateQueries({
        queryKey: adminDockKeys.unfinished(studentId, plannerId),
      });
    },
    [queryClient]
  );

  /**
   * Daily + Weekly 무효화 (플랜 이동 시 주로 사용)
   */
  const invalidateDailyAndWeekly = useCallback(
    (studentId: string, date: string, plannerId?: string) => {
      invalidateDaily(studentId, date, plannerId);
      invalidateWeekly(studentId, date, plannerId);
    },
    [invalidateDaily, invalidateWeekly]
  );

  /**
   * Daily + Unfinished 무효화 (플랜 완료/취소 시 주로 사용)
   */
  const invalidateDailyAndUnfinished = useCallback(
    (studentId: string, date: string, plannerId?: string) => {
      invalidateDaily(studentId, date, plannerId);
      invalidateUnfinished(studentId, plannerId);
    },
    [invalidateDaily, invalidateUnfinished]
  );

  /**
   * 모든 Dock 무효화 (전체 새로고침)
   */
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminDockKeys.all });
  }, [queryClient]);

  return {
    invalidateDaily,
    invalidateWeekly,
    invalidateUnfinished,
    invalidateDailyAndWeekly,
    invalidateDailyAndUnfinished,
    invalidateAll,
  };
}

// Re-export types
export type { DailyPlan, WeeklyPlan, UnfinishedPlan, AdHocPlan, NonStudyItem };
