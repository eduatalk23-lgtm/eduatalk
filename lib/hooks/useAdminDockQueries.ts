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
 * @param initialData SSR 프리페치 데이터
 */
export function useDailyDockQuery(
  studentId: string,
  date: string,
  plannerId?: string,
  initialData?: { plans?: DailyPlan[]; adHocPlans?: AdHocPlan[] }
) {
  const queryClient = useQueryClient();

  const plansQuery = useQuery({
    ...dailyPlansQueryOptions(studentId, date, plannerId),
    initialData: initialData?.plans,
  });
  const adHocQuery = useQuery({
    ...dailyAdHocPlansQueryOptions(studentId, date),
    initialData: initialData?.adHocPlans,
  });

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
 * @param plannerId 플래너 ID (오버라이드 적용용)
 * @param initialData SSR 프리페치 데이터
 */
export function useNonStudyTimeQuery(
  studentId: string,
  date: string,
  plans: DailyPlan[],
  plansLoaded: boolean = true,
  plannerId?: string,
  initialData?: NonStudyItem[]
) {
  const planGroupIds = useMemo(() => {
    const ids = plans
      .map(p => p.plan_group_id)
      .filter((id): id is string => id != null);
    return [...new Set(ids)];
  }, [plans]);

  const queryOpts = nonStudyTimeQueryOptions(studentId, date, planGroupIds, plannerId);

  // plannerId가 있으면 새 테이블 사용 - initialData에 UUID가 있는지 확인
  // UUID가 없으면 레거시 데이터이므로 refetch 필요
  const hasValidInitialData = useMemo(() => {
    if (!initialData || initialData.length === 0) return false;
    // plannerId가 있고 새 테이블을 사용하면 첫 번째 아이템에 id(UUID)가 있어야 함
    if (plannerId && !initialData[0].id) {
      console.log('[useNonStudyTimeQuery] initialData missing UUID, will refetch');
      return false;
    }
    return true;
  }, [initialData, plannerId]);

  const query = useQuery({
    ...queryOpts,
    // UUID가 있는 유효한 initialData만 사용
    initialData: hasValidInitialData ? initialData : undefined,
    // initialData가 유효하거나 plans가 로드되면 활성화
    enabled: hasValidInitialData || plansLoaded,
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
 * @param initialData SSR 프리페치 데이터
 */
export function useWeeklyDockQuery(
  studentId: string,
  selectedDate: string,
  plannerId?: string,
  initialData?: { plans?: WeeklyPlan[]; adHocPlans?: AdHocPlan[] }
) {
  const queryClient = useQueryClient();
  const weekRange = getWeekRange(selectedDate);

  const plansQuery = useQuery({
    ...weeklyPlansQueryOptions(studentId, weekRange.start, weekRange.end, plannerId),
    initialData: initialData?.plans,
  });
  const adHocQuery = useQuery({
    ...weeklyAdHocPlansQueryOptions(studentId, weekRange.start, weekRange.end),
    initialData: initialData?.adHocPlans,
  });

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
 * @param initialData SSR 프리페치 데이터
 */
export function useUnfinishedDockQuery(
  studentId: string,
  plannerId?: string,
  initialData?: UnfinishedPlan[]
) {
  const queryClient = useQueryClient();

  const plansQuery = useQuery({
    ...unfinishedPlansQueryOptions(studentId, plannerId),
    initialData,
  });

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
