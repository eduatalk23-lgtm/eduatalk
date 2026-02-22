'use server';

/**
 * Dock 데이터 SSR 프리페치
 *
 * 서버에서 Dock 데이터를 미리 로드하여 클라이언트에 initialData로 전달
 * 초기 로딩 시간을 대폭 단축 (400-800ms → 즉시 렌더링)
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatDateString } from '@/lib/date/calendarUtils';
import type { DailyPlan, WeeklyPlan, UnfinishedPlan, AdHocPlan } from '@/lib/query-options/adminDock';

// Helper: Get week range (Monday to Sunday)
function getWeekRange(dateStr: string) {
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

/**
 * Daily Dock 플랜 프리페치 (서버용)
 */
export async function prefetchDailyPlans(
  studentId: string,
  date: string,
  plannerId?: string
): Promise<DailyPlan[]> {
  const supabase = await createSupabaseServerClient();

  if (plannerId) {
    const { data, error } = await supabase
      .from('student_plan')
      .select(`
        id,
        content_title,
        content_subject,
        content_type,
        planned_start_page_or_time,
        planned_end_page_or_time,
        completed_amount,
        progress,
        status,
        actual_end_time,
        custom_title,
        custom_range_display,
        sequence,
        plan_group_id,
        start_time,
        end_time,
        estimated_minutes,
        time_slot_type,
        week,
        day,
        day_type,
        cycle_day_number,
        plan_date,
        carryover_count,
        carryover_from_date,
        plan_groups!inner(planner_id)
      `)
      .eq('student_id', studentId)
      .eq('plan_date', date)
      .eq('container_type', 'daily')
      .eq('is_active', true)
      .is('deleted_at', null)
      .eq('plan_groups.planner_id', plannerId)
      .order('sequence', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[prefetchDailyPlans] Error:', error);
      return [];
    }
    // plan_groups 필드 제거하고 반환
    return (data ?? []).map(({ plan_groups, ...rest }) => rest);
  }

  const { data, error } = await supabase
    .from('student_plan')
    .select(`
      id,
      content_title,
      content_subject,
      content_type,
      planned_start_page_or_time,
      planned_end_page_or_time,
      completed_amount,
      progress,
      status,
      actual_end_time,
      custom_title,
      custom_range_display,
      sequence,
      plan_group_id,
      start_time,
      end_time,
      estimated_minutes,
      time_slot_type,
      week,
      day,
      day_type,
      cycle_day_number,
      plan_date,
      carryover_count,
      carryover_from_date
    `)
    .eq('student_id', studentId)
    .eq('plan_date', date)
    .eq('container_type', 'daily')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sequence', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[prefetchDailyPlans] Error:', error);
    return [];
  }
  return data ?? [];
}

/**
 * Daily Ad-hoc 플랜 프리페치 (서버용)
 */
export async function prefetchDailyAdHocPlans(
  studentId: string,
  date: string
): Promise<AdHocPlan[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('ad_hoc_plans')
    .select('id, title, status, estimated_minutes')
    .eq('student_id', studentId)
    .eq('plan_date', date)
    .eq('container_type', 'daily')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[prefetchDailyAdHocPlans] Error:', error);
    return [];
  }
  return data ?? [];
}

/**
 * Weekly Dock 플랜 프리페치 (서버용)
 */
