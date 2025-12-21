"use client";

import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import { todayPlansQueryOptions } from "@/lib/query-options/todayPlans";
import type { TodayPlansResponse } from "@/lib/data/todayPlans";

type UseTodayPlansOptions = {
  studentId: string;
  tenantId: string | null;
  date: string;
  camp?: boolean;
  includeProgress?: boolean;
  enabled?: boolean;
  initialData?: TodayPlansResponse;
};

/**
 * Today Plans 조회 훅
 * 
 * @example
 * ```typescript
 * const { data: todayPlans, isLoading, error } = useTodayPlans({
 *   studentId: "student-123",
 *   tenantId: "tenant-456",
 *   date: "2025-01-01",
 *   camp: false,
 *   includeProgress: true,
 * });
 * ```
 * 
 * @param options - 조회 옵션
 * @returns React Query 쿼리 결과
 */
export function useTodayPlans({
  studentId,
  tenantId,
  date,
  camp = false,
  includeProgress = true,
  enabled = true,
  initialData,
}: UseTodayPlansOptions) {
  return useTypedQuery({
    ...todayPlansQueryOptions(studentId, tenantId, date, {
      camp,
      includeProgress,
    }),
    enabled: enabled && !!studentId && !!date,
    initialData,
  });
}

