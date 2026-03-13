"use client";

/**
 * P2 개선: 플랜 그룹 상태 변경 실시간 구독
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

type UsePlanGroupRealtimeOptions = {
  studentId: string;
  enabled?: boolean;
};

/**
 * 플랜 그룹 상태 변경 실시간 업데이트 훅
 * - 플랜 그룹 상태 변경(active, paused, completed 등) 시 자동 반영
 */
export function usePlanGroupRealtime({
  studentId,
  enabled = true,
}: UsePlanGroupRealtimeOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !studentId) {
      return;
    }

    // plan_groups는 student_plan Trigger 채널을 공유
    // student_plan 변경 시 plan_groups도 함께 무효화
    const channel = supabase
      .channel(`plan-realtime-${studentId}`, { config: { private: true } })
      .on("broadcast", { event: "INSERT" }, () => {
        queryClient.invalidateQueries({ queryKey: ["planGroups", studentId] });
        queryClient.invalidateQueries({ queryKey: ["plan-groups"] });
      })
      .on("broadcast", { event: "UPDATE" }, () => {
        queryClient.invalidateQueries({ queryKey: ["planGroups", studentId] });
        queryClient.invalidateQueries({ queryKey: ["plan-groups"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard", "planGroups"] });
      })
      .on("broadcast", { event: "DELETE" }, () => {
        queryClient.invalidateQueries({ queryKey: ["planGroups", studentId] });
        queryClient.invalidateQueries({ queryKey: ["plan-groups"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, enabled, queryClient]);
}

/**
 * 플랜 진행률 실시간 업데이트 훅
 * - student_plan 테이블의 completed_amount, progress 변경 시 자동 반영
 */
export function usePlanProgressRealtime({
  studentId,
  planGroupId,
  enabled = true,
}: {
  studentId: string;
  planGroupId?: string;
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !studentId) {
      return;
    }

    // student_plan Broadcast 채널 공유
    const channel = supabase
      .channel(`plan-realtime-${studentId}`, { config: { private: true } })
      .on("broadcast", { event: "UPDATE" }, (event) => {
        const record = event.payload?.record as {
          completed_amount?: number;
          progress?: number;
        } | undefined;

        // completed_amount 또는 progress가 변경된 경우에만 처리
        if (
          record?.completed_amount !== undefined ||
          record?.progress !== undefined
        ) {
          queryClient.invalidateQueries({ queryKey: ["plans", studentId] });
          queryClient.invalidateQueries({ queryKey: ["today", "progress"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard", "progress"] });

          if (planGroupId) {
            queryClient.invalidateQueries({
              queryKey: ["planGroup", planGroupId, "progress"],
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, planGroupId, enabled, queryClient]);
}
