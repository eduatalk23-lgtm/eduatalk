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

type NonStudyTimeBlock = {
  type: string;
  start_time: string;
  end_time: string;
};

type LunchTime = {
  start: string;
  end: string;
};

type OverrideType = 'non_study_time' | 'academy' | 'lunch';

interface DailyOverride {
  override_type: OverrideType;
  source_index: number | null;
  is_disabled: boolean;
  start_time_override: string | null;
  end_time_override: string | null;
}

export type NonStudyItem = {
  /** 레코드 ID (새 테이블에서 조회 시 UUID, 레거시는 undefined) */
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
 * plannerId가 있으면 planGroupIds 없이도 조회 가능
 *
 * 조회 우선순위:
 * 1. student_non_study_time 테이블 (새 방식)
 * 2. 레거시 오버라이드 + 템플릿 방식 (폴백)
 */
export async function prefetchNonStudyTime(
  studentId: string,
  date: string,
  plannerId?: string
): Promise<NonStudyItem[]> {
  if (!plannerId) {
    // plannerId 없으면 프리페치 불가 (planGroupIds 필요)
    return [];
  }

  const supabase = await createSupabaseServerClient();

  // 1. 새 테이블에서 직접 조회 (새 방식)
  const { data: nonStudyRecords, error: nonStudyError } = await supabase
    .from('student_non_study_time')
    .select('id, type, start_time, end_time, label, sequence')
    .eq('planner_id', plannerId)
    .eq('plan_date', date)
    .order('start_time', { ascending: true });

  console.log('[prefetchNonStudyTime] SSR query result:', {
    plannerId,
    date,
    recordCount: nonStudyRecords?.length ?? 0,
    error: nonStudyError?.message,
    firstRecord: nonStudyRecords?.[0] ? { id: nonStudyRecords[0].id, type: nonStudyRecords[0].type } : null,
  });

  // 레코드가 있으면 새 방식 사용
  if (!nonStudyError && nonStudyRecords && nonStudyRecords.length > 0) {
    return nonStudyRecords.map((record) => {
      // TIME 형식(HH:mm:ss)을 HH:mm으로 변환
      const startTime = record.start_time.substring(0, 5);
      const endTime = record.end_time.substring(0, 5);

      // type 매핑 (점심식사, 학원, 이동시간 등)
      const typeMap: Record<string, NonStudyItem['type']> = {
        '점심식사': '점심식사',
        '아침식사': '아침식사',
        '저녁식사': '저녁식사',
        '수면': '수면',
        '학원': '학원',
        '이동시간': '이동시간',
      };
      const type = typeMap[record.type] ?? '기타';

      return {
        id: record.id, // 새 테이블 레코드 UUID
        type,
        start_time: startTime,
        end_time: endTime,
        label: record.label ?? record.type,
        sourceIndex: record.sequence,
        hasOverride: false, // 새 방식에서는 오버라이드 개념 없음
      };
    });
  }

  // 2. 새 테이블에 레코드가 없으면 레거시 방식으로 폴백
  const items: NonStudyItem[] = [];
  const seen = new Set<string>();
  const dayOfWeek = new Date(date + 'T00:00:00').getDay();

  // 0. 오버라이드 조회
  let overrides: DailyOverride[] = [];
  const { data: overrideData } = await supabase
    .from('planner_daily_overrides')
    .select('override_type, source_index, is_disabled, start_time_override, end_time_override')
    .eq('planner_id', plannerId)
    .eq('override_date', date)
    .order('created_at', { ascending: false });

  if (overrideData) {
    overrides = overrideData as DailyOverride[];
  }

  // 오버라이드 찾기 헬퍼
  const findOverride = (type: OverrideType, sourceIndex?: number): DailyOverride | undefined => {
    return overrides.find(o =>
      o.override_type === type &&
      (sourceIndex === undefined ? o.source_index === null : o.source_index === sourceIndex)
    );
  };

  const findLegacyLunchOverride = (): DailyOverride | undefined => {
    return overrides.find(o => o.override_type === 'lunch' && o.source_index === null);
  };

  // 비학습시간 블록 처리 헬퍼
  const processNonStudyData = (
    blocks: NonStudyTimeBlock[] | null,
    legacyLunchTime: LunchTime | null
  ) => {
    const hasLunchInBlocks = blocks?.some(b => b.type === "점심식사") ?? false;

    if (blocks) {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const blockOverride = findOverride('non_study_time', i);

        if (blockOverride?.is_disabled) continue;

        const startTime = blockOverride?.start_time_override ?? block.start_time;
        const endTime = blockOverride?.end_time_override ?? block.end_time;
        const key = `${block.type}:${startTime}-${endTime}`;

        if (!seen.has(key)) {
          seen.add(key);
          const type = (["아침식사", "점심식사", "저녁식사", "수면"].includes(block.type)
            ? block.type
            : "기타") as NonStudyItem["type"];
          items.push({
            type,
            start_time: startTime,
            end_time: endTime,
            label: block.type,
            sourceIndex: i,
            hasOverride: !!blockOverride,
          });
        }
      }
    }

    if (!hasLunchInBlocks && legacyLunchTime?.start && legacyLunchTime?.end) {
      const lunchOverride = findLegacyLunchOverride();
      if (lunchOverride?.is_disabled) return;

      const startTime = lunchOverride?.start_time_override ?? legacyLunchTime.start;
      const endTime = lunchOverride?.end_time_override ?? legacyLunchTime.end;
      const key = `점심식사:${startTime}-${endTime}`;

      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          type: "점심식사",
          start_time: startTime,
          end_time: endTime,
          label: "점심식사",
          hasOverride: !!lunchOverride,
        });
      }
    }
  };

  // 1. 플래너에서 비학습시간 조회
  const { data: planner } = await supabase
    .from('planners')
    .select('non_study_time_blocks, lunch_time')
    .eq('id', plannerId)
    .single();

  if (planner) {
    processNonStudyData(
      planner.non_study_time_blocks as NonStudyTimeBlock[] | null,
      planner.lunch_time as LunchTime | null
    );
  }

  // 2. 학원 일정 + 이동시간
  const { data: academies } = await supabase
    .from('academy_schedules')
    .select('id, day_of_week, start_time, end_time, academy_name, subject, travel_time')
    .eq('student_id', studentId)
    .eq('day_of_week', dayOfWeek);

  if (academies) {
    for (let i = 0; i < academies.length; i++) {
      const schedule = academies[i];
      const name = schedule.academy_name ?? '학원';
      const subjectLabel = schedule.subject ? ` (${schedule.subject})` : '';

      const academyOverride = findOverride('academy', i);
      if (academyOverride?.is_disabled) continue;

      const academyStartTime = academyOverride?.start_time_override ?? schedule.start_time.substring(0, 5);
      const academyEndTime = academyOverride?.end_time_override ?? schedule.end_time.substring(0, 5);

      // 이동시간
      if (schedule.travel_time && schedule.travel_time > 0) {
        const [h, m] = academyStartTime.split(':').map(Number);
        const travelStartMinutes = h * 60 + m - schedule.travel_time;
        const travelStartH = Math.floor(Math.max(0, travelStartMinutes) / 60);
        const travelStartM = Math.max(0, travelStartMinutes) % 60;
        const travelStart = `${String(travelStartH).padStart(2, '0')}:${String(travelStartM).padStart(2, '0')}`;
        items.push({
          type: "이동시간",
          start_time: travelStart,
          end_time: academyStartTime,
          label: `이동시간 (${name})`,
          sourceIndex: i,
          hasOverride: !!academyOverride,
        });
      }

      // 학원 일정
      items.push({
        type: "학원",
        start_time: academyStartTime,
        end_time: academyEndTime,
        label: `${name}${subjectLabel}`,
        sourceIndex: i,
        hasOverride: !!academyOverride,
      });
    }
  }

  // 정렬
  items.sort((a, b) => {
    const [ah, am] = a.start_time.split(':').map(Number);
    const [bh, bm] = b.start_time.split(':').map(Number);
    return (ah * 60 + am) - (bh * 60 + bm);
  });

  return items;
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
