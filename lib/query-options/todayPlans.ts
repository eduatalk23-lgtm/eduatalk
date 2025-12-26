import { queryOptions } from "@tanstack/react-query";
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from "@/lib/constants/queryCache";
import type { TodayPlansResponse } from "@/lib/data/todayPlans";

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
 * @param options - 추가 옵션 (includeProgress)
 * @returns React Query 쿼리 옵션
 */
export function todayPlansQueryOptions(
  studentId: string,
  tenantId: string | null,
  date: string,
  options?: {
    /** @deprecated 캠프/일반 통합으로 더 이상 사용되지 않음. 무시됨. */
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
        includeProgress: options?.includeProgress ?? true,
      },
    ] as const,
    queryFn: async (): Promise<TodayPlansResponse> => {
      const queryParams = new URLSearchParams();
      queryParams.set("date", date);
      // camp 파라미터는 더 이상 사용되지 않음 (캠프/일반 통합)
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

