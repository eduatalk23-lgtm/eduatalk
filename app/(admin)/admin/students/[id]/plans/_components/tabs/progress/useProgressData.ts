"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from "@/lib/constants/queryCache";
import { adminDockKeys } from "@/lib/query-options/adminDock";
import type { ProgressPlan } from "./progressTypes";
import {
  groupPlansByWeekField,
  calculateProgressSummary,
} from "./progressUtils";

const progressKeys = {
  all: ["progress"] as const,
  group: (studentId: string, planGroupId: string) =>
    [...progressKeys.all, studentId, planGroupId] as const,
};

/**
 * plan_group_id 기준으로 전체 기간의 플랜을 조회하고
 * week 필드 기반으로 주차별/날짜별 구조화하여 반환한다.
 */
export function usePlanGroupProgress(
  studentId: string,
  planGroupId: string | null
) {
  const queryClient = useQueryClient();

  const queryKey = planGroupId
    ? progressKeys.group(studentId, planGroupId)
    : (["progress", "disabled"] as const);

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ProgressPlan[]> => {
      if (!planGroupId) return [];

      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("student_plan")
        .select(
          `
          id,
          plan_date,
          status,
          content_title,
          custom_title,
          content_type,
          start_time,
          end_time,
          planned_start_page_or_time,
          planned_end_page_or_time,
          custom_range_display,
          day_type,
          week,
          is_adhoc,
          created_at
        `
        )
        .eq("plan_group_id", planGroupId)
        .eq("is_active", true)
        .order("plan_date", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id,
        planDate: row.plan_date,
        status: row.status,
        contentTitle: row.content_title,
        customTitle: row.custom_title,
        contentType: row.content_type,
        startTime: row.start_time,
        endTime: row.end_time,
        plannedStartPageOrTime: row.planned_start_page_or_time,
        plannedEndPageOrTime: row.planned_end_page_or_time,
        customRangeDisplay: row.custom_range_display,
        dayType: row.day_type,
        week: row.week,
        isAdHoc: row.is_adhoc ?? false,
      }));
    },
    enabled: !!planGroupId,
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });

  const plans = query.data ?? [];

  const weeks = useMemo(
    () => (plans.length > 0 ? groupPlansByWeekField(plans) : []),
    [plans]
  );

  const summary = useMemo(
    () => calculateProgressSummary(plans),
    [plans]
  );

  /**
   * 플랜 상태를 캐시에서 직접 업데이트한다 (refetch 없이).
   * - 순서가 바뀌지 않음 (데이터 재정렬 없음)
   * - 네트워크 요청 없음 (즉각 반영)
   */
  const updatePlanStatusInCache = useCallback(
    (planId: string, newStatus: string) => {
      if (!planGroupId) return;

      queryClient.setQueryData<ProgressPlan[]>(
        progressKeys.group(studentId, planGroupId),
        (old) => {
          if (!old) return old;
          return old.map((p) =>
            p.id === planId ? { ...p, status: newStatus } : p
          );
        }
      );
    },
    [queryClient, studentId, planGroupId]
  );

  /**
   * dock 쿼리를 stale 마킹만 한다.
   * 실제 refetch는 해당 쿼리를 사용하는 컴포넌트가
   * 마운트/포커스될 때 자연스럽게 발생한다.
   */
  const markDockStale = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: adminDockKeys.all,
      refetchType: "none",
    });
  }, [queryClient]);

  return {
    weeks,
    summary,
    plans,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updatePlanStatusInCache,
    markDockStale,
  };
}
