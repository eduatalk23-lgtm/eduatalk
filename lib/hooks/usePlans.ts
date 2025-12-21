"use client";

import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import { plansQueryOptions } from "@/lib/query-options/plans";

type UsePlansOptions = {
  studentId: string;
  tenantId: string | null;
  planDate: string;
  enabled?: boolean;
};

/**
 * 플랜 조회 훅
 * 
 * @example
 * ```typescript
 * const { data: plans, isLoading } = usePlans({
 *   studentId: "student-123",
 *   tenantId: "tenant-456",
 *   planDate: "2025-01-01",
 * });
 * ```
 */
export function usePlans({
  studentId,
  tenantId,
  planDate,
  enabled = true,
}: UsePlansOptions) {
  return useTypedQuery({
    ...plansQueryOptions(studentId, tenantId, planDate),
    enabled,
  });
}

