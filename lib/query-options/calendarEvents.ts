import { queryOptions } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatDateString } from '@/lib/date/calendarUtils';
import {
  CACHE_STALE_TIME_STABLE,
  CACHE_STALE_TIME_CALENDAR_EVENTS,
  CACHE_GC_TIME_STABLE,
  CACHE_GC_TIME_CALENDAR_EVENTS,
} from '@/lib/constants/queryCache';
import type {
  Calendar,
  CalendarEventWithStudyData,
  CalendarListWithCalendar,
} from '@/lib/domains/calendar/types';
import { searchCalendarEventsAction } from '@/lib/domains/admin-plan/actions/searchCalendarEvents';

// ============================================
// RRULE cutoff: 2년 이전 반복 이벤트는 fetch하지 않음
// ============================================

function getRRuleCutoff(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return formatDateString(d);
}

// ============================================
// Query Key Factory
// ============================================

export const calendarEventKeys = {
  all: ['calendarEvents'] as const,
  /** 학생의 모든 캘린더 목록 (멀티 캘린더 토글용) */
  studentCalendars: (studentId: string) =>
    [...calendarEventKeys.all, 'studentCalendars', studentId] as const,
  /** 학생의 Primary 캘린더 */
  studentPrimaryCalendar: (studentId: string) =>
    [...calendarEventKeys.all, 'studentPrimaryCalendar', studentId] as const,
  /** 사용자 캘린더 리스트 (표시 설정) */
  calendarList: (userId: string) =>
    [...calendarEventKeys.all, 'calendarList', userId] as const,
  events: (calendarId: string) =>
    [...calendarEventKeys.all, 'events', calendarId] as const,
  /** 멀티 캘린더 주간 이벤트 (여러 calendarId 합산) */
  multiWeekly: (calendarIds: string[], weekStart: string, weekEnd: string) =>
    [...calendarEventKeys.all, 'multiWeekly', calendarIds.join(','), weekStart, weekEnd] as const,
  /** 멀티 캘린더 일간 이벤트 */
  multiDaily: (calendarIds: string[], date: string) =>
    [...calendarEventKeys.all, 'multiDaily', calendarIds.join(','), date] as const,
  /** 멀티 캘린더 월간 이벤트 */
  multiMonthly: (calendarIds: string[], monthStart: string, monthEnd: string) =>
    [...calendarEventKeys.all, 'multiMonthly', calendarIds.join(','), monthStart, monthEnd] as const,
  daily: (calendarId: string, date: string) =>
    [...calendarEventKeys.events(calendarId), 'daily', date] as const,
  weekly: (calendarId: string, weekStart: string, weekEnd: string) =>
    [...calendarEventKeys.events(calendarId), 'weekly', weekStart, weekEnd] as const,
  monthly: (calendarId: string, monthStart: string, monthEnd: string) =>
    [...calendarEventKeys.events(calendarId), 'monthly', monthStart, monthEnd] as const,
  overdue: (calendarId: string) =>
    [...calendarEventKeys.events(calendarId), 'overdue'] as const,
  /** 캘린더 이벤트 텍스트 검색 */
  search: (calendarId: string, query: string) =>
    [...calendarEventKeys.events(calendarId), 'search', query] as const,
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
 * 학생의 Primary 캘린더 조회
 * Calendar-First: calendars WHERE owner_id=studentId AND is_student_primary=true
 */
export function studentPrimaryCalendarQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: calendarEventKeys.studentPrimaryCalendar(studentId),
    queryFn: async (): Promise<Calendar | null> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('calendars')
        .select('*')
        .eq('owner_id', studentId)
        .eq('is_student_primary', true)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    staleTime: CACHE_STALE_TIME_STABLE,
    gcTime: CACHE_GC_TIME_STABLE,
  });
}

/**
 * 사용자 캘린더 리스트 조회 (표시 설정)
 * calendar_list JOIN calendars
 */
