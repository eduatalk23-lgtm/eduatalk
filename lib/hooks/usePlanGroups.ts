"use client";

import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import { queryOptions } from "@tanstack/react-query";
import {
  getPlanGroupsWithStats,
  type PlanGroupFilters,
} from "@/lib/data/planGroups";

// PlanGroupFilters를 re-export하여 다른 컴포넌트에서 사용 가능하도록 함
export type { PlanGroupFilters };
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from "@/lib/constants/queryCache";
import type { PlanGroup } from "@/lib/types/plan";

/**
 * 플랜 그룹 통계 정보
 */
export type PlanGroupStats = {
  planCount: number;
  completedCount: number;
  totalCount: number;
  isCompleted: boolean;
};

/**
 * 플랜 그룹 목록 조회 결과 타입 (통계 포함)
 */
export type PlanGroupWithStats = PlanGroup & PlanGroupStats;

type UsePlanGroupsOptions = {
  filters: PlanGroupFilters;
  enabled?: boolean;
};

/**
 * 플랜 그룹 목록 조회 쿼리 옵션 (타입 안전)
 * 
 * queryOptions를 사용하여 타입 안전성을 향상시킵니다.
 * queryClient.getQueryData()에서도 타입 추론이 자동으로 됩니다.
 * 서버 컴포넌트에서 prefetchQuery로도 사용 가능합니다.
 * 
 * @param filters - 플랜 그룹 필터 옵션
 * @returns React Query 쿼리 옵션
 */
export function planGroupsQueryOptions(filters: PlanGroupFilters) {
  return queryOptions({
    queryKey: [
      "planGroups",
      filters.studentId,
      filters.tenantId ?? null,
      filters.status ?? null,
      filters.planPurpose ?? null,
      filters.dateRange ?? null,
      filters.includeDeleted ?? false,
    ] as const,
    queryFn: async (): Promise<PlanGroupWithStats[]> => {
      const groups = await getPlanGroupsWithStats(filters);
      return groups;
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC, // 1분 (Dynamic Data)
    gcTime: CACHE_GC_TIME_DYNAMIC, // 10분 (캐시 유지 시간)
  });
}

/**
 * 플랜 그룹 목록 조회 훅
 * 
 * @example
 * ```typescript
 * const { data: planGroups, isLoading } = usePlanGroups({
 *   filters: {
 *     studentId: "student-123",
 *     tenantId: "tenant-456",
 *     includeDeleted: false,
 *   },
 * });
 * ```
 * 
 * @param options - 조회 옵션
 * @returns React Query 쿼리 결과
 */
export function usePlanGroups({
  filters,
  enabled = true,
}: UsePlanGroupsOptions) {
  return useTypedQuery({
    ...planGroupsQueryOptions(filters),
    enabled: enabled && !!filters.studentId,
  });
}

