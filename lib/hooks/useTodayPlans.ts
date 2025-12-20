"use client";

import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import { queryOptions } from "@tanstack/react-query";
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from "@/lib/constants/queryCache";
import type { TodayPlansResponse } from "@/lib/data/todayPlans";

type UseTodayPlansOptions = {
  studentId: string;
  tenantId: string | null;
  date: string;
  camp?: boolean;
  includeProgress?: boolean;
  enabled?: boolean;
};

/**
 * Today Plans 조회 쿼리 옵션 (타입 안전)
 * 
 * queryOptions를 사용하여 타입 안전성을 향상시킵니다.
 * queryClient.getQueryData()에서도 타입 추론이 자동으로 됩니다.
 * 서버 컴포넌트에서 prefetchQuery로도 사용 가능합니다.
 * 
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID (null 가능)
 * @param date - 조회할 날짜 (YYYY-MM-DD 형식)
 * @param options - 추가 옵션 (camp, includeProgress)
 * @returns React Query 쿼리 옵션
 */
export function todayPlansQueryOptions(
  studentId: string,
  tenantId: string | null,
  date: string,
  options?: {
    camp?: boolean;
    includeProgress?: boolean;
  }
) {
  return queryOptions({
    queryKey: [
      "todayPlans",
      studentId,
      tenantId,
      date,
      {
        camp: options?.camp ?? false,
        includeProgress: options?.includeProgress ?? true,
      },
    ] as const,
    queryFn: async (): Promise<TodayPlansResponse> => {
      const queryParams = new URLSearchParams();
      queryParams.set("date", date);
      if (options?.camp) {
        queryParams.set("camp", "true");
      }
      if (options?.includeProgress !== undefined) {
        queryParams.set("includeProgress", options.includeProgress ? "true" : "false");
      }

      const response = await fetch(`/api/today/plans?${queryParams.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "오늘의 플랜 조회 실패";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch {
          // JSON 파싱 실패 시 원본 텍스트 사용
          if (errorText) {
            errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
          }
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      
      // API 응답이 { success: true, data: TodayPlansResponse } 형식인지 확인
      if (responseData.success && responseData.data) {
        return responseData.data as TodayPlansResponse;
      }
      
      // 직접 TodayPlansResponse 형식인 경우
      return responseData as TodayPlansResponse;
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC, // 1분 (Dynamic Data)
    gcTime: CACHE_GC_TIME_DYNAMIC, // 10분 (캐시 유지 시간)
  });
}

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
}: UseTodayPlansOptions) {
  return useTypedQuery({
    ...todayPlansQueryOptions(studentId, tenantId, date, {
      camp,
      includeProgress,
    }),
    enabled: enabled && !!studentId && !!date,
  });
}

