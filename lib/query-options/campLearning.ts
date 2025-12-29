import { queryOptions } from "@tanstack/react-query";
import type { CampLearningStats, ParticipantLearningStats } from "@/lib/domains/camp/types";
import type { DatePlanDetail } from "@/lib/types/camp/learning";
import type { PlanWithStudent } from "@/lib/types/camp/learning";

// 캠프 학습 통계는 자주 변하지 않으므로 긴 staleTime 사용
const CACHE_STALE_TIME_STATS = 5 * 60 * 1000; // 5분
const CACHE_GC_TIME_STATS = 30 * 60 * 1000; // 30분

// 날짜별 플랜은 자주 변경될 수 있으므로 짧은 staleTime 사용
const CACHE_STALE_TIME_PLANS = 1 * 60 * 1000; // 1분
const CACHE_GC_TIME_PLANS = 10 * 60 * 1000; // 10분

/**
 * 캠프 학습 통계 쿼리 옵션
 * 
 * 서버 컴포넌트에서 prefetchQuery로도 사용 가능합니다.
 */
export function campLearningStatsQueryOptions(templateId: string) {
  return queryOptions({
    queryKey: ["campLearningStats", templateId] as const,
    queryFn: async (): Promise<CampLearningStats | null> => {
      const response = await fetch(`/api/camp-stats?templateId=${encodeURIComponent(templateId)}`);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "캠프 학습 통계 조회 실패";
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
 * 날짜별 플랜 조회 쿼리 옵션
 * 
 * @example
 * ```typescript
 * const { data: planDetail } = useQuery(campDatePlansQueryOptions("template-123", "2024-01-15"));
 * ```
 */
export function campDatePlansQueryOptions(
  templateId: string,
  date: string,
  studentIds?: string[]
) {
  return queryOptions({
    queryKey: ["campDatePlans", templateId, date, studentIds] as const,
    queryFn: async (): Promise<DatePlanDetail> => {
      const params = new URLSearchParams({
        templateId: templateId,
      });
      if (studentIds && studentIds.length > 0) {
        params.append("studentIds", studentIds.join(","));
      }

      const response = await fetch(
        `/api/camp-learning/date/${encodeURIComponent(date)}?${params.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "날짜별 플랜 조회 실패";
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
      
      if (responseData.success && responseData.data) {
        return responseData.data as DatePlanDetail;
      }
      
      return { date, plans: [] };
    },
    staleTime: CACHE_STALE_TIME_PLANS,
    gcTime: CACHE_GC_TIME_PLANS,
    enabled: !!templateId && !!date,
  });
}

/**
 * 캠프 기간 전체 학습 기록 조회 쿼리 옵션 (달력용)
 * 
 * @example
 * ```typescript
 * const { data: records } = useQuery(
 *   campLearningRecordsQueryOptions("template-123", "2024-01-01", "2024-01-31")
 * );
 * ```
 */
export function campLearningRecordsQueryOptions(
  templateId: string,
  startDate: string,
  endDate: string
) {
  return queryOptions({
    queryKey: ["campLearningRecords", templateId, startDate, endDate] as const,
    queryFn: async (): Promise<PlanWithStudent[]> => {
      // 학습 기록은 API를 통해 조회하지 않고 직접 데이터 레이어를 호출
      // 클라이언트에서는 API를 통해 조회해야 하므로 임시로 빈 배열 반환
      // 실제로는 서버 컴포넌트에서 prefetch하거나 별도 API 엔드포인트 필요
      const response = await fetch(
        `/api/camp-learning/records?templateId=${encodeURIComponent(templateId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "학습 기록 조회 실패";
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
      
      if (responseData.success && responseData.data) {
        return responseData.data as PlanWithStudent[];
      }
      
      return [];
    },
    staleTime: CACHE_STALE_TIME_STATS, // 달력용이므로 조금 더 긴 캐시
    gcTime: CACHE_GC_TIME_STATS,
    enabled: !!templateId && !!startDate && !!endDate,
  });
}

/**
 * 학생별 학습 통계 쿼리 옵션
 * 
 * @example
 * ```typescript
 * const { data: stats } = useQuery(
 *   campStudentLearningStatsQueryOptions("template-123", "student-456")
 * );
 * ```
 */
export function campStudentLearningStatsQueryOptions(
  templateId: string,
  studentId: string
) {
  return queryOptions({
    queryKey: ["campStudentLearningStats", templateId, studentId] as const,
    queryFn: async (): Promise<ParticipantLearningStats | null> => {
      const response = await fetch(
        `/api/camp-learning/students/${encodeURIComponent(studentId)}?templateId=${encodeURIComponent(templateId)}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "학생별 학습 통계 조회 실패";
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
      
      if (responseData.success && responseData.data) {
        return responseData.data as ParticipantLearningStats | null;
      }
      
      return null;
    },
    staleTime: CACHE_STALE_TIME_STATS,
    gcTime: CACHE_GC_TIME_STATS,
    enabled: !!templateId && !!studentId,
  });
}

