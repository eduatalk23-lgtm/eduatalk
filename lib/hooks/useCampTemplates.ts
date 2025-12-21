"use client";

import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import { campTemplatesQueryOptions, type CampTemplatesFilters } from "@/lib/query-options/campTemplates";

// 타입 re-export (하위 호환성)
export type { CampTemplatesFilters };

type UseCampTemplatesOptions = {
  tenantId: string;
  page?: number;
  pageSize?: number;
  filters?: CampTemplatesFilters;
  enabled?: boolean;
};

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

