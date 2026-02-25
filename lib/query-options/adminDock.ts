import { queryOptions } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatDateString } from '@/lib/date/calendarUtils';
import {
  CACHE_STALE_TIME_DYNAMIC,
  CACHE_GC_TIME_DYNAMIC,
} from '@/lib/constants/queryCache';
import { extractTimeHHMM } from '@/lib/domains/calendar/adapters';

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
  // 오버듀 판단용 필드
  plan_date: string;
  carryover_count: number | null;
  carryover_from_date: string | null;
  /** 사용자 커스텀 색상 키 (예: 'peacock', 'tomato') */
  color?: string | null;
  /** 이벤트가 속한 캘린더 ID (캘린더 색상 해석용) */
  calendar_id?: string | null;
  /** RRULE 반복 규칙 */
  rrule?: string | null;
  /** 반복 이벤트 부모 ID */
  recurring_event_id?: string | null;
  /** exception 레코드 여부 */
  is_exception?: boolean | null;
  /** 반복 이벤트 제외 날짜 (EXDATE) */
  exdates?: string[] | null;
  /** 알림 설정 (분 단위 배열) */
  reminder_minutes?: number[] | null;
  /** 설명/메모 */
  description?: string | null;
}

export interface OverduePlan {
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
  container_type: 'daily';
}

// ============================================
// 비학습시간 관련 타입
// ============================================

export interface AcademySchedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  academy_name: string | null;
  subject: string | null;
  travel_time: number | null; // minutes
}

export type NonStudyItem = {
  /** 레코드 ID (새 테이블에서 조회 시 UUID, 레거시는 undefined) */
  id?: string;
  type: "아침식사" | "점심식사" | "저녁식사" | "수면" | "학원" | "이동시간" | "기타";
  start_time: string;
  end_time: string;
  label?: string;
  /** 오버라이드 식별용 인덱스 (비학습시간 블록의 원본 인덱스) */
  sourceIndex?: number;
  /** 오버라이드 적용 여부 */
  hasOverride?: boolean;
};

