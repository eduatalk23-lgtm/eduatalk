"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

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

    // 싱글톤 클라이언트 사용 (모듈 레벨에서 import)
    // 플랜 변경 구독
    const planChannel = supabase
      .channel(`plan-updates-${userId}-${planDate}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_plan",
          filter: `student_id=eq.${userId}`,
        },
        (payload) => {
          console.log("[Realtime] Plan updated:", payload);
          // predicate 기반 무효화로 모든 관련 쿼리 처리
          queryClient.invalidateQueries({
            predicate: (query) =>
              Array.isArray(query.queryKey) &&
              (query.queryKey[0] === "todayPlans" ||
                query.queryKey[0] === "todayContainerPlans" ||
                query.queryKey[0] === "today" ||
                query.queryKey[0] === "plans" ||
                query.queryKey[0] === "adminDock"),
          });
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
          table: "student_study_sessions",
          filter: `student_id=eq.${userId}`,
        },
        (payload) => {
          console.log("[Realtime] Session updated:", payload);
          // predicate 기반 무효화로 모든 관련 쿼리 처리
          queryClient.invalidateQueries({
            predicate: (query) =>
              Array.isArray(query.queryKey) &&
              (query.queryKey[0] === "todayPlans" ||
                query.queryKey[0] === "today" ||
                query.queryKey[0] === "sessions" ||
                query.queryKey[0] === "adminDock"),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(planChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [planDate, userId, enabled, queryClient]);
}

