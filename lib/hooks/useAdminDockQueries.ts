'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  adminDockKeys,
  dailyPlansQueryOptions,
  dailyAdHocPlansQueryOptions,
  weeklyPlansQueryOptions,
  weeklyAdHocPlansQueryOptions,
  unfinishedPlansQueryOptions,
  getWeekRange,
  type DailyPlan,
  type WeeklyPlan,
  type UnfinishedPlan,
  type AdHocPlan,
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
 */
export function useInvalidateAllDockQueries() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminDockKeys.all });
  }, [queryClient]);
}

// Re-export types
export type { DailyPlan, WeeklyPlan, UnfinishedPlan, AdHocPlan };
