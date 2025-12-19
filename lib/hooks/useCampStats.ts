"use client";

import { useQuery, queryOptions } from "@tanstack/react-query";
import { calculateCampAttendanceStats } from "@/lib/domains/camp/attendance";
import { calculateCampLearningStats } from "@/lib/domains/camp/learningStats";
import type { CampAttendanceStats } from "@/lib/domains/camp/types";
import type { CampLearningStats } from "@/lib/domains/camp/types";

// 캠프 통계 데이터는 자주 변하지 않으므로 긴 staleTime 사용
const CACHE_STALE_TIME_STATS = 5 * 60 * 1000; // 5분
const CACHE_GC_TIME_STATS = 30 * 60 * 1000; // 30분

/**
 * 캠프 출석 통계 쿼리 옵션
 */
function campAttendanceStatsQueryOptions(templateId: string) {
  return queryOptions({
    queryKey: ["campAttendanceStats", templateId] as const,
    queryFn: async (): Promise<CampAttendanceStats | null> => {
      return await calculateCampAttendanceStats(templateId);
    },
    staleTime: CACHE_STALE_TIME_STATS,
    gcTime: CACHE_GC_TIME_STATS,
  });
}

/**
 * 캠프 학습 통계 쿼리 옵션
 */
function campLearningStatsQueryOptions(templateId: string) {
  return queryOptions({
    queryKey: ["campLearningStats", templateId] as const,
    queryFn: async (): Promise<CampLearningStats | null> => {
      return await calculateCampLearningStats(templateId);
    },
    staleTime: CACHE_STALE_TIME_STATS,
    gcTime: CACHE_GC_TIME_STATS,
  });
}

/**
 * 캠프 출석 통계 조회 훅
 */
export function useCampAttendanceStats(
  templateId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    ...campAttendanceStatsQueryOptions(templateId),
    enabled: options?.enabled !== false && !!templateId,
  });
}

/**
 * 캠프 학습 통계 조회 훅
 */
export function useCampLearningStats(
  templateId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    ...campLearningStatsQueryOptions(templateId),
    enabled: options?.enabled !== false && !!templateId,
  });
}

/**
 * 캠프 통계 조회 훅 (출석 + 학습 통합)
 */
export function useCampStats(
  templateId: string,
  options?: { enabled?: boolean }
) {
  const attendanceQuery = useCampAttendanceStats(templateId, options);
  const learningQuery = useCampLearningStats(templateId, options);

  return {
    attendance: attendanceQuery,
    learning: learningQuery,
    isLoading: attendanceQuery.isLoading || learningQuery.isLoading,
    isError: attendanceQuery.isError || learningQuery.isError,
    error: attendanceQuery.error || learningQuery.error,
  };
}

