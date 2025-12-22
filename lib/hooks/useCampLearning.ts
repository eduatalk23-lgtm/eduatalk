"use client";

import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import {
  campLearningStatsQueryOptions,
  campDatePlansQueryOptions,
  campLearningRecordsQueryOptions,
  campStudentLearningStatsQueryOptions,
} from "@/lib/query-options/campLearning";

// queryOptions re-export (하위 호환성)
export {
  campLearningStatsQueryOptions,
  campDatePlansQueryOptions,
  campLearningRecordsQueryOptions,
  campStudentLearningStatsQueryOptions,
};

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
 * 날짜별 플랜 조회 훅
 * 
 * @example
 * ```typescript
 * const { data: planDetail, isLoading } = useCampDatePlans("template-123", "2024-01-15");
 * ```
 */
export function useCampDatePlans(
  templateId: string,
  date: string,
  studentIds?: string[],
  options?: { enabled?: boolean }
) {
  return useTypedQuery({
    ...campDatePlansQueryOptions(templateId, date, studentIds),
    enabled: options?.enabled !== false && !!templateId && !!date,
  });
}

/**
 * 캠프 기간 전체 학습 기록 조회 훅 (달력용)
 * 
 * @example
 * ```typescript
 * const { data: records, isLoading } = useCampLearningRecords(
 *   "template-123",
 *   "2024-01-01",
 *   "2024-01-31"
 * );
 * ```
 */
export function useCampLearningRecords(
  templateId: string,
  startDate: string,
  endDate: string,
  options?: { enabled?: boolean }
) {
  return useTypedQuery({
    ...campLearningRecordsQueryOptions(templateId, startDate, endDate),
    enabled: options?.enabled !== false && !!templateId && !!startDate && !!endDate,
  });
}

/**
 * 학생별 학습 통계 조회 훅
 * 
 * @example
 * ```typescript
 * const { data: stats, isLoading } = useCampStudentLearningStats(
 *   "template-123",
 *   "student-456"
 * );
 * ```
 */
export function useCampStudentLearningStats(
  templateId: string,
  studentId: string,
  options?: { enabled?: boolean }
) {
  return useTypedQuery({
    ...campStudentLearningStatsQueryOptions(templateId, studentId),
    enabled: options?.enabled !== false && !!templateId && !!studentId,
  });
}

