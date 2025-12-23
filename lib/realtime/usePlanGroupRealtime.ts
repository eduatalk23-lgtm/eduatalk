"use client";

/**
 * P2 개선: 플랜 그룹 상태 변경 실시간 구독
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`plan-groups-${studentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "plan_groups",
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          console.log("[Realtime] Plan group updated:", payload);
          // 플랜 그룹 관련 쿼리 무효화
          queryClient.invalidateQueries({ queryKey: ["planGroups", studentId] });
          queryClient.invalidateQueries({ queryKey: ["plan-groups"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard", "planGroups"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "plan_groups",
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          console.log("[Realtime] Plan group created:", payload);
          queryClient.invalidateQueries({ queryKey: ["planGroups", studentId] });
          queryClient.invalidateQueries({ queryKey: ["plan-groups"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "plan_groups",
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          console.log("[Realtime] Plan group deleted:", payload);
          queryClient.invalidateQueries({ queryKey: ["planGroups", studentId] });
          queryClient.invalidateQueries({ queryKey: ["plan-groups"] });
        }
      )
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

    const supabase = createSupabaseBrowserClient();

    const channelName = planGroupId
      ? `plan-progress-${studentId}-${planGroupId}`
      : `plan-progress-${studentId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "student_plan",
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          const newRecord = payload.new as {
            completed_amount?: number;
            progress?: number;
            plan_group_id?: string;
          };

          // completed_amount 또는 progress가 변경된 경우에만 처리
          if (
            newRecord.completed_amount !== undefined ||
            newRecord.progress !== undefined
          ) {
            console.log("[Realtime] Plan progress updated:", payload);

            // 진행률 관련 쿼리 무효화
            queryClient.invalidateQueries({ queryKey: ["plans", studentId] });
            queryClient.invalidateQueries({ queryKey: ["today", "progress"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard", "progress"] });

            if (planGroupId) {
              queryClient.invalidateQueries({
                queryKey: ["planGroup", planGroupId, "progress"],
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, planGroupId, enabled, queryClient]);
}
