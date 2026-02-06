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
  // 오버듀 판단용 필드
  plan_date: string;
  carryover_count: number | null;
  carryover_from_date: string | null;
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
  // 오버듀 플랜 구분용 (daily 컨테이너의 과거 미완료 플랜)
  container_type: 'unfinished' | 'daily';
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
  daily: (studentId: string, date: string, plannerId?: string) =>
    [...adminDockKeys.all, 'daily', studentId, date, plannerId ?? 'all'] as const,
  dailyAdHoc: (studentId: string, date: string) =>
    [...adminDockKeys.all, 'dailyAdHoc', studentId, date] as const,
  // plannerId가 있으면 planGroupIds 무시 (새 테이블 직접 조회이므로 planGroupIds 불필요)
  dailyNonStudy: (studentId: string, date: string, planGroupIds: string[], plannerId?: string) =>
    plannerId
      ? [...adminDockKeys.all, 'dailyNonStudy', studentId, date, plannerId] as const
      : [...adminDockKeys.all, 'dailyNonStudy', studentId, date, 'legacy', ...planGroupIds.slice().sort()] as const,
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
 * - container_type = 'unfinished' 플랜
 * - container_type = 'daily' 이면서 plan_date < 오늘이고 미완료인 플랜 (오버듀)
 *
 * @param studentId 학생 ID
 * @param plannerId 플래너 ID (선택, 플래너 기반 필터링용)
 */
