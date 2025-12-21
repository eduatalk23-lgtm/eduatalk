"use client";

import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import { blockSetsQueryOptions } from "@/lib/query-options/blockSets";

type UseBlockSetsOptions = {
  studentId: string;
  enabled?: boolean;
};

/**
 * 블록 세트 목록 조회 훅
 * 
 * @example
 * ```typescript
 * const { data: blockSets, isLoading } = useBlockSets({
 *   studentId: "student-123",
 * });
 * ```
 * 
 * @param options - 조회 옵션
 * @returns React Query 쿼리 결과
 */
export function useBlockSets({
  studentId,
  enabled = true,
}: UseBlockSetsOptions) {
  return useTypedQuery({
    ...blockSetsQueryOptions(studentId),
    enabled: enabled && !!studentId,
  });
}