export function calendarListQueryOptions(userId: string) {
  return queryOptions({
    queryKey: calendarEventKeys.calendarList(userId),
    queryFn: async (): Promise<CalendarListWithCalendar[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('calendar_list')
        .select('*, calendars(*)')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data ?? []) as CalendarListWithCalendar[];
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
      const cutoff = getRRuleCutoff();
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, event_study_data(*)')
        .eq('calendar_id', calendarId)
        .is('deleted_at', null)
        .or(
          `and(is_all_day.eq.false,start_at.gte.${date}T00:00:00+09:00,start_at.lte.${date}T23:59:59+09:00),` +
          `and(is_all_day.eq.true,start_date.gte.${date},start_date.lte.${date}),` +
          `and(rrule.not.is.null,is_all_day.eq.false,start_at.gte.${cutoff}T00:00:00+09:00,start_at.lte.${date}T23:59:59+09:00),` +
          `and(rrule.not.is.null,is_all_day.eq.true,start_date.gte.${cutoff},start_date.lte.${date})`
        )
        .order('start_at', { ascending: true, nullsFirst: false })
        .order('order_index', { ascending: true });

      if (error) throw error;
      return (data ?? []) as CalendarEventWithStudyData[];
    },
    staleTime: CACHE_STALE_TIME_CALENDAR_EVENTS,
    gcTime: CACHE_GC_TIME_CALENDAR_EVENTS,
  });
}

/**
 * 주간 캘린더 이벤트 조회
 * weekStart ~ weekEnd 범위 내 이벤트 (시간 + 종일)
 * 반복 이벤트 마스터도 포함 (cutoff ~ weekEnd 범위의 rrule 이벤트)
 */
export function weeklyCalendarEventsQueryOptions(
  calendarId: string,
  weekStart: string,
  weekEnd: string
) {
  return queryOptions({
    queryKey: calendarEventKeys.weekly(calendarId, weekStart, weekEnd),
    queryFn: async (): Promise<CalendarEventWithStudyData[]> => {
      const cutoff = getRRuleCutoff();
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, event_study_data(*)')
        .eq('calendar_id', calendarId)
        .is('deleted_at', null)
        .or(
          `and(is_all_day.eq.false,start_at.gte.${weekStart}T00:00:00+09:00,start_at.lte.${weekEnd}T23:59:59+09:00),` +
          `and(is_all_day.eq.true,start_date.gte.${weekStart},start_date.lte.${weekEnd}),` +
          `and(rrule.not.is.null,is_all_day.eq.false,start_at.gte.${cutoff}T00:00:00+09:00,start_at.lte.${weekEnd}T23:59:59+09:00),` +
          `and(rrule.not.is.null,is_all_day.eq.true,start_date.gte.${cutoff},start_date.lte.${weekEnd})`
        )
        .order('start_at', { ascending: true, nullsFirst: false })
        .order('order_index', { ascending: true });

      if (error) throw error;
      return (data ?? []) as CalendarEventWithStudyData[];
    },
    staleTime: CACHE_STALE_TIME_CALENDAR_EVENTS,
    gcTime: CACHE_GC_TIME_CALENDAR_EVENTS,
  });
}

/**
 * 월간 캘린더 이벤트 조회
 * monthStart ~ monthEnd 범위 내 이벤트
 * 반복 이벤트 마스터도 포함 (cutoff ~ monthEnd 범위의 rrule 이벤트)
 */
