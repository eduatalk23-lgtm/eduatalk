"use client";

import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import { queryOptions } from "@tanstack/react-query";
import { fetchBlockSetsWithBlocks } from "@/lib/data/blockSets";
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from "@/lib/constants/queryCache";
import type { BlockSetWithBlocks } from "@/lib/data/blockSets";

type UseBlockSetsOptions = {
  studentId: string;
  enabled?: boolean;
};

/**
 * 블록 세트 목록 조회 쿼리 옵션 (타입 안전)
 * 
 * queryOptions를 사용하여 타입 안전성을 향상시킵니다.
 * queryClient.getQueryData()에서도 타입 추론이 자동으로 됩니다.
 * 서버 컴포넌트에서 prefetchQuery로도 사용 가능합니다.
 * 
 * @param studentId - 학생 ID
 * @returns React Query 쿼리 옵션
 */
export function blockSetsQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: ["blockSets", studentId] as const,
    queryFn: async (): Promise<BlockSetWithBlocks[]> => {
      return await fetchBlockSetsWithBlocks(studentId);
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC, // 1분 (Dynamic Data)
    gcTime: CACHE_GC_TIME_DYNAMIC, // 10분 (캐시 유지 시간)
  });
}

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

