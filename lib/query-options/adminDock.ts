import { queryOptions } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatDateString } from '@/lib/date/calendarUtils';
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from '@/lib/constants/queryCache';

// Types
export interface DailyPlan {
  id: string;
  content_title: string | null;
  content_subject: string | null;
  content_type: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  completed_amount: number | null;
  /** @deprecated Use status instead */
  progress: number | null;
  status: string | null;
  // Binary completion support
  actual_end_time: string | null;
  custom_title: string | null;
  custom_range_display: string | null;
  sequence: number | null;
  plan_group_id: string | null;
  // Phase 3: 시간 정보 추가
  start_time: string | null;
  end_time: string | null;
  estimated_minutes: number | null;
  // Phase 4: 시간대 유형
  time_slot_type: 'study' | 'self_study' | null;
  // 1730 Timetable 필드
  week: number | null;
  day: number | null;
  day_type: string | null;
  cycle_day_number: number | null;
}

export interface WeeklyPlan {
  id: string;
  content_title: string | null;
  content_subject: string | null;
  content_type: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  status: string | null;
  custom_title: string | null;
  custom_range_display: string | null;
  plan_group_id: string | null;
  // Phase 4: 시간대 유형
  time_slot_type: 'study' | 'self_study' | null;
  // 1730 Timetable 필드
  week: number | null;
  day: number | null;
  day_type: string | null;
  cycle_day_number: number | null;
}

export interface UnfinishedPlan {
  id: string;
  plan_date: string;
  content_title: string | null;
  content_subject: string | null;
  content_type: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  carryover_from_date: string | null;
  carryover_count: number;
  custom_title: string | null;
  status: string | null;
  plan_group_id: string | null;
  // Phase 4: 시간대 유형
  time_slot_type: 'study' | 'self_study' | null;
  // 1730 Timetable 필드
  week: number | null;
  day: number | null;
  day_type: string | null;
  cycle_day_number: number | null;
}

export interface AdHocPlan {
  id: string;
  title: string;
  status: string;
  estimated_minutes: number | null;
}

// ============================================
// 비학습시간 관련 타입
// ============================================

export type NonStudyTimeBlock = {
  type: string; // "아침식사" | "점심식사" | "저녁식사" | "수면" | "기타"
  start_time: string; // HH:mm
  end_time: string; // HH:mm
};

export type LunchTime = {
  start: string; // HH:mm
  end: string; // HH:mm
};

export interface AcademySchedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  academy_name: string | null;
  subject: string | null;
  travel_time: number | null; // minutes
}

export type NonStudyItem = {
  type: "아침식사" | "점심식사" | "저녁식사" | "수면" | "학원" | "이동시간" | "기타";
  start_time: string;
  end_time: string;
  label?: string;
};

// Query key factory
export const adminDockKeys = {
  all: ['adminDock'] as const,
  daily: (studentId: string, date: string, plannerId?: string) =>
    [...adminDockKeys.all, 'daily', studentId, date, plannerId ?? 'all'] as const,
  dailyAdHoc: (studentId: string, date: string) =>
    [...adminDockKeys.all, 'dailyAdHoc', studentId, date] as const,
  dailyNonStudy: (studentId: string, date: string, planGroupIds: string[]) =>
    [...adminDockKeys.all, 'dailyNonStudy', studentId, date, ...planGroupIds.slice().sort()] as const,
  weekly: (studentId: string, weekStart: string, weekEnd: string, plannerId?: string) =>
    [...adminDockKeys.all, 'weekly', studentId, weekStart, weekEnd, plannerId ?? 'all'] as const,
  weeklyAdHoc: (studentId: string, weekStart: string, weekEnd: string) =>
    [...adminDockKeys.all, 'weeklyAdHoc', studentId, weekStart, weekEnd] as const,
  unfinished: (studentId: string, plannerId?: string) =>
    [...adminDockKeys.all, 'unfinished', studentId, plannerId ?? 'all'] as const,
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
    start: formatDateString(weekStart),
    end: formatDateString(weekEnd),
  };
}

// Query Options

/**
 * Daily Dock 플랜 조회
 * @param studentId 학생 ID
 * @param date 날짜
 * @param plannerId 플래너 ID (선택, 플래너 기반 필터링용)
 */
