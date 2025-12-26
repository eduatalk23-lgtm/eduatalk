/**
 * Multi-Camp Stats Query Options
 * 멀티 캠프 통합 조회용 React Query 옵션
 */

import { queryOptions } from "@tanstack/react-query";
import type { MultiCampAttendanceStats } from "@/app/api/admin/camps/attendance/route";
import type { MultiCampPlansStats } from "@/app/api/admin/camps/plans/route";
import type { CampAlertsResponse } from "@/app/api/admin/camps/alerts/route";
import type { StudentCampProfile } from "@/app/api/admin/camps/students/[studentId]/route";
import type { LiveMonitoringResponse } from "@/app/api/admin/camps/live/route";

const CACHE_STALE_TIME = 2 * 60 * 1000; // 2분
const CACHE_GC_TIME = 10 * 60 * 1000; // 10분

/**
 * 멀티 캠프 출석 통계 쿼리 옵션
 */
export function multiCampAttendanceQueryOptions(
  campIds: string[],
  startDate?: string,
  endDate?: string
) {
  return queryOptions({
    queryKey: ["multiCampAttendance", campIds.sort().join(","), startDate, endDate] as const,
    queryFn: async (): Promise<MultiCampAttendanceStats> => {
      const params = new URLSearchParams();
      params.set("campIds", campIds.join(","));
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const response = await fetch(`/api/admin/camps/attendance?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "멀티 캠프 출석 조회 실패";
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
        return responseData.data as MultiCampAttendanceStats;
      }

      return responseData as MultiCampAttendanceStats;
    },
    staleTime: CACHE_STALE_TIME,
    gcTime: CACHE_GC_TIME,
    enabled: campIds.length > 0,
  });
}

/**
 * 멀티 캠프 플랜 진행 쿼리 옵션
 */
export function multiCampPlansQueryOptions(
  campIds: string[],
  options?: {
    date?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  return queryOptions({
    queryKey: [
      "multiCampPlans",
      campIds.sort().join(","),
      options?.date,
      options?.startDate,
      options?.endDate,
    ] as const,
    queryFn: async (): Promise<MultiCampPlansStats> => {
      const params = new URLSearchParams();
      params.set("campIds", campIds.join(","));
      if (options?.date) params.set("date", options.date);
      if (options?.startDate) params.set("startDate", options.startDate);
      if (options?.endDate) params.set("endDate", options.endDate);

      const response = await fetch(`/api/admin/camps/plans?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "멀티 캠프 플랜 조회 실패";
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
        return responseData.data as MultiCampPlansStats;
      }

      return responseData as MultiCampPlansStats;
    },
    staleTime: CACHE_STALE_TIME,
    gcTime: CACHE_GC_TIME,
    enabled: campIds.length > 0,
  });
}

/**
 * 캠프 이상 징후 알림 쿼리 옵션
 */
export function campAlertsQueryOptions(campIds: string[]) {
  return queryOptions({
    queryKey: ["campAlerts", campIds.sort().join(",")] as const,
    queryFn: async (): Promise<CampAlertsResponse> => {
      const params = new URLSearchParams();
      params.set("campIds", campIds.join(","));

      const response = await fetch(`/api/admin/camps/alerts?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "이상 징후 조회 실패";
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
        return responseData.data as CampAlertsResponse;
      }

      return responseData as CampAlertsResponse;
    },
    staleTime: 60 * 1000, // 1분 (알림은 더 자주 갱신)
    gcTime: CACHE_GC_TIME,
    enabled: campIds.length > 0,
  });
}

/**
 * 학생 캠프 통합 프로필 쿼리 옵션
 */
export function studentCampProfileQueryOptions(studentId: string | null) {
  return queryOptions({
    queryKey: ["studentCampProfile", studentId] as const,
    queryFn: async (): Promise<StudentCampProfile> => {
      if (!studentId) throw new Error("학생 ID가 필요합니다.");

      const response = await fetch(`/api/admin/camps/students/${studentId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "학생 프로필 조회 실패";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = `${errorText.substring(0, 100)}`;
          }
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();

      if (responseData.success && responseData.data) {
        return responseData.data as StudentCampProfile;
      }

      return responseData as StudentCampProfile;
    },
    staleTime: CACHE_STALE_TIME,
    gcTime: CACHE_GC_TIME,
    enabled: !!studentId,
  });
}

/**
 * 캠프 학생 목록 쿼리 옵션
 */
export function campStudentsListQueryOptions(
  campIds: string[],
  options?: {
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }
) {
  return queryOptions({
    queryKey: [
      "campStudentsList",
      campIds.sort().join(","),
      options?.search,
      options?.sortBy,
      options?.sortOrder,
    ] as const,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (campIds.length > 0) params.set("campIds", campIds.join(","));
      if (options?.search) params.set("search", options.search);
      if (options?.sortBy) params.set("sortBy", options.sortBy);
      if (options?.sortOrder) params.set("sortOrder", options.sortOrder);

      const response = await fetch(`/api/admin/camps/students?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "캠프 학생 목록 조회 실패";
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
        return responseData.data;
      }

      return responseData;
    },
    staleTime: CACHE_STALE_TIME,
    gcTime: CACHE_GC_TIME,
  });
}

/**
 * 캠프 실시간 모니터링 쿼리 옵션
 */
export function liveMonitoringQueryOptions(campIds: string[]) {
  return queryOptions({
    queryKey: ["liveMonitoring", campIds.sort().join(",")] as const,
    queryFn: async (): Promise<LiveMonitoringResponse> => {
      const params = new URLSearchParams();
      params.set("campIds", campIds.join(","));

      const response = await fetch(`/api/admin/camps/live?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "실시간 모니터링 조회 실패";
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
        return responseData.data as LiveMonitoringResponse;
      }

      return responseData as LiveMonitoringResponse;
    },
    staleTime: 10 * 1000, // 10초 (LIVE는 빠른 갱신)
    gcTime: 60 * 1000, // 1분
    enabled: campIds.length > 0,
    refetchInterval: 15 * 1000, // 15초마다 자동 갱신
  });
}
