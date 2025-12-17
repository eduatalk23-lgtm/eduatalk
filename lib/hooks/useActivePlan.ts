"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CACHE_STALE_TIME_REALTIME } from "@/lib/constants/queryCache";

type UseActivePlanOptions = {
  studentId: string;
  planDate: string;
  enabled?: boolean;
};

export function useActivePlan({
  studentId,
  planDate,
  enabled = true,
}: UseActivePlanOptions) {
  return useQuery({
    queryKey: ["activePlan", studentId, planDate],
    queryFn: async () => {
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

import { POSTGRES_ERROR_CODES } from "@/lib/constants/errorCodes";

      // 컬럼이 없는 경우 (42703 에러) null 반환
      if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
        console.warn("[useActivePlan] actual_start_time 컬럼이 없습니다. 마이그레이션을 실행해주세요.");
        return null;
      }

      if (error) throw error;

      return plan;
    },
    enabled,
    staleTime: CACHE_STALE_TIME_REALTIME, // 10초 (실시간 업데이트를 위해 짧게)
    refetchInterval: 1000 * 30, // 30초마다 자동 리페치
  });
}

