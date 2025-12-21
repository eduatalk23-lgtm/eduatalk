"use client";

import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import { queryOptions } from "@tanstack/react-query";
import type { CampAttendanceStats, CampLearningStats } from "@/lib/domains/camp/types";

// 캠프 통계 데이터는 자주 변하지 않으므로 긴 staleTime 사용
const CACHE_STALE_TIME_STATS = 5 * 60 * 1000; // 5분
const CACHE_GC_TIME_STATS = 30 * 60 * 1000; // 30분

/**
 * 캠프 통계 쿼리 옵션 (출석 + 학습 통합)
 * 
 * 서버 컴포넌트에서 prefetchQuery로도 사용 가능합니다.
 */
export function campStatsQueryOptions(templateId: string) {
  return queryOptions({
    queryKey: ["campStats", templateId] as const,
    queryFn: async (): Promise<{
      attendance: CampAttendanceStats | null;
      learning: CampLearningStats | null;
    }> => {
      const response = await fetch(`/api/camp-stats?templateId=${encodeURIComponent(templateId)}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "캠프 통계 조회 실패";
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
      
      // API 응답이 { success: true, data: ... } 형식인지 확인
      if (responseData.success && responseData.data) {
        return responseData.data as {
          attendance: CampAttendanceStats | null;
          learning: CampLearningStats | null;
        };
      }
      
      // 직접 형식인 경우
      return responseData as {
        attendance: CampAttendanceStats | null;
        learning: CampLearningStats | null;
      };
    },
    staleTime: CACHE_STALE_TIME_STATS,
    gcTime: CACHE_GC_TIME_STATS,
  });
}

/**
 * 캠프 출석 통계 쿼리 옵션 (레거시 호환성)
 * 
 * @deprecated campStatsQueryOptions를 사용하세요.
 */
export function campAttendanceStatsQueryOptions(templateId: string) {
  return queryOptions({
    queryKey: ["campAttendanceStats", templateId] as const,
    queryFn: async (): Promise<CampAttendanceStats | null> => {
      const response = await fetch(`/api/camp-stats?templateId=${encodeURIComponent(templateId)}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "캠프 통계 조회 실패";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
          }
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      const stats = responseData.success && responseData.data
        ? responseData.data
        : responseData;
      
      return stats?.attendance ?? null;
    },
    staleTime: CACHE_STALE_TIME_STATS,
    gcTime: CACHE_GC_TIME_STATS,
  });
}

/**
 * 캠프 학습 통계 쿼리 옵션 (레거시 호환성)
 * 
 * @deprecated campStatsQueryOptions를 사용하세요.
 */
export function campLearningStatsQueryOptions(templateId: string) {
  return queryOptions({
    queryKey: ["campLearningStats", templateId] as const,
    queryFn: async (): Promise<CampLearningStats | null> => {
      const response = await fetch(`/api/camp-stats?templateId=${encodeURIComponent(templateId)}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "캠프 통계 조회 실패";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
          }
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      const stats = responseData.success && responseData.data
        ? responseData.data
        : responseData;
      
      return stats?.learning ?? null;
    },
    staleTime: CACHE_STALE_TIME_STATS,
    gcTime: CACHE_GC_TIME_STATS,
  });
}

/**
 * 캠프 출석 통계 조회 훅
 * 
 * @example
 * ```typescript
 * const { data: attendanceStats, isLoading } = useCampAttendanceStats("template-123");
 * ```
 */
export function useCampAttendanceStats(
  templateId: string,
  options?: { enabled?: boolean }
) {
  return useTypedQuery({
    ...campAttendanceStatsQueryOptions(templateId),
    enabled: options?.enabled !== false && !!templateId,
  });
}

/**
 * 캠프 학습 통계 조회 훅
 * 
 * @example
 * ```typescript
 * const { data: learningStats, isLoading } = useCampLearningStats("template-123");
 * ```
 */
export function useCampLearningStats(
  templateId: string,
  options?: { enabled?: boolean }
) {
  return useTypedQuery({
    ...campLearningStatsQueryOptions(templateId),
    enabled: options?.enabled !== false && !!templateId,
  });
}

/**
 * 캠프 통계 조회 훅 (출석 + 학습 통합)
 * 
 * @example
 * ```typescript
 * const { data, isLoading } = useCampStats("template-123");
 * // data.attendance, data.learning 사용
 * ```
 */
export function useCampStats(
  templateId: string,
  options?: { enabled?: boolean }
) {
  const statsQuery = useTypedQuery({
    ...campStatsQueryOptions(templateId),
    enabled: options?.enabled !== false && !!templateId,
  });

  return {
    data: statsQuery.data,
    attendance: statsQuery.data?.attendance ?? null,
    learning: statsQuery.data?.learning ?? null,
    isLoading: statsQuery.isLoading,
    isError: statsQuery.isError,
    error: statsQuery.error,
  };
}

