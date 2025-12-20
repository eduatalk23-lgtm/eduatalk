"use client";

import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import { queryOptions } from "@tanstack/react-query";
import { getCampTemplatesForTenantWithPagination } from "@/lib/data/campTemplates";
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from "@/lib/constants/queryCache";
import type { CampTemplate } from "@/lib/types/plan";
import type { ListResult } from "@/lib/data/core/types";

type CampTemplatesFilters = {
  search?: string;
  status?: string;
  programType?: string;
};

type UseCampTemplatesOptions = {
  tenantId: string;
  page?: number;
  pageSize?: number;
  filters?: CampTemplatesFilters;
  enabled?: boolean;
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
      return await getCampTemplatesForTenantWithPagination(tenantId, {
        page: options?.page ?? 1,
        pageSize: options?.pageSize ?? 20,
        filters: options?.filters,
      });
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC, // 1분 (Dynamic Data)
    gcTime: CACHE_GC_TIME_DYNAMIC, // 10분 (캐시 유지 시간)
  });
}

/**
 * 캠프 템플릿 목록 조회 훅
 * 
 * @example
 * ```typescript
 * const { data: templates, isLoading } = useCampTemplates({
 *   tenantId: "tenant-123",
 *   page: 1,
 *   pageSize: 20,
 *   filters: {
 *     search: "윈터",
 *     status: "active",
 *   },
 * });
 * ```
 * 
 * @param options - 조회 옵션
 * @returns React Query 쿼리 결과
 */
export function useCampTemplates({
  tenantId,
  page = 1,
  pageSize = 20,
  filters = {},
  enabled = true,
}: UseCampTemplatesOptions) {
  return useTypedQuery({
    ...campTemplatesQueryOptions(tenantId, {
      page,
      pageSize,
      filters,
    }),
    enabled: enabled && !!tenantId,
  });
}

