import { queryOptions } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from "@/lib/constants/queryCache";

// Types
export interface CalendarPlanData {
  id: string;
  plan_date: string | null;
  content_type: string | null;
  content_id: string | null;
  content_title: string | null;
  content_subject: string | null;
  content_subject_category: string | null;
  status: string | null;
  start_time: string | null;
  end_time: string | null;
  estimated_minutes: number | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  progress: number | null;
  custom_title: string | null;
  custom_range_display: string | null;
  plan_group_id: string | null;
  container_type: string | null;
  sequence: number | null;
}

// Query key factory
export const adminCalendarKeys = {
  all: ["adminCalendar"] as const,
  monthly: (
    studentId: string,
    monthStart: string,
    monthEnd: string,
    plannerId?: string
  ) =>
    [
      ...adminCalendarKeys.all,
      "monthly",
      studentId,
      monthStart,
      monthEnd,
      plannerId ?? "all",
    ] as const,
};

/**
 * 월간 캘린더 플랜 조회
 * @param studentId 학생 ID
 * @param monthStart 월 시작일 (yyyy-MM-dd)
 * @param monthEnd 월 종료일 (yyyy-MM-dd)
 * @param plannerId 플래너 ID (선택, 플래너 기반 필터링용)
 */
export function monthlyPlansQueryOptions(
  studentId: string,
  monthStart: string,
  monthEnd: string,
  plannerId?: string
) {
  return queryOptions({
    queryKey: adminCalendarKeys.monthly(studentId, monthStart, monthEnd, plannerId),
    queryFn: async (): Promise<CalendarPlanData[]> => {
      const supabase = createSupabaseBrowserClient();

      const selectFields = `
        id,
        plan_date,
        content_type,
        content_id,
        content_title,
        content_subject,
        content_subject_category,
        status,
        start_time,
        end_time,
        estimated_minutes,
        planned_start_page_or_time,
        planned_end_page_or_time,
        progress,
        custom_title,
        custom_range_display,
        plan_group_id,
        container_type,
        sequence
      `;

      // 플래너 필터링이 필요한 경우 plan_groups와 조인
      if (plannerId) {
        const { data, error } = await supabase
          .from("student_plan")
          .select(`${selectFields}, plan_groups!inner(planner_id)`)
          .eq("student_id", studentId)
          .gte("plan_date", monthStart)
          .lte("plan_date", monthEnd)
          .eq("is_active", true)
          .eq("plan_groups.planner_id", plannerId)
          .order("plan_date", { ascending: true })
          .order("sequence", { ascending: true });

        if (error) throw error;
        // plan_groups 필드 제거하고 반환
        return (data ?? []).map(({ plan_groups, ...rest }) => rest);
      }

      // 플래너 필터링 없이 조회
      const { data, error } = await supabase
        .from("student_plan")
        .select(selectFields)
        .eq("student_id", studentId)
        .gte("plan_date", monthStart)
        .lte("plan_date", monthEnd)
        .eq("is_active", true)
        .order("plan_date", { ascending: true })
        .order("sequence", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}
