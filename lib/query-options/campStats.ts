import { queryOptions } from "@tanstack/react-query";
import type { CampAttendanceStats, CampLearningStats } from "@/lib/domains/camp/types";
import type { AttendanceRecordWithStudent } from "@/lib/data/campAttendance";

// 캠프 통계 데이터는 자주 변하지 않으므로 긴 staleTime 사용
const CACHE_STALE_TIME_STATS = 5 * 60 * 1000; // 5분
const CACHE_GC_TIME_STATS = 30 * 60 * 1000; // 30분

// 출석 기록은 자주 변경될 수 있으므로 짧은 staleTime 사용
const CACHE_STALE_TIME_RECORDS = 1 * 60 * 1000; // 1분
const CACHE_GC_TIME_RECORDS = 10 * 60 * 1000; // 10분

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
      const response = await fetch(`/api/camp-stats?templateId=${encodeURIComponent(templateId)}`);

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
      const response = await fetch(`/api/camp-stats?templateId=${encodeURIComponent(templateId)}`);

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
      const response = await fetch(`/api/camp-stats?templateId=${encodeURIComponent(templateId)}`);

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
 * 날짜별 출석 기록 조회 쿼리 옵션
 * 
 * @example
 * ```typescript
 * const { data: records } = useQuery(campDateAttendanceQueryOptions("template-123", "2024-01-15"));
 * ```
 */
export function campDateAttendanceQueryOptions(
  templateId: string,
  date: string
) {
  return queryOptions({
    queryKey: ["campDateAttendance", templateId, date] as const,
    queryFn: async (): Promise<AttendanceRecordWithStudent[]> => {
      const response = await fetch(
        `/api/camp-attendance-records?templateId=${encodeURIComponent(templateId)}&date=${encodeURIComponent(date)}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "날짜별 출석 기록 조회 실패";
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
        return responseData.data as AttendanceRecordWithStudent[];
      }
      
      return [];
    },
    staleTime: CACHE_STALE_TIME_RECORDS,
    gcTime: CACHE_GC_TIME_RECORDS,
    enabled: !!templateId && !!date,
  });
}

/**
 * 캠프 기간 전체 출석 기록 조회 쿼리 옵션 (달력용)
 * 
 * @example
 * ```typescript
 * const { data: records } = useQuery(
 *   campAttendanceRecordsQueryOptions("template-123", "2024-01-01", "2024-01-31")
 * );
 * ```
 */
export function campAttendanceRecordsQueryOptions(
  templateId: string,
  startDate: string,
  endDate: string
) {
  return queryOptions({
    queryKey: ["campAttendanceRecords", templateId, startDate, endDate] as const,
    queryFn: async (): Promise<AttendanceRecordWithStudent[]> => {
      const response = await fetch(
        `/api/camp-attendance-records?templateId=${encodeURIComponent(templateId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "출석 기록 조회 실패";
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
        return responseData.data as AttendanceRecordWithStudent[];
      }
      
      return [];
    },
    staleTime: CACHE_STALE_TIME_STATS, // 달력용이므로 조금 더 긴 캐시
    gcTime: CACHE_GC_TIME_STATS,
    enabled: !!templateId && !!startDate && !!endDate,
  });
}