export function monthlyCalendarEventsQueryOptions(
  calendarId: string,
  monthStart: string,
  monthEnd: string
) {
  return queryOptions({
    queryKey: calendarEventKeys.monthly(calendarId, monthStart, monthEnd),
    queryFn: async (): Promise<CalendarEventWithStudyData[]> => {
      const cutoff = getRRuleCutoff();
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, event_study_data(*)')
        .eq('calendar_id', calendarId)
        .is('deleted_at', null)
        .or(
          `and(is_all_day.eq.false,start_at.gte.${monthStart}T00:00:00+09:00,start_at.lte.${monthEnd}T23:59:59+09:00),` +
          `and(is_all_day.eq.true,start_date.gte.${monthStart},start_date.lte.${monthEnd}),` +
          `and(rrule.not.is.null,is_all_day.eq.false,start_at.gte.${cutoff}T00:00:00+09:00,start_at.lte.${monthEnd}T23:59:59+09:00),` +
          `and(rrule.not.is.null,is_all_day.eq.true,start_date.gte.${cutoff},start_date.lte.${monthEnd})`
        )
        .order('start_at', { ascending: true, nullsFirst: false })
        .order('order_index', { ascending: true });

      if (error) throw error;
      return (data ?? []) as CalendarEventWithStudyData[];
    },
    staleTime: CACHE_STALE_TIME_CALENDAR_EVENTS,
    gcTime: CACHE_GC_TIME_CALENDAR_EVENTS,
  });
}

/**
 * 미완료(overdue) 이벤트 조회
 * 오늘 이전의 미완료 이벤트
 */
export function overdueCalendarEventsQueryOptions(calendarId: string) {
  const today = formatDateString(new Date());

  return queryOptions({
    queryKey: calendarEventKeys.overdue(calendarId),
    queryFn: async (): Promise<CalendarEventWithStudyData[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, event_study_data(*)')
        .eq('calendar_id', calendarId)
        .neq('status', 'cancelled')
        .eq('is_all_day', false)
        .lt('start_at', `${today}T00:00:00+09:00`)
        .is('deleted_at', null)
        .order('start_at', { ascending: true });

      if (error) throw error;
      // Task 완료(done)된 이벤트 제외
      return ((data ?? []) as CalendarEventWithStudyData[]).filter(
        (e) => !e.event_study_data?.done
      );
    },
    staleTime: CACHE_STALE_TIME_CALENDAR_EVENTS,
    gcTime: CACHE_GC_TIME_CALENDAR_EVENTS,
  });
}

/**
 * 학생의 모든 캘린더 목록 조회 (멀티 캘린더 토글용)
 *
 * Calendar-First: calendars WHERE owner_id=studentId 직접 조회
 */
export function studentCalendarsQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: calendarEventKeys.studentCalendars(studentId),
    queryFn: async (): Promise<Calendar[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('calendars')
        .select('*')
        .eq('owner_id', studentId)
        .is('deleted_at', null)
        .order('is_student_primary', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: CACHE_STALE_TIME_STABLE,
    gcTime: CACHE_GC_TIME_STABLE,
  });
}

/**
 * 멀티 캘린더 주간 이벤트 조회
 * 여러 calendarId에 대해 IN 필터로 한 번에 조회합니다.
 */
export function multiWeeklyCalendarEventsQueryOptions(
  calendarIds: string[],
  weekStart: string,
  weekEnd: string
) {
  return queryOptions({
    queryKey: calendarEventKeys.multiWeekly(calendarIds, weekStart, weekEnd),
    queryFn: async (): Promise<CalendarEventWithStudyData[]> => {
      if (calendarIds.length === 0) return [];
      const cutoff = getRRuleCutoff();
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, event_study_data(*)')
        .in('calendar_id', calendarIds)
        .is('deleted_at', null)
        .or(
          `and(is_all_day.eq.false,start_at.gte.${weekStart}T00:00:00+09:00,start_at.lte.${weekEnd}T23:59:59+09:00),` +
          `and(is_all_day.eq.true,start_date.gte.${weekStart},start_date.lte.${weekEnd}),` +
          `and(rrule.not.is.null,is_all_day.eq.false,start_at.gte.${cutoff}T00:00:00+09:00,start_at.lte.${weekEnd}T23:59:59+09:00),` +
          `and(rrule.not.is.null,is_all_day.eq.true,start_date.gte.${cutoff},start_date.lte.${weekEnd})`
        )
        .order('start_at', { ascending: true, nullsFirst: false })
        .order('order_index', { ascending: true });

      if (error) throw error;
      return (data ?? []) as CalendarEventWithStudyData[];
    },
    staleTime: CACHE_STALE_TIME_CALENDAR_EVENTS,
    gcTime: CACHE_GC_TIME_CALENDAR_EVENTS,
  });
}

