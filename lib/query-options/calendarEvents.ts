import { queryOptions } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatDateString } from '@/lib/date/calendarUtils';
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_STALE_TIME_STABLE,
  CACHE_GC_TIME_DYNAMIC,
  CACHE_GC_TIME_STABLE,
} from '@/lib/constants/queryCache';
import type {
  Calendar,
  CalendarEventWithStudyData,
  AvailabilityScheduleWithWindows,
} from '@/lib/domains/calendar/types';

// ============================================
// Query Key Factory
// ============================================

export const calendarEventKeys = {
  all: ['calendarEvents'] as const,
  calendars: (plannerId: string) =>
    [...calendarEventKeys.all, 'calendars', plannerId] as const,
  events: (calendarId: string) =>
    [...calendarEventKeys.all, 'events', calendarId] as const,
  daily: (calendarId: string, date: string) =>
    [...calendarEventKeys.events(calendarId), 'daily', date] as const,
  weekly: (calendarId: string, weekStart: string, weekEnd: string) =>
    [...calendarEventKeys.events(calendarId), 'weekly', weekStart, weekEnd] as const,
  monthly: (calendarId: string, monthStart: string, monthEnd: string) =>
    [...calendarEventKeys.events(calendarId), 'monthly', monthStart, monthEnd] as const,
  unfinished: (calendarId: string) =>
    [...calendarEventKeys.events(calendarId), 'unfinished'] as const,
  availability: (plannerId: string) =>
    [...calendarEventKeys.all, 'availability', plannerId] as const,
  availabilitySchedules: (plannerId: string) =>
    [...calendarEventKeys.availability(plannerId), 'schedules'] as const,
  effectiveWindows: (scheduleId: string, date: string) =>
    [...calendarEventKeys.all, 'effectiveWindows', scheduleId, date] as const,
};

// ============================================
// Helper: Get week range (Monday to Sunday)
// ============================================

export function getWeekRange(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return {
    start: formatDateString(weekStart),
    end: formatDateString(weekEnd),
  };
}

// ============================================
// Query Options
// ============================================

/**
 * 플래너별 캘린더 목록 조회
 * planner → calendarId 해석에 사용 (is_primary 캘린더 추출)
 */
export function calendarsByPlannerQueryOptions(plannerId: string) {
  return queryOptions({
    queryKey: calendarEventKeys.calendars(plannerId),
    queryFn: async (): Promise<Calendar[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('calendars')
        .select('*')
        .eq('planner_id', plannerId)
        .is('deleted_at', null)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: CACHE_STALE_TIME_STABLE,
    gcTime: CACHE_GC_TIME_STABLE,
  });
}

/**
 * 일간 캘린더 이벤트 조회
 * 시간 이벤트 + 종일 이벤트 모두 포함, event_study_data JOIN
 */
export function dailyCalendarEventsQueryOptions(calendarId: string, date: string) {
  return queryOptions({
    queryKey: calendarEventKeys.daily(calendarId, date),
    queryFn: async (): Promise<CalendarEventWithStudyData[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, event_study_data(*)')
        .eq('calendar_id', calendarId)
        .is('deleted_at', null)
        .or(
          `and(is_all_day.eq.false,start_at.gte.${date}T00:00:00+09:00,start_at.lte.${date}T23:59:59+09:00),` +
          `and(is_all_day.eq.true,start_date.gte.${date},start_date.lte.${date})`
        )
        .order('start_at', { ascending: true, nullsFirst: false })
        .order('order_index', { ascending: true });

      if (error) throw error;
      return (data ?? []) as CalendarEventWithStudyData[];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}

/**
 * 주간 캘린더 이벤트 조회
 * weekStart ~ weekEnd 범위 내 이벤트 (시간 + 종일)
 */
export function weeklyCalendarEventsQueryOptions(
  calendarId: string,
  weekStart: string,
  weekEnd: string
) {
  return queryOptions({
    queryKey: calendarEventKeys.weekly(calendarId, weekStart, weekEnd),
    queryFn: async (): Promise<CalendarEventWithStudyData[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, event_study_data(*)')
        .eq('calendar_id', calendarId)
        .is('deleted_at', null)
        .or(
          `and(is_all_day.eq.false,start_at.gte.${weekStart}T00:00:00+09:00,start_at.lte.${weekEnd}T23:59:59+09:00),` +
          `and(is_all_day.eq.true,start_date.gte.${weekStart},start_date.lte.${weekEnd})`
        )
        .order('start_at', { ascending: true, nullsFirst: false })
        .order('order_index', { ascending: true });

      if (error) throw error;
      return (data ?? []) as CalendarEventWithStudyData[];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}

/**
 * 월간 캘린더 이벤트 조회
 * monthStart ~ monthEnd 범위 내 이벤트
 */
export function monthlyCalendarEventsQueryOptions(
  calendarId: string,
  monthStart: string,
  monthEnd: string
) {
  return queryOptions({
    queryKey: calendarEventKeys.monthly(calendarId, monthStart, monthEnd),
    queryFn: async (): Promise<CalendarEventWithStudyData[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, event_study_data(*)')
        .eq('calendar_id', calendarId)
        .is('deleted_at', null)
        .or(
          `and(is_all_day.eq.false,start_at.gte.${monthStart}T00:00:00+09:00,start_at.lte.${monthEnd}T23:59:59+09:00),` +
          `and(is_all_day.eq.true,start_date.gte.${monthStart},start_date.lte.${monthEnd})`
        )
        .order('start_at', { ascending: true, nullsFirst: false })
        .order('order_index', { ascending: true });

      if (error) throw error;
      return (data ?? []) as CalendarEventWithStudyData[];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}

/**
 * 미완료 이벤트 조회 (Unfinished Dock)
 * 오늘 이전의 미완료 이벤트
 */
export function unfinishedCalendarEventsQueryOptions(calendarId: string) {
  const today = formatDateString(new Date());

  return queryOptions({
    queryKey: calendarEventKeys.unfinished(calendarId),
    queryFn: async (): Promise<CalendarEventWithStudyData[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, event_study_data(*)')
        .eq('calendar_id', calendarId)
        .not('status', 'in', '("completed","cancelled")')
        .eq('is_all_day', false)
        .lt('start_at', `${today}T00:00:00+09:00`)
        .is('deleted_at', null)
        .order('start_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as CalendarEventWithStudyData[];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}

/**
 * 가용성 스케줄 + 윈도우 조회
 * 플래너별 availability_schedules + availability_windows JOIN
 */
export function availabilitySchedulesQueryOptions(plannerId: string) {
  return queryOptions({
    queryKey: calendarEventKeys.availabilitySchedules(plannerId),
    queryFn: async (): Promise<AvailabilityScheduleWithWindows[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('availability_schedules')
        .select('*, availability_windows(*)')
        .eq('planner_id', plannerId)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return (data ?? []) as AvailabilityScheduleWithWindows[];
    },
    staleTime: CACHE_STALE_TIME_STABLE,
    gcTime: CACHE_GC_TIME_STABLE,
  });
}
