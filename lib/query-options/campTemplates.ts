import { queryOptions } from "@tanstack/react-query";
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from "@/lib/constants/queryCache";
import type { CampTemplate } from "@/lib/types/plan";
import type { ListResult } from "@/lib/data/core/types";

export type CampTemplatesFilters = {
  search?: string;
  status?: string;
  programType?: string;
};

/**
 * 캠프 템플릿 목록 조회 쿼리 옵션 (타입 안전)
 * 
 * queryOptions를 사용하여 타입 안전성을 향상시킵니다.
 * queryClient.getQueryData()에서도 타입 추론이 자동으로 됩니다.
 * 서버 컴포넌트에서 prefetchQuery로도 사용 가능합니다.
 * 
 * @param tenantId - 테넌트 ID
 * @param options - 페이지네이션 및 필터 옵션
 * @returns React Query 쿼리 옵션
 */
export function campTemplatesQueryOptions(
  tenantId: string,
  options?: {
    page?: number;
    pageSize?: number;
    filters?: CampTemplatesFilters;
  }
) {
  return queryOptions({
    queryKey: [
      "campTemplates",
      tenantId,
      options?.page ?? 1,
      options?.pageSize ?? 20,
      options?.filters ?? {},
    ] as const,
    queryFn: async (): Promise<ListResult<CampTemplate>> => {
      const queryParams = new URLSearchParams();
      queryParams.set("page", String(options?.page ?? 1));
      queryParams.set("pageSize", String(options?.pageSize ?? 20));
      
      if (options?.filters?.search) {
        queryParams.set("search", options.filters.search);
      }
      if (options?.filters?.status) {
        queryParams.set("status", options.filters.status);
      }
      if (options?.filters?.programType) {
        queryParams.set("programType", options.filters.programType);
      }

      const response = await fetch(`/api/camp-templates?${queryParams.toString()}`);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "캠프 템플릿 조회 실패";
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
      
      // API 응답이 { success: true, data: ListResult<CampTemplate> } 형식인지 확인
      if (responseData.success && responseData.data) {
        return responseData.data as ListResult<CampTemplate>;
      }
      
      // 직접 ListResult<CampTemplate> 형식인 경우
      return responseData as ListResult<CampTemplate>;
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC, // 1분 (Dynamic Data)
    gcTime: CACHE_GC_TIME_DYNAMIC, // 10분 (캐시 유지 시간)
  });
}

