"use client";

import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import { planGroupsQueryOptions } from "@/lib/query-options/planGroups";
import type { PlanGroupFilters } from "@/lib/data/planGroups";
import type { PlanGroupWithStats, PlanGroupStats } from "@/lib/query-options/planGroups";

// 타입 re-export (하위 호환성)
export type { PlanGroupFilters, PlanGroupWithStats, PlanGroupStats };

type UsePlanGroupsOptions = {
  filters: PlanGroupFilters;
  enabled?: boolean;
};

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