// Query key factory
export const adminDockKeys = {
  all: ['adminDock'] as const,
  daily: (studentId: string, date: string, calendarIdOrPlannerId?: string) =>
    [...adminDockKeys.all, 'daily', studentId, date, calendarIdOrPlannerId ?? 'all'] as const,
  dailyNonStudy: (studentId: string, date: string, _planGroupIds: string[], calendarId?: string) =>
    [...adminDockKeys.all, 'dailyNonStudy', studentId, date, calendarId ?? 'none'] as const,
  overdue: (studentId: string, calendarIdOrPlannerId?: string) =>
    [...adminDockKeys.all, 'overdue', studentId, calendarIdOrPlannerId ?? 'all'] as const,
  weeklyCalendar: (studentId: string, weekStart: string, weekEnd: string, calendarIdOrPlannerId?: string, groupId?: string) =>
    [...adminDockKeys.all, 'weeklyCalendar', studentId, weekStart, weekEnd, calendarIdOrPlannerId ?? 'all', groupId ?? 'all'] as const,
  dailyAllDay: (studentId: string, date: string, calendarId?: string) =>
    [...adminDockKeys.all, 'dailyAllDay', studentId, date, calendarId ?? 'all'] as const,
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
 * @param calendarIdOrPlannerId 캘린더 ID 또는 플래너 ID (선택)
 * @param options.useCalendarId true이면 calendar_id 기반 필터
 */
export function dailyPlansQueryOptions(
  studentId: string,
  date: string,
  calendarIdOrPlannerId?: string,
  options?: { useCalendarId?: boolean }
) {
  return queryOptions({
    queryKey: adminDockKeys.daily(studentId, date, calendarIdOrPlannerId),
    queryFn: async (): Promise<DailyPlan[]> => {
      const supabase = createSupabaseBrowserClient();

      // 캘린더/플래너 필터링이 필요한 경우 plan_groups와 조인
      if (calendarIdOrPlannerId) {
        const filterField = 'calendar_id';
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
          .eq(`plan_groups.${filterField}`, calendarIdOrPlannerId)
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

      if (error) throw error;
      return data ?? [];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}

/**
 * Overdue 플랜 조회 (과거 미완료 플랜)
 * - plan_date < 오늘이고 미완료인 daily 플랜
 *
 * @param studentId 학생 ID
 * @param calendarIdOrPlannerId 캘린더 ID 또는 플래너 ID (선택)
 * @param options.useCalendarId true이면 calendar_id 기반 필터
 */
export function overduePlansQueryOptions(
  studentId: string,
  calendarIdOrPlannerId?: string,
  options?: { useCalendarId?: boolean }
) {
  // 오늘 날짜 (YYYY-MM-DD)
  const today = formatDateString(new Date());

  return queryOptions({
    queryKey: adminDockKeys.overdue(studentId, calendarIdOrPlannerId),
    queryFn: async (): Promise<OverduePlan[]> => {
      const supabase = createSupabaseBrowserClient();

      // 캘린더/플래너 필터링이 필요한 경우 plan_groups와 조인
      if (calendarIdOrPlannerId) {
        const filterField = 'calendar_id';
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
            plan_groups!inner(calendar_id)
          `)
          .eq('student_id', studentId)
          .eq('container_type', 'daily')
          .lt('plan_date', today)
          .neq('status', 'completed')
          .eq('is_active', true)
          .is('deleted_at', null)
          .eq(`plan_groups.${filterField}`, calendarIdOrPlannerId)
          .order('plan_date', { ascending: true })
          .order('sequence', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true });

        if (error) throw error;
        return (data ?? []).map(({ plan_groups, ...rest }) => rest as OverduePlan);
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
          cycle_day_number,
          container_type
        `)
        .eq('student_id', studentId)
        .eq('container_type', 'daily')
        .lt('plan_date', today)
        .neq('status', 'completed')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('plan_date', { ascending: true })
        .order('sequence', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as OverduePlan[];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}

// ============================================
// 비학습시간 데이터 조회
// ============================================

/**
 * 비학습시간 데이터 조회
 *
 * Calendar-First: calendarId를 직접 받아 calendar_events 테이블에서 조회
 */
export function nonStudyTimeQueryOptions(
  studentId: string,
  date: string,
  planGroupIds: string[],
  calendarId?: string
) {
  return queryOptions({
    queryKey: adminDockKeys.dailyNonStudy(studentId, date, planGroupIds, calendarId),
    queryFn: async (): Promise<NonStudyItem[]> => {
      if (!calendarId) return [];

      const supabase = createSupabaseBrowserClient();

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

      if (error || !events) return [];

      return events.map((event) => {
        const startTime = extractTimeHHMM(event.start_at ?? null) ?? '00:00';
        const endTime = extractTimeHHMM(event.end_at ?? null) ?? '00:00';
        const type = mapToNonStudyItemType(
          event.event_type === 'academy'
            ? (event.event_subtype ?? '학원')
            : (event.event_subtype ?? event.event_type)
        );

        return {
          id: event.id,
          type,
          start_time: startTime,
          end_time: endTime,
          label: event.title ?? type,
          sourceIndex: event.order_index ?? undefined,
          hasOverride: false,
        };
      });
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}

// ============================================
// 종일 이벤트 (All-day events)
// ============================================

export interface AllDayItem {
  id: string;
  type: string;
  label: string;
  exclusionType: string | null;
  /** 이벤트 개별 색상 (calendar_events.color) */
  color?: string | null;
  /** 소속 캘린더 ID */
  calendarId?: string | null;
  /** 멀티데이 이벤트: 시작 날짜 (YYYY-MM-DD) */
  startDate?: string;
  /** 멀티데이 이벤트: 종료 날짜 (YYYY-MM-DD) */
  endDate?: string;
  /** 멀티데이 이벤트: 총 스팬 일수 */
  spanDays?: number;
}

export function allDayEventsQueryOptions(
  studentId: string,
  date: string,
  calendarId?: string,
) {
  return queryOptions({
    queryKey: adminDockKeys.dailyAllDay(studentId, date, calendarId),
    queryFn: async (): Promise<AllDayItem[]> => {
      if (!calendarId) return [];
      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase
        .from('calendar_events')
        .select('id, event_type, event_subtype, title, color, calendar_id')
        .eq('calendar_id', calendarId)
        .eq('is_all_day', true)
        .is('deleted_at', null)
        .or(`start_date.eq.${date},and(start_date.lte.${date},end_date.gte.${date})`);

      if (error || !data) return [];
      return data.map((row) => ({
        id: row.id,
        type: row.event_type,
        label: row.title ?? row.event_type,
        exclusionType: row.event_subtype,
        color: row.color,
        calendarId: row.calendar_id,
      }));
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}

/**
 * type 문자열을 NonStudyItem type으로 매핑
 */
function mapToNonStudyItemType(type: string): NonStudyItem['type'] {
  const validTypes = ['아침식사', '점심식사', '저녁식사', '수면', '학원', '이동시간', '기타'] as const;
  if (validTypes.includes(type as typeof validTypes[number])) {
    return type as NonStudyItem['type'];
  }
  return '기타';
}

// ============================================
// WeeklyCalendar planCounts 조회
// ============================================

type PlanCountData = { plan_date: string; status: string };

/**
 * WeeklyCalendar용 날짜별 플랜 카운트 queryOptions
 *
 * 기존 useEffect 기반 직접 Supabase 호출을 React Query로 전환하여
 * 캐시 공유, 중복 요청 방지, 정밀 무효화를 지원합니다.
 */
export function weeklyPlanCountsQueryOptions(
  studentId: string,
  weekStart: string,
  weekEnd: string,
  calendarIdOrPlannerId?: string,
  selectedGroupId?: string | null,
  options?: { useCalendarId?: boolean }
) {
  return queryOptions({
    queryKey: adminDockKeys.weeklyCalendar(
      studentId,
      weekStart,
      weekEnd,
      calendarIdOrPlannerId,
      selectedGroupId ?? undefined
    ),
    queryFn: async (): Promise<Map<string, { total: number; completed: number }>> => {
      const supabase = createSupabaseBrowserClient();
      let plans: PlanCountData[] = [];

      if (selectedGroupId) {
        const { data } = await supabase
          .from('student_plan')
          .select('plan_date, status')
          .eq('student_id', studentId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .eq('container_type', 'daily')
          .eq('plan_group_id', selectedGroupId)
          .gte('plan_date', weekStart)
          .lte('plan_date', weekEnd);
        plans = (data ?? []) as PlanCountData[];
      } else if (calendarIdOrPlannerId) {
        const filterField = 'calendar_id';
        const { data } = await supabase
          .from('student_plan')
          .select(`plan_date, status, plan_groups!inner(calendar_id)`)
          .eq('student_id', studentId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .eq('container_type', 'daily')
          .gte('plan_date', weekStart)
          .lte('plan_date', weekEnd)
          .eq(`plan_groups.${filterField}`, calendarIdOrPlannerId);
        plans = (data ?? []) as unknown as PlanCountData[];
      } else {
        const { data } = await supabase
          .from('student_plan')
          .select('plan_date, status')
          .eq('student_id', studentId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .eq('container_type', 'daily')
          .gte('plan_date', weekStart)
          .lte('plan_date', weekEnd);
        plans = (data ?? []) as PlanCountData[];
      }

      const counts = new Map<string, { total: number; completed: number }>();
      for (const plan of plans) {
        const existing = counts.get(plan.plan_date) || { total: 0, completed: 0 };
        existing.total++;
        if (plan.status === 'completed') {
          existing.completed++;
        }
        counts.set(plan.plan_date, existing);
      }

      return counts;
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}