export function unfinishedPlansQueryOptions(studentId: string, plannerId?: string) {
  // 오늘 날짜 (YYYY-MM-DD)
  const today = formatDateString(new Date());

  return queryOptions({
    queryKey: adminDockKeys.unfinished(studentId, plannerId),
    queryFn: async (): Promise<UnfinishedPlan[]> => {
      const supabase = createSupabaseBrowserClient();

      // OR 조건: unfinished 컨테이너 OR (daily 컨테이너 + 과거 날짜 + 미완료)
      const orFilter = `container_type.eq.unfinished,and(container_type.eq.daily,plan_date.lt.${today},status.neq.completed)`;

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

        if (error) throw error;
        return (data ?? []).map(({ plan_groups, ...rest }) => rest as UnfinishedPlan);
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
        .or(orFilter)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('plan_date', { ascending: true })
        .order('sequence', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as UnfinishedPlan[];
    },
    staleTime: CACHE_STALE_TIME_DYNAMIC,
    gcTime: CACHE_GC_TIME_DYNAMIC,
  });
}

// ============================================
// 비학습시간 데이터 조회
// ============================================

/** 오버라이드 타입 (레거시 호환용) */
type OverrideType = 'non_study_time' | 'academy' | 'lunch';

/** 오버라이드 레코드 (레거시 호환용) */
interface DailyOverride {
  override_type: OverrideType;
  source_index: number | null;
  is_disabled: boolean;
  start_time_override: string | null;
  end_time_override: string | null;
}

/**
 * student_non_study_time 테이블 레코드
 */
interface NonStudyTimeRecord {
  id: string;
  type: string;
  start_time: string;
  end_time: string;
  label: string | null;
  sequence: number;
}

/**
 * 비학습시간 데이터 조회
 *
 * Phase 5: 새 테이블 우선 조회 방식으로 전환
 * - student_non_study_time 테이블에서 해당 날짜 레코드 직접 조회
 * - 레코드가 없으면 레거시 방식으로 폴백 (플래너 템플릿 + 오버라이드)
 *
 * 핵심 원칙: "학생의 하루는 하나" - 비학습시간은 날짜별 레코드로 관리
 */
export function nonStudyTimeQueryOptions(
  studentId: string,
  date: string,
  planGroupIds: string[],
  plannerId?: string
) {
  // 날짜로부터 요일 계산 (0=일, 1=월, ..., 6=토)
  const dayOfWeek = new Date(date + 'T00:00:00').getDay();

  return queryOptions({
    queryKey: adminDockKeys.dailyNonStudy(studentId, date, planGroupIds, plannerId),
    queryFn: async (): Promise<NonStudyItem[]> => {
      const supabase = createSupabaseBrowserClient();

      // 1. 새 테이블에서 직접 조회 (plannerId가 있는 경우)
      if (plannerId) {
        const { data: nonStudyRecords, error } = await supabase
          .from('student_non_study_time')
          .select('id, type, start_time, end_time, label, sequence')
          .eq('planner_id', plannerId)
          .eq('plan_date', date)
          .order('start_time', { ascending: true });

        console.log('[nonStudyTimeQueryOptions] New table query result:', {
          plannerId,
          date,
          recordCount: nonStudyRecords?.length ?? 0,
          error: error?.message,
          firstRecord: nonStudyRecords?.[0] ? { id: nonStudyRecords[0].id, type: nonStudyRecords[0].type } : null,
        });

        // 레코드가 있으면 바로 반환 (새 방식)
        if (!error && nonStudyRecords && nonStudyRecords.length > 0) {
          return (nonStudyRecords as NonStudyTimeRecord[]).map((record) => {
            // TIME 형식을 HH:mm으로 변환
            const startTime = record.start_time.substring(0, 5);
            const endTime = record.end_time.substring(0, 5);

            // type을 NonStudyItem type으로 매핑
            const type = mapToNonStudyItemType(record.type);

            return {
              id: record.id, // DnD에서 아이템 식별용
              type,
              start_time: startTime,
              end_time: endTime,
              label: record.label ?? record.type,
              sourceIndex: record.sequence,
              hasOverride: false, // 새 방식에서는 오버라이드 개념 없음
            };
          });
        }
      }

      // 2. 새 테이블에 레코드가 없으면 레거시 방식으로 폴백
      return fetchNonStudyTimesLegacy(
        supabase,
        studentId,
        date,
        planGroupIds,
        plannerId,
        dayOfWeek
      );
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

/**
 * 레거시 방식으로 비학습시간 조회
 * (플래너 템플릿 + 오버라이드 병합)
 */
async function fetchNonStudyTimesLegacy(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  studentId: string,
  date: string,
  planGroupIds: string[],
  plannerId: string | undefined,
  dayOfWeek: number
): Promise<NonStudyItem[]> {
  const items: NonStudyItem[] = [];
  const seen = new Set<string>(); // 중복 방지 키

  // 0. 오버라이드 조회 (plannerId가 있는 경우에만)
  let overrides: DailyOverride[] = [];
  if (plannerId) {
    const { data: overrideData } = await supabase
      .from('planner_daily_overrides')
      .select('override_type, source_index, is_disabled, start_time_override, end_time_override')
      .eq('planner_id', plannerId)
      .eq('override_date', date)
      .order('created_at', { ascending: false });

    if (overrideData) {
      overrides = overrideData as DailyOverride[];
    }
  }

  // 오버라이드 찾기 헬퍼 (lunch 타입도 non_study_time으로 통합 처리)
  const findOverride = (type: OverrideType, sourceIndex?: number): DailyOverride | undefined => {
    // 점심식사의 경우 'lunch' 타입 오버라이드도 확인 (레거시 호환)
    const override = overrides.find(o =>
      o.override_type === type &&
      (sourceIndex === undefined ? o.source_index === null : o.source_index === sourceIndex)
    );
    return override;
  };

  // 레거시 lunch 오버라이드 찾기 (lunch_time 필드용)
  const findLegacyLunchOverride = (): DailyOverride | undefined => {
    return overrides.find(o => o.override_type === 'lunch' && o.source_index === null);
  };

  /**
   * 비학습시간 블록 처리 (통합 헬퍼)
   * lunch_time을 non_study_time_blocks 형식으로 변환하여 함께 처리
   */
  const processNonStudyData = (
    blocks: NonStudyTimeBlock[] | null,
    legacyLunchTime: LunchTime | null
  ) => {
    // 1. non_study_time_blocks 먼저 처리
    const hasLunchInBlocks = blocks?.some(b => b.type === "점심식사") ?? false;

    if (blocks) {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        // 비학습시간 오버라이드 확인
        // 점심식사의 경우 'lunch' 타입 오버라이드도 확인 (통합 재정렬에서 'lunch' 타입으로 저장됨)
        let blockOverride = findOverride('non_study_time', i);
        if (!blockOverride && block.type === '점심식사') {
          // 점심식사 블록의 레거시 lunch 오버라이드 확인 (source_index가 null)
          blockOverride = overrides.find(o =>
            o.override_type === 'lunch' && o.source_index === null
          );
        }

        // 비활성화된 경우 스킵
        if (blockOverride?.is_disabled) {
          continue;
        }

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

    // 2. 레거시 lunch_time 처리 (non_study_time_blocks에 점심식사가 없는 경우에만)
    if (!hasLunchInBlocks && legacyLunchTime?.start && legacyLunchTime?.end) {
      // 레거시 lunch 오버라이드 확인
      const lunchOverride = findLegacyLunchOverride();

      // 비활성화된 경우 스킵
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
          // 레거시 lunch_time은 sourceIndex 없음 (구분용)
          hasOverride: !!lunchOverride,
        });
      }
    }
  };

  // 1. 플래너 우선 조회
  let plannerDataLoaded = false;
  if (plannerId) {
    const { data: planner } = await supabase
      .from('planners')
      .select('non_study_time_blocks, lunch_time')
      .eq('id', plannerId)
      .single();

    if (planner) {
      plannerDataLoaded = true;
      processNonStudyData(
        planner.non_study_time_blocks as NonStudyTimeBlock[] | null,
        planner.lunch_time as LunchTime | null
      );
    }
  }

  // 2. 플래너가 없거나 데이터가 없는 경우 plan_groups에서 폴백 조회 (레거시 호환)
  if (!plannerDataLoaded && planGroupIds.length > 0) {
    const uniqueIds = [...new Set(planGroupIds)];
    const { data: groups } = await supabase
      .from('plan_groups')
      .select('non_study_time_blocks, lunch_time')
      .in('id', uniqueIds);

    if (groups) {
      for (const group of groups) {
        processNonStudyData(
          group.non_study_time_blocks as NonStudyTimeBlock[] | null,
          group.lunch_time as LunchTime | null
        );
      }
    }
  }

  // 3. academy_schedules에서 학원 일정 + 이동시간 가져오기
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

      // 학원 오버라이드 확인
      const academyOverride = findOverride('academy', i);

      // 비활성화된 경우 스킵 (학원 + 이동시간 모두)
      if (academyOverride?.is_disabled) {
        continue;
      }

      const academyStartTime = academyOverride?.start_time_override ?? schedule.start_time.substring(0, 5);
      const academyEndTime = academyOverride?.end_time_override ?? schedule.end_time.substring(0, 5);

      // 이동시간 (학원 시작 전)
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

  // start_time 기준 정렬
  items.sort((a, b) => {
    const [ah, am] = a.start_time.split(':').map(Number);
    const [bh, bm] = b.start_time.split(':').map(Number);
    return (ah * 60 + am) - (bh * 60 + bm);
  });

  return items;
}
