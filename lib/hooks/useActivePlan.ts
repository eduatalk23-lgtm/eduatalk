"use client";

import { queryOptions } from "@tanstack/react-query";
import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CACHE_STALE_TIME_REALTIME, CACHE_GC_TIME_REALTIME } from "@/lib/constants/queryCache";
import { POSTGRES_ERROR_CODES } from "@/lib/constants/errorCodes";

type UseActivePlanOptions = {
  studentId: string;
  planDate: string;
  enabled?: boolean;
};

type ActivePlan = {
  id: string;
  plan_date: string;
  content_type: string | null;
  content_id: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  total_duration_seconds: number | null;
  paused_duration_seconds: number | null;
  pause_count: number | null;
} | null;

/**
 * 활성 플랜 조회 쿼리 옵션 (타입 안전)
 * 
 * queryOptions를 사용하여 타입 안전성을 향상시킵니다.
 * queryClient.getQueryData()에서도 타입 추론이 자동으로 됩니다.
 */
function activePlanQueryOptions(studentId: string, planDate: string) {
  return queryOptions({
    queryKey: ["activePlan", studentId, planDate] as const,
    queryFn: async (): Promise<ActivePlan> => {
      const supabase = createSupabaseBrowserClient();
      const { data: activeSession } = await supabase
        .from("student_study_sessions")
        .select("plan_id")
        .eq("student_id", studentId)
        .is("ended_at", null)
        .maybeSingle();

      if (!activeSession?.plan_id) {
        return null;
      }

      const { data: plan, error } = await supabase
        .from("student_plan")
        .select(
          "id,plan_date,content_type,content_id,actual_start_time,actual_end_time,total_duration_seconds,paused_duration_seconds,pause_count"
        )
        .eq("id", activeSession.plan_id)
        .eq("plan_date", planDate)
        .maybeSingle();

      // 컬럼이 없는 경우 (UNDEFINED_COLUMN 에러) null 반환
      if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
        console.warn("[useActivePlan] actual_start_time 컬럼이 없습니다. 마이그레이션을 실행해주세요.");
        return null;
      }

      if (error) throw error;

      return plan;
    },
    staleTime: CACHE_STALE_TIME_REALTIME, // 10초 (실시간 업데이트를 위해 짧게)
    gcTime: CACHE_GC_TIME_REALTIME, // 5분 (캐시 유지 시간)
    refetchInterval: 1000 * 30, // 30초마다 자동 리페치
  });
}

export function useActivePlan({
  studentId,
  planDate,
  enabled = true,
}: UseActivePlanOptions) {
  return useTypedQuery({
    ...activePlanQueryOptions(studentId, planDate),
    enabled,
  });
}

/**
 * 활성 플랜 쿼리 옵션을 외부에서도 사용할 수 있도록 export
 * (prefetchQuery 등에서 사용)
 */
export { activePlanQueryOptions };

