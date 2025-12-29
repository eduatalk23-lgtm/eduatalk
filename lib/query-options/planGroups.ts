import { queryOptions } from "@tanstack/react-query";
import type { PlanGroupFilters } from "@/lib/data/planGroups";
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from "@/lib/constants/queryCache";
import type { PlanGroup } from "@/lib/types/plan";

/**
 * 플랜 그룹 통계 정보
 */
export type PlanGroupStats = {
  planCount: number;
  completedCount: number;
  totalCount: number;
  isCompleted: boolean;
  /** 상태별 개수 (pending, in_progress, completed) */
  statusBreakdown?: {
    pending: number;
    inProgress: number;
    completed: number;
  };
};

/**
 * 플랜 그룹 목록 조회 결과 타입 (통계 포함)
 */
export type PlanGroupWithStats = PlanGroup & PlanGroupStats;

/**
 * 플랜 그룹 목록 조회 쿼리 옵션 (타입 안전)
 * 
 * queryOptions를 사용하여 타입 안전성을 향상시킵니다.
 * queryClient.getQueryData()에서도 타입 추론이 자동으로 됩니다.
 * 서버 컴포넌트에서 prefetchQuery로도 사용 가능합니다.
 * 
 * @param filters - 플랜 그룹 필터 옵션
 * @returns React Query 쿼리 옵션
 */
export function planGroupsQueryOptions(filters: PlanGroupFilters) {
  return queryOptions({
    queryKey: [
      "planGroups",
      filters.studentId,
      filters.tenantId ?? null,
      filters.status ?? null,
      filters.planPurpose ?? null,
      filters.dateRange ?? null,
      filters.includeDeleted ?? false,
    ] as const,
    queryFn: async (): Promise<PlanGroupWithStats[]> => {
      const queryParams = new URLSearchParams();
      
      if (filters.status) {
        const statusValue = Array.isArray(filters.status) 
          ? filters.status.join(",") 
          : filters.status;
        queryParams.set("status", statusValue);
      }
      if (filters.planPurpose) {
        const purposeValue = Array.isArray(filters.planPurpose)
          ? filters.planPurpose.join(",")
          : filters.planPurpose;
        queryParams.set("planPurpose", purposeValue);
      }
      if (filters.dateRange) {
        queryParams.set("startDate", filters.dateRange.start);
        queryParams.set("endDate", filters.dateRange.end);
      }
      if (filters.includeDeleted) {
        queryParams.set("includeDeleted", "true");
      }

      const response = await fetch(`/api/plan-groups?${queryParams.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "플랜 그룹 조회 실패";
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
      
      // API 응답이 { success: true, data: PlanGroupWithStats[] } 형식인지 확인
      if (responseData.success && responseData.data) {
        return responseData.data as PlanGroupWithStats[];
      }
      
      // 직접 PlanGroupWithStats[] 형식인 경우
      return responseData as PlanGroupWithStats[];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC, // 1분 (Dynamic Data)
    gcTime: CACHE_GC_TIME_DYNAMIC, // 10분 (캐시 유지 시간)
  });
}