export async function prefetchWeeklyPlans(
  studentId: string,
  date: string,
  plannerId?: string
): Promise<WeeklyPlan[]> {
  const { start: weekStart, end: weekEnd } = getWeekRange(date);
  const supabase = await createSupabaseServerClient();

  if (plannerId) {
    const { data, error } = await supabase
      .from('student_plan')
      .select(`
        id,
        content_title,
        content_subject,
        content_type,
        planned_start_page_or_time,
        planned_end_page_or_time,
        status,
        custom_title,
        custom_range_display,
        plan_group_id,
        time_slot_type,
        week,
        day,
        day_type,
        cycle_day_number,
        plan_groups!inner(planner_id)
      `)
      .eq('student_id', studentId)
      .eq('container_type', 'weekly')
      .eq('is_active', true)
      .is('deleted_at', null)
      .gte('plan_date', weekStart)
      .lte('plan_date', weekEnd)
      .eq('plan_groups.planner_id', plannerId)
      .order('sequence', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[prefetchWeeklyPlans] Error:', error);
      return [];
    }
    return (data ?? []).map(({ plan_groups, ...rest }) => rest);
  }

  const { data, error } = await supabase
    .from('student_plan')
    .select(`
      id,
      content_title,
      content_subject,
      content_type,
      planned_start_page_or_time,
      planned_end_page_or_time,
      status,
      custom_title,
      custom_range_display,
      plan_group_id,
      time_slot_type,
      week,
      day,
      day_type,
      cycle_day_number
    `)
    .eq('student_id', studentId)
    .eq('container_type', 'weekly')
    .eq('is_active', true)
    .is('deleted_at', null)
    .gte('plan_date', weekStart)
    .lte('plan_date', weekEnd)
    .order('sequence', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[prefetchWeeklyPlans] Error:', error);
    return [];
  }
  return data ?? [];
}

/**
 * Weekly Ad-hoc 플랜 프리페치 (서버용)
 */
export async function prefetchWeeklyAdHocPlans(
  studentId: string,
  date: string
): Promise<AdHocPlan[]> {
  const { start: weekStart, end: weekEnd } = getWeekRange(date);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('ad_hoc_plans')
    .select('id, title, status, estimated_minutes')
    .eq('student_id', studentId)
    .eq('container_type', 'weekly')
    .gte('plan_date', weekStart)
    .lte('plan_date', weekEnd)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[prefetchWeeklyAdHocPlans] Error:', error);
    return [];
  }
  return data ?? [];
}

/**
 * Unfinished Dock 플랜 프리페치 (서버용)
 * - container_type = 'unfinished' 플랜
 * - container_type = 'daily' 이면서 plan_date < 오늘이고 미완료인 플랜 (오버듀)
 */
export async function prefetchUnfinishedPlans(
  studentId: string,
  plannerId?: string
): Promise<UnfinishedPlan[]> {
  const supabase = await createSupabaseServerClient();

  // 오늘 날짜 (YYYY-MM-DD)
  const today = formatDateString(new Date());

  // OR 조건: unfinished 컨테이너 OR (daily 컨테이너 + 과거 날짜 + 미완료)
  const orFilter = `container_type.eq.unfinished,and(container_type.eq.daily,plan_date.lt.${today},status.neq.completed)`;

  if (plannerId) {
    const { data, error } = await supabase
      .from('student_plan')
      .select(`
        id,
        plan_date,
        content_title,
        content_subject,
        content_type,
        planned_start_page_or_time,
        planned_end_page_or_time,
        carryover_from_date,
        carryover_count,
        custom_title,
        status,
        plan_group_id,
        time_slot_type,
        week,
        day,
        day_type,
        cycle_day_number,
        container_type,
        plan_groups!inner(planner_id)
      `)
      .eq('student_id', studentId)
      .or(orFilter)
      .eq('is_active', true)
      .is('deleted_at', null)
      .eq('plan_groups.planner_id', plannerId)
      .order('plan_date', { ascending: true })
      .order('sequence', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[prefetchUnfinishedPlans] Error:', error);
      return [];
    }
    return (data ?? []).map(({ plan_groups, ...rest }) => rest as UnfinishedPlan);
  }

  const { data, error } = await supabase
    .from('student_plan')
    .select(`
      id,
      plan_date,
      content_title,
      content_subject,
      content_type,
      planned_start_page_or_time,
      planned_end_page_or_time,
      carryover_from_date,
      carryover_count,
      custom_title,
      status,
      plan_group_id,
      time_slot_type,
      week,
      day,
      day_type,
      cycle_day_number,
      container_type
    `)
    .eq('student_id', studentId)
    .or(orFilter)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('plan_date', { ascending: true })
    .order('sequence', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[prefetchUnfinishedPlans] Error:', error);
    return [];
  }
  return (data ?? []) as UnfinishedPlan[];
}