/**
 * 멀티 캘린더 일간 이벤트 조회
 */
export function multiDailyCalendarEventsQueryOptions(
  calendarIds: string[],
  date: string
) {
  return queryOptions({
    queryKey: calendarEventKeys.multiDaily(calendarIds, date),
    queryFn: async (): Promise<CalendarEventWithStudyData[]> => {
      if (calendarIds.length === 0) return [];
      const cutoff = getRRuleCutoff();
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, event_study_data(*)')
        .in('calendar_id', calendarIds)
        .is('deleted_at', null)
        .or(
          `and(is_all_day.eq.false,start_at.gte.${date}T00:00:00+09:00,start_at.lte.${date}T23:59:59+09:00),` +
          `and(is_all_day.eq.true,start_date.gte.${date},start_date.lte.${date}),` +
          `and(rrule.not.is.null,is_all_day.eq.false,start_at.gte.${cutoff}T00:00:00+09:00,start_at.lte.${date}T23:59:59+09:00),` +
          `and(rrule.not.is.null,is_all_day.eq.true,start_date.gte.${cutoff},start_date.lte.${date})`
        )
        .order('start_at', { ascending: true, nullsFirst: false })
        .order('order_index', { ascending: true });

      if (error) throw error;
      return (data ?? []) as CalendarEventWithStudyData[];
    },
    staleTime: CACHE_STALE_TIME_CALENDAR_EVENTS,
    gcTime: CACHE_GC_TIME_CALENDAR_EVENTS,
  });
}

/**
 * 멀티 캘린더 월간 이벤트 조회
 * 여러 calendarId에 대해 IN 필터로 한 번에 조회합니다.
 */
export function multiMonthlyCalendarEventsQueryOptions(
  calendarIds: string[],
  monthStart: string,
  monthEnd: string
) {
  return queryOptions({
    queryKey: calendarEventKeys.multiMonthly(calendarIds, monthStart, monthEnd),
    queryFn: async (): Promise<CalendarEventWithStudyData[]> => {
      if (calendarIds.length === 0) return [];
      const cutoff = getRRuleCutoff();
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, event_study_data(*)')
        .in('calendar_id', calendarIds)
        .is('deleted_at', null)
        .or(
          `and(is_all_day.eq.false,start_at.gte.${monthStart}T00:00:00+09:00,start_at.lte.${monthEnd}T23:59:59+09:00),` +
          `and(is_all_day.eq.true,start_date.gte.${monthStart},start_date.lte.${monthEnd}),` +
          `and(rrule.not.is.null,is_all_day.eq.false,start_at.gte.${cutoff}T00:00:00+09:00,start_at.lte.${monthEnd}T23:59:59+09:00),` +
          `and(rrule.not.is.null,is_all_day.eq.true,start_date.gte.${cutoff},start_date.lte.${monthEnd})`
        )
        .order('start_at', { ascending: true, nullsFirst: false })
        .order('order_index', { ascending: true });

      if (error) throw error;
      return (data ?? []) as CalendarEventWithStudyData[];
    },
    staleTime: CACHE_STALE_TIME_CALENDAR_EVENTS,
    gcTime: CACHE_GC_TIME_CALENDAR_EVENTS,
  });
}

/**
 * 캘린더 이벤트 텍스트 검색
 *
 * Server Action을 통해 calendar_events.title, description +
 * event_study_data.content_title, subject_name, subject_category를
 * 대소문자 무시하여 검색합니다.
 */
export function searchCalendarEventsQueryOptions(
  studentId: string,
  calendarId: string,
  query: string,
) {
  return queryOptions({
    queryKey: calendarEventKeys.search(calendarId, query),
    queryFn: () => searchCalendarEventsAction(studentId, calendarId, query),
    enabled: query.length >= 1,
    staleTime: 1000 * 30,
  });
}