export function dailyPlansQueryOptions(studentId: string, date: string, plannerId?: string) {
  return queryOptions({
    queryKey: adminDockKeys.daily(studentId, date, plannerId),
    queryFn: async (): Promise<DailyPlan[]> => {
      const supabase = createSupabaseBrowserClient();

      // 플래너 필터링이 필요한 경우 plan_groups와 조인
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

        if (error) throw error;
        // plan_groups 필드 제거하고 반환
        return (data ?? []).map(({ plan_groups, ...rest }) => rest);
      }

      // 플래너 필터링 없이 조회
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
          cycle_day_number
        `)
        .eq('student_id', studentId)
        .eq('plan_date', date)
        .eq('container_type', 'daily')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('sequence', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

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
 * @param studentId 학생 ID
 * @param weekStart 주 시작일
 * @param weekEnd 주 종료일
 * @param plannerId 플래너 ID (선택, 플래너 기반 필터링용)
 */
export function weeklyPlansQueryOptions(
  studentId: string,
  weekStart: string,
  weekEnd: string,
  plannerId?: string
) {
  return queryOptions({
    queryKey: adminDockKeys.weekly(studentId, weekStart, weekEnd, plannerId),
    queryFn: async (): Promise<WeeklyPlan[]> => {
      const supabase = createSupabaseBrowserClient();

      // 플래너 필터링이 필요한 경우 plan_groups와 조인
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

        if (error) throw error;
        return (data ?? []).map(({ plan_groups, ...rest }) => rest);
      }

      // 플래너 필터링 없이 조회
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
 * @param studentId 학생 ID
 * @param plannerId 플래너 ID (선택, 플래너 기반 필터링용)
 */
export function unfinishedPlansQueryOptions(studentId: string, plannerId?: string) {
  return queryOptions({
    queryKey: adminDockKeys.unfinished(studentId, plannerId),
    queryFn: async (): Promise<UnfinishedPlan[]> => {
      const supabase = createSupabaseBrowserClient();

      // 플래너 필터링이 필요한 경우 plan_groups와 조인
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
            plan_groups!inner(planner_id)
          `)
          .eq('student_id', studentId)
          .eq('container_type', 'unfinished')
          .eq('is_active', true)
          .is('deleted_at', null)
          .eq('plan_groups.planner_id', plannerId)
          .order('plan_date', { ascending: true })
          .order('sequence', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true });

        if (error) throw error;
        return (data ?? []).map(({ plan_groups, ...rest }) => rest);
      }

      // 플래너 필터링 없이 조회
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
          cycle_day_number
        `)
        .eq('student_id', studentId)
        .eq('container_type', 'unfinished')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('plan_date', { ascending: true })
        .order('sequence', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}

// ============================================
// 비학습시간 데이터 조회
// ============================================

/**
 * 비학습시간 데이터 조회 (plan_groups의 non_study_time_blocks/lunch_time + academy_schedules)
 */
export function nonStudyTimeQueryOptions(
  studentId: string,
  date: string,
  planGroupIds: string[]
) {
  // 날짜로부터 요일 계산 (0=일, 1=월, ..., 6=토)
  const dayOfWeek = new Date(date + 'T00:00:00').getDay();

  return queryOptions({
    queryKey: adminDockKeys.dailyNonStudy(studentId, date, planGroupIds),
    queryFn: async (): Promise<NonStudyItem[]> => {
      const supabase = createSupabaseBrowserClient();
      const items: NonStudyItem[] = [];

      // 1. plan_groups에서 non_study_time_blocks, lunch_time 가져오기
      if (planGroupIds.length > 0) {
        const uniqueIds = [...new Set(planGroupIds)];
        const { data: groups } = await supabase
          .from('plan_groups')
          .select('non_study_time_blocks, lunch_time')
          .in('id', uniqueIds);

        if (groups) {
          const seen = new Set<string>(); // 중복 방지 키
          for (const group of groups) {
            // lunch_time
            const lunch = group.lunch_time as LunchTime | null;
            if (lunch?.start && lunch?.end) {
              const key = `점심식사:${lunch.start}-${lunch.end}`;
              if (!seen.has(key)) {
                seen.add(key);
                items.push({
                  type: "점심식사",
                  start_time: lunch.start,
                  end_time: lunch.end,
                  label: "점심식사",
                });
              }
            }
            // non_study_time_blocks
            const blocks = group.non_study_time_blocks as NonStudyTimeBlock[] | null;
            if (blocks) {
              for (const block of blocks) {
                const key = `${block.type}:${block.start_time}-${block.end_time}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  const type = (["아침식사", "점심식사", "저녁식사", "수면"].includes(block.type)
                    ? block.type
                    : "기타") as NonStudyItem["type"];
                  items.push({
                    type,
                    start_time: block.start_time,
                    end_time: block.end_time,
                    label: block.type,
                  });
                }
              }
            }
          }
        }
      }

      // 2. academy_schedules에서 학원 일정 + 이동시간 가져오기
      const { data: academies } = await supabase
        .from('academy_schedules')
        .select('day_of_week, start_time, end_time, academy_name, subject, travel_time')
        .eq('student_id', studentId)
        .eq('day_of_week', dayOfWeek);

      if (academies) {
        for (const schedule of academies) {
          const name = schedule.academy_name ?? '학원';
          const subjectLabel = schedule.subject ? ` (${schedule.subject})` : '';

          // 이동시간 (학원 시작 전)
          if (schedule.travel_time && schedule.travel_time > 0) {
            const [h, m] = schedule.start_time.split(':').map(Number);
            const travelStartMinutes = h * 60 + m - schedule.travel_time;
            const travelStartH = Math.floor(Math.max(0, travelStartMinutes) / 60);
            const travelStartM = Math.max(0, travelStartMinutes) % 60;
            const travelStart = `${String(travelStartH).padStart(2, '0')}:${String(travelStartM).padStart(2, '0')}`;
            items.push({
              type: "이동시간",
              start_time: travelStart,
              end_time: schedule.start_time.substring(0, 5),
              label: `이동시간 (${name})`,
            });
          }

          // 학원 일정
          items.push({
            type: "학원",
            start_time: schedule.start_time.substring(0, 5),
            end_time: schedule.end_time.substring(0, 5),
            label: `${name}${subjectLabel}`,
          });
        }
      }

      // start_time 기준 정렬
      items.sort((a, b) => {
        const [ah, am] = a.start_time.split(':').map(Number);
        const [bh, bm] = b.start_time.split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      });

      return items;
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}