// ============================================
// 비학습시간 관련 타입 (adminDock.ts와 동일)
// ============================================

export type NonStudyItem = {
  /** 레코드 ID (calendar_events.id) */
  id?: string;
  type: "아침식사" | "점심식사" | "저녁식사" | "수면" | "학원" | "이동시간" | "기타";
  start_time: string;
  end_time: string;
  label?: string;
  sourceIndex?: number;
  hasOverride?: boolean;
};

/**
 * 비학습시간 프리페치 (서버용)
 * calendar_events 테이블에서 직접 조회
 */
export async function prefetchNonStudyTime(
  studentId: string,
  date: string,
  plannerId?: string
): Promise<NonStudyItem[]> {
  if (!plannerId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  // 1. calendarId resolve
  const { data: calendar } = await supabase
    .from('calendars')
    .select('id')
    .eq('planner_id', plannerId)
    .eq('is_primary', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (calendar?.id) {
    const dateStart = `${date}T00:00:00+09:00`;
    const dateEnd = `${date}T23:59:59+09:00`;

    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('id, event_type, event_subtype, start_at, end_at, title, order_index')
      .eq('calendar_id', calendar.id)
      .is('deleted_at', null)
      .eq('is_all_day', false)
      .in('event_type', ['non_study', 'academy', 'break'])
      .gte('start_at', dateStart)
      .lt('start_at', dateEnd)
      .order('start_at', { ascending: true });

    if (!error && events && events.length > 0) {
      return events.map((event) => {
        const startTime = event.start_at?.match(/T(\d{2}:\d{2})/)?.[1] ?? '00:00';
        const endTime = event.end_at?.match(/T(\d{2}:\d{2})/)?.[1] ?? '00:00';

        const typeMap: Record<string, NonStudyItem['type']> = {
          '점심식사': '점심식사',
          '아침식사': '아침식사',
          '저녁식사': '저녁식사',
          '수면': '수면',
          '학원': '학원',
          '이동시간': '이동시간',
        };
        const subtype = event.event_subtype ?? event.event_type;
        const type = typeMap[subtype] ?? '기타';

        return {
          id: event.id,
          type,
          start_time: startTime,
          end_time: endTime,
          label: event.title ?? subtype,
          sourceIndex: event.order_index ?? undefined,
          hasOverride: false,
        };
      });
    }
  }

  // calendarId가 없거나 calendar_events에 데이터가 없으면 빈 배열 반환
  return [];
}

/**
 * 모든 Dock 데이터 병렬 프리페치
 */
export async function prefetchAllDockData(
  studentId: string,
  date: string,
  plannerId?: string
) {
  const [
    dailyPlans,
    dailyAdHocPlans,
    weeklyPlans,
    weeklyAdHocPlans,
    unfinishedPlans,
    nonStudyItems,
  ] = await Promise.all([
    prefetchDailyPlans(studentId, date, plannerId),
    prefetchDailyAdHocPlans(studentId, date),
    prefetchWeeklyPlans(studentId, date, plannerId),
    prefetchWeeklyAdHocPlans(studentId, date),
    prefetchUnfinishedPlans(studentId, plannerId),
    prefetchNonStudyTime(studentId, date, plannerId),
  ]);

  return {
    dailyPlans,
    dailyAdHocPlans,
    weeklyPlans,
    weeklyAdHocPlans,
    unfinishedPlans,
    nonStudyItems,
  };
}

export type PrefetchedDockData = Awaited<ReturnType<typeof prefetchAllDockData>>;
