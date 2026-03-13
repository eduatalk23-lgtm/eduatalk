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

    const invalidateAllRelated = () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          (query.queryKey[0] === "todayPlans" ||
            query.queryKey[0] === "today" ||
            query.queryKey[0] === "plans" ||
            query.queryKey[0] === "adminDock" ||
            query.queryKey[0] === "calendarEvents" ||
            query.queryKey[0] === "calendarSchedule"),
      });
    };

    // Broadcast 방식: DB Trigger가 realtime.broadcast_changes()로 전송
    // WAL 폴링 불필요 — Disk I/O 절약

    // 플랜 + 캘린더 변경 구독 (DB Trigger → Broadcast)
    const planChannel = supabase
      .channel(`plan-realtime-${userId}`)
      .on("broadcast", { event: "INSERT" }, () => invalidateAllRelated())
      .on("broadcast", { event: "UPDATE" }, () => invalidateAllRelated())
      .on("broadcast", { event: "DELETE" }, () => invalidateAllRelated())
      .subscribe();

    const calendarChannel = supabase
      .channel(`calendar-realtime-${userId}`)
      .on("broadcast", { event: "INSERT" }, () => invalidateAllRelated())
      .on("broadcast", { event: "UPDATE" }, () => invalidateAllRelated())
      .on("broadcast", { event: "DELETE" }, () => invalidateAllRelated())
      .subscribe();

    return () => {
      supabase.removeChannel(planChannel);
      supabase.removeChannel(calendarChannel);
    };
  }, [planDate, userId, enabled, queryClient]);
}

