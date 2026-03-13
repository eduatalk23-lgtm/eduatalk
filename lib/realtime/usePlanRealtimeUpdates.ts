"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

type UsePlanRealtimeUpdatesOptions = {
  planDate: string;
  userId: string;
  enabled?: boolean;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
};

export function usePlanRealtimeUpdates({
  planDate,
  userId,
  enabled = true,
  debounceMs = 300,
}: UsePlanRealtimeUpdatesOptions) {
  const queryClient = useQueryClient();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshTime = useRef<number>(0);

  const debouncedInvalidate = useCallback(
    (keys: string[]) => {
      const now = Date.now();
      if (now - lastRefreshTime.current < debounceMs) return;

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        lastRefreshTime.current = Date.now();
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            keys.includes(query.queryKey[0] as string),
        });
      }, debounceMs);
    },
    [queryClient, debounceMs],
  );

  useEffect(() => {
    if (!enabled || !planDate || !userId) {
      return;
    }

    // 플랜 변경: 플랜 관련 쿼리만 무효화
    const planChannel = supabase
      .channel(`plan-realtime-${userId}`, { config: { private: true } })
      .on("broadcast", { event: "INSERT" }, () =>
        debouncedInvalidate(["todayPlans", "today", "plans"]),
      )
      .on("broadcast", { event: "UPDATE" }, () =>
        debouncedInvalidate(["todayPlans", "today", "plans"]),
      )
      .on("broadcast", { event: "DELETE" }, () =>
        debouncedInvalidate(["todayPlans", "today", "plans"]),
      )
      .subscribe();

    // 캘린더 변경: 캘린더 관련 쿼리만 무효화
    const calendarChannel = supabase
      .channel(`calendar-realtime-${userId}`, { config: { private: true } })
      .on("broadcast", { event: "INSERT" }, () =>
        debouncedInvalidate(["calendarEvents", "todayPlans"]),
      )
      .on("broadcast", { event: "UPDATE" }, () =>
        debouncedInvalidate(["calendarEvents", "todayPlans"]),
      )
      .on("broadcast", { event: "DELETE" }, () =>
        debouncedInvalidate(["calendarEvents", "todayPlans"]),
      )
      .subscribe();

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      supabase.removeChannel(planChannel);
      supabase.removeChannel(calendarChannel);
    };
  }, [planDate, userId, enabled, debouncedInvalidate]);
}
