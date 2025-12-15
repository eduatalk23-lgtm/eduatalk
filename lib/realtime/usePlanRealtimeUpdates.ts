"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type UsePlanRealtimeUpdatesOptions = {
  planDate: string;
  userId: string;
  enabled?: boolean;
};

export function usePlanRealtimeUpdates({
  planDate,
  userId,
  enabled = true,
}: UsePlanRealtimeUpdatesOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !planDate || !userId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();

    // 플랜 변경 구독
    const planChannel = supabase
      .channel(`plan-updates-${userId}-${planDate}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_plan_items",
          filter: `student_id=eq.${userId}`,
        },
        (payload) => {
          console.log("[Realtime] Plan updated:", payload);
          // 특정 planDate와 userId에 해당하는 플랜 목록 쿼리만 무효화
          queryClient.invalidateQueries({ queryKey: ["plans", userId, planDate] });
          // today 관련 쿼리는 부분 매칭으로 무효화
          queryClient.invalidateQueries({ queryKey: ["today", "plans"] });
        }
      )
      .subscribe();

    // 학습 세션 변경 구독
    const sessionChannel = supabase
      .channel(`session-updates-${userId}-${planDate}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_sessions",
          filter: `student_id=eq.${userId}`,
        },
        (payload) => {
          console.log("[Realtime] Session updated:", payload);
          // 특정 planDate와 userId에 해당하는 세션 쿼리만 무효화
          queryClient.invalidateQueries({ queryKey: ["sessions", userId, planDate] });
          // today 관련 쿼리는 부분 매칭으로 무효화
          queryClient.invalidateQueries({ queryKey: ["today", "progress"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(planChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [planDate, userId, enabled, queryClient]);
}

