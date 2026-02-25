'use server';

/**
 * Dock 데이터 SSR 프리페치
 *
 * 서버에서 Dock 데이터를 미리 로드하여 클라이언트에 initialData로 전달
 * 초기 로딩 시간을 대폭 단축 (400-800ms → 즉시 렌더링)
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DailyPlan, NonStudyItem } from '@/lib/query-options/adminDock';
import { extractTimeHHMM } from '@/lib/domains/calendar/adapters';

/**
 * Daily Dock 플랜 프리페치 (서버용)
 * @param studentId 학생 ID
 * @param date 날짜
 * @param calendarId 캘린더 ID (선택)
 */
export async function prefetchDailyPlans(
  studentId: string,
  date: string,
  calendarId?: string,
): Promise<DailyPlan[]> {
  const supabase = await createSupabaseServerClient();

  if (calendarId) {
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
        plan_groups!inner(calendar_id)
      `)
      .eq('student_id', studentId)
      .eq('plan_date', date)
      .eq('container_type', 'daily')
      .eq('is_active', true)
      .is('deleted_at', null)
      .eq('plan_groups.calendar_id', calendarId)
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

// ============================================
// 비학습시간 관련 타입 (adminDock.ts와 동일)
// ============================================

// NonStudyItem is imported from '@/lib/query-options/adminDock'

/**
 * 비학습시간 프리페치 (서버용)
 * calendar_events 테이블에서 직접 조회
 * @param calendarId 캘린더 ID
 */
export async function prefetchNonStudyTime(
  studentId: string,
  date: string,
  calendarId?: string,
): Promise<NonStudyItem[]> {
  if (!calendarId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  const dateStart = `${date}T00:00:00+09:00`;
  const dateEnd = `${date}T23:59:59+09:00`;

  const { data: events, error } = await supabase
    .from('calendar_events')
    .select('id, event_type, event_subtype, start_at, end_at, title, order_index')
    .eq('calendar_id', calendarId)
    .is('deleted_at', null)
    .eq('is_all_day', false)
    .in('event_type', ['non_study', 'academy', 'break'])
    .gte('start_at', dateStart)
    .lt('start_at', dateEnd)
    .order('start_at', { ascending: true });

  if (error || !events || events.length === 0) {
    return [];
  }

  return events.map((event) => {
    const startTime = extractTimeHHMM(event.start_at ?? null) ?? '00:00';
    const endTime = extractTimeHHMM(event.end_at ?? null) ?? '00:00';

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

/**
 * 모든 Dock 데이터 병렬 프리페치
 * @param calendarId 캘린더 ID
 */
export async function prefetchAllDockData(
  studentId: string,
  date: string,
  calendarId?: string,
) {
  const [
    dailyPlans,
    nonStudyItems,
  ] = await Promise.all([
    prefetchDailyPlans(studentId, date, calendarId),
    prefetchNonStudyTime(studentId, date, calendarId),
  ]);

  return {
    dailyPlans,
    nonStudyItems,
  };
}

export type PrefetchedDockData = Awaited<ReturnType<typeof prefetchAllDockData>>;
