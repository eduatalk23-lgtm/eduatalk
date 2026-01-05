import { queryOptions } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from '@/lib/constants/queryCache';

// Types
export interface DailyPlan {
  id: string;
  content_title: string | null;
  content_subject: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  completed_start_page_or_time: number | null;
  completed_end_page_or_time: number | null;
  status: string | null;
  is_completed: boolean;
  custom_title: string | null;
  custom_range_display: string | null;
  sequence: number | null;
  plan_group_id: string | null;
}

export interface WeeklyPlan {
  id: string;
  content_title: string | null;
  content_subject: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  status: string | null;
  custom_title: string | null;
  custom_range_display: string | null;
  plan_group_id: string | null;
}

export interface UnfinishedPlan {
  id: string;
  plan_date: string;
  content_title: string | null;
  content_subject: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  carryover_from_date: string | null;
  carryover_count: number;
  custom_title: string | null;
}

export interface AdHocPlan {
  id: string;
  title: string;
  status: string;
  estimated_minutes: number | null;
}

// Query key factory
export const adminDockKeys = {
  all: ['adminDock'] as const,
  daily: (studentId: string, date: string) =>
    [...adminDockKeys.all, 'daily', studentId, date] as const,
  dailyAdHoc: (studentId: string, date: string) =>
    [...adminDockKeys.all, 'dailyAdHoc', studentId, date] as const,
  weekly: (studentId: string, weekStart: string, weekEnd: string) =>
    [...adminDockKeys.all, 'weekly', studentId, weekStart, weekEnd] as const,
  weeklyAdHoc: (studentId: string, weekStart: string, weekEnd: string) =>
    [...adminDockKeys.all, 'weeklyAdHoc', studentId, weekStart, weekEnd] as const,
  unfinished: (studentId: string) =>
    [...adminDockKeys.all, 'unfinished', studentId] as const,
};

// Helper: Get week range (Monday to Sunday)
export function getWeekRange(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return {
    start: weekStart.toISOString().split('T')[0],
    end: weekEnd.toISOString().split('T')[0],
  };
}

// Query Options

/**
 * Daily Dock 플랜 조회
 */
export function dailyPlansQueryOptions(studentId: string, date: string) {
  return queryOptions({
    queryKey: adminDockKeys.daily(studentId, date),
    queryFn: async (): Promise<DailyPlan[]> => {
      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase
        .from('student_plan')
        .select(`
          id,
          content_title,
          content_subject,
          planned_start_page_or_time,
          planned_end_page_or_time,
          completed_start_page_or_time,
          completed_end_page_or_time,
          status,
          is_completed,
          custom_title,
          custom_range_display,
          sequence,
          plan_group_id
        `)
        .eq('student_id', studentId)
        .eq('plan_date', date)
        .eq('container_type', 'daily')
        .eq('is_active', true)
        .order('sequence', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}

/**
 * Daily Dock Ad-hoc 플랜 조회
 */
export function dailyAdHocPlansQueryOptions(studentId: string, date: string) {
  return queryOptions({
    queryKey: adminDockKeys.dailyAdHoc(studentId, date),
    queryFn: async (): Promise<AdHocPlan[]> => {
      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase
        .from('ad_hoc_plans')
        .select('id, title, status, estimated_minutes')
        .eq('student_id', studentId)
        .eq('plan_date', date)
        .eq('container_type', 'daily')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}

/**
 * Weekly Dock 플랜 조회
 */
export function weeklyPlansQueryOptions(
  studentId: string,
  weekStart: string,
  weekEnd: string
) {
  return queryOptions({
    queryKey: adminDockKeys.weekly(studentId, weekStart, weekEnd),
    queryFn: async (): Promise<WeeklyPlan[]> => {
      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase
        .from('student_plan')
        .select(`
          id,
          content_title,
          content_subject,
          planned_start_page_or_time,
          planned_end_page_or_time,
          status,
          custom_title,
          custom_range_display,
          plan_group_id
        `)
        .eq('student_id', studentId)
        .eq('container_type', 'weekly')
        .eq('is_active', true)
        .gte('plan_date', weekStart)
        .lte('plan_date', weekEnd)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}

/**
 * Weekly Dock Ad-hoc 플랜 조회
 */
export function weeklyAdHocPlansQueryOptions(
  studentId: string,
  weekStart: string,
  weekEnd: string
) {
  return queryOptions({
    queryKey: adminDockKeys.weeklyAdHoc(studentId, weekStart, weekEnd),
    queryFn: async (): Promise<AdHocPlan[]> => {
      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase
        .from('ad_hoc_plans')
        .select('id, title, status, estimated_minutes')
        .eq('student_id', studentId)
        .eq('container_type', 'weekly')
        .gte('plan_date', weekStart)
        .lte('plan_date', weekEnd)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}

/**
 * Unfinished Dock 플랜 조회
 */
export function unfinishedPlansQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: adminDockKeys.unfinished(studentId),
    queryFn: async (): Promise<UnfinishedPlan[]> => {
      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase
        .from('student_plan')
        .select(`
          id,
          plan_date,
          content_title,
          content_subject,
          planned_start_page_or_time,
          planned_end_page_or_time,
          carryover_from_date,
          carryover_count,
          custom_title
        `)
        .eq('student_id', studentId)
        .eq('container_type', 'unfinished')
        .eq('is_active', true)
        .order('plan_date', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}
