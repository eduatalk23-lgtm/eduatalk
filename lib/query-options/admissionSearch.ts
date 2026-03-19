import { queryOptions } from "@tanstack/react-query";
import { searchAdmissionsAction } from "@/lib/domains/admission/search/actions";
import type { AdmissionSearchFilter, PaginationParams } from "@/lib/domains/admission/types";

// ============================================
// Admission Search Query Options
// Phase 8.6 — 수동 실행 (enabled: false)
// ============================================

export const admissionSearchKeys = {
  all: ["admissionSearch"] as const,
  search: (filter: AdmissionSearchFilter, pagination: PaginationParams) =>
    [...admissionSearchKeys.all, filter, pagination] as const,
};

/**
 * 졸업생 입시 DB 검색 쿼리 옵션.
 * enabled: false → 수동 실행 (refetch로 트리거).
 */
export function admissionSearchQueryOptions(
  filter: AdmissionSearchFilter,
  pagination: PaginationParams,
) {
  return queryOptions({
    queryKey: admissionSearchKeys.search(filter, pagination),
    queryFn: async () => {
      const result = await searchAdmissionsAction(filter, pagination);
      if (!result.success) throw new Error("error" in result ? result.error : "검색 실패");
      return result.data!;
    },
    staleTime: 5 * 60_000, // 5분 캐시
    gcTime: 10 * 60_000,
    enabled: false, // 수동 실행
  });
}
