"use client";

import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import {
  campStatsQueryOptions,
  campAttendanceStatsQueryOptions,
  campLearningStatsQueryOptions,
} from "@/lib/query-options/campStats";

// queryOptions re-export (하위 호환성)
export {
  campStatsQueryOptions,
  campAttendanceStatsQueryOptions,
  campLearningStatsQueryOptions,
};

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

