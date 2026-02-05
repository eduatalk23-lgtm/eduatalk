/**
 * 스케줄 생성 함수
 *
 * 플래너 정보를 기반으로 스케줄을 생성하여
 * dateTimeSlots와 dateAvailableTimeRanges를 반환
 *
 * @module lib/domains/admin-plan/actions/planCreation/scheduleGenerator
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { calculateAvailableDates, type NonStudyTimeBlock } from '@/lib/scheduler/utils/scheduleCalculator';
import { extractScheduleMaps } from '@/lib/plan/planDataLoader';
import type { DateTimeSlots } from './timelineAdjustment';
import {
  getEffectiveAcademySchedulesForPlanner,
  getEffectiveAcademySchedules,
} from '@/lib/data/planGroups/academyOverrides';

/**
 * 플래너 정보 타입
 */
interface PlannerInfo {
  id: string;
  default_scheduler_type: string | null;
  default_scheduler_options: Record<string, unknown> | null;
  study_hours: { start: string; end: string } | null;
  self_study_hours: { start: string; end: string } | null;
  lunch_time: { start: string; end: string } | null;
  block_set_id: string | null;
  non_study_time_blocks: NonStudyTimeBlock[] | null;
}

/**
 * 블록 정보 타입
 */
interface BlockInfo {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

/**
 * 스케줄 생성 결과 타입
 */
export interface ScheduleGenerationResult {
  success: boolean;
  error?: string;
  dateTimeSlots: DateTimeSlots;
  dateAvailableTimeRanges: Map<string, Array<{ start: string; end: string }>>;
  dailySchedule: Array<{
    date: string;
    day_type: string;
    week_number: number | null;
    cycle_day_number: number | null;
  }>;
}

/**
 * 플래너 기반 스케줄 생성
 *
 * @param plannerId - 플래너 ID
 * @param periodStart - 기간 시작 날짜
 * @param periodEnd - 기간 종료 날짜
 * @returns 스케줄 생성 결과
 */
export async function generateScheduleForPlanner(
  plannerId: string,
  periodStart: string,
  periodEnd: string
): Promise<ScheduleGenerationResult> {
  const supabase = await createSupabaseServerClient();

  // 1. 플래너 정보 조회 (student_id 포함)
  const { data: planner, error: plannerError } = await supabase
    .from('planners')
    .select(`
      id,
      student_id,
      default_scheduler_type,
      default_scheduler_options,
      study_hours,
      self_study_hours,
      lunch_time,
      block_set_id,
      non_study_time_blocks,
      students!inner(tenant_id)
    `)
    .eq('id', plannerId)
    .single();

  if (plannerError || !planner) {
    return {
      success: false,
      error: '플래너를 찾을 수 없습니다.',
      dateTimeSlots: new Map(),
      dateAvailableTimeRanges: new Map(),
      dailySchedule: [],
    };
  }

  // 2. 플래너 학원일정 조회 (전역 + 오버라이드 병합)
  type StudentInfo = { tenant_id: string | null };
  const studentsData = planner.students as StudentInfo | StudentInfo[] | null;
  const studentInfo = Array.isArray(studentsData) ? studentsData[0] : studentsData;
  const effectiveAcademySchedules = await getEffectiveAcademySchedulesForPlanner(
    plannerId,
    planner.student_id,
    studentInfo?.tenant_id ?? null,
    { useAdminClient: true }
  );

  // 3. 플래너 제외일 조회 (기간 내)
  const { data: exclusions } = await supabase
    .from('planner_exclusions')
    .select('exclusion_date, exclusion_type, reason')
    .eq('planner_id', plannerId)
    .gte('exclusion_date', periodStart)
    .lte('exclusion_date', periodEnd);

  // 4. 블록 세트 정보 조회
  let blocks: BlockInfo[] = [];
  if (planner.block_set_id) {
    const { data: blockData } = await supabase
      .from('tenant_block_set_items')
      .select('day_of_week, start_time, end_time')
      .eq('block_set_id', planner.block_set_id);

    if (blockData) {
      blocks = blockData;
    }
  }

  // 5. 스케줄러 옵션 구성
  const plannerInfo = planner as PlannerInfo;
  const schedulerOptions = buildSchedulerOptions(plannerInfo);

  // 6. calculateAvailableDates 호출
  const scheduleResult = calculateAvailableDates(
    periodStart,
    periodEnd,
    blocks.map((b) => ({
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
    })),
    (exclusions || []).map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type as '휴가' | '개인사정' | '휴일지정' | '기타',
      reason: e.reason || undefined,
    })),
    effectiveAcademySchedules.map((a) => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      academy_name: a.academy_name || undefined,
      subject: a.subject || undefined,
      travel_time: a.travel_time || undefined,
    })),
    {
      scheduler_type: '1730_timetable',
      scheduler_options: undefined, // study_days, review_days는 기본값 사용
      use_self_study_with_blocks: true,
      enable_self_study_for_holidays: schedulerOptions?.enable_self_study_for_holidays === true,
      enable_self_study_for_study_days: schedulerOptions?.enable_self_study_for_study_days === true,
      lunch_time: schedulerOptions?.lunch_time ?? undefined,
      camp_study_hours: schedulerOptions?.study_hours ?? undefined,
      camp_self_study_hours: schedulerOptions?.self_study_hours ?? undefined,
      designated_holiday_hours: schedulerOptions?.designated_holiday_hours ?? undefined,
      non_study_time_blocks: plannerInfo.non_study_time_blocks || undefined,
    }
  );

  // 7. 스케줄 맵 추출
  const { dateTimeSlots, dateAvailableTimeRanges } = extractScheduleMaps(scheduleResult);

  // 8. daily_schedule 정보 추출
  const dailySchedule = scheduleResult.daily_schedule.map((daily) => ({
    date: daily.date,
    day_type: daily.day_type || '학습일',
    week_number: daily.week_number || null,
    cycle_day_number: daily.cycle_day_number || null,
  }));

  return {
    success: true,
    dateTimeSlots: dateTimeSlots as DateTimeSlots,
    dateAvailableTimeRanges,
    dailySchedule,
  };
}

/**
 * 스케줄러 옵션 타입
 */
interface SchedulerOptions {
  study_hours?: { start: string; end: string } | null;
  self_study_hours?: { start: string; end: string } | null;
  lunch_time?: { start: string; end: string } | null;
  enable_self_study_for_holidays?: boolean;
  enable_self_study_for_study_days?: boolean;
  designated_holiday_hours?: { start: string; end: string } | null;
  [key: string]: unknown;
}

/**
 * 플래너 정보에서 스케줄러 옵션 구성
 */
function buildSchedulerOptions(planner: PlannerInfo): SchedulerOptions | null {
  const baseOptions = (planner.default_scheduler_options || {}) as SchedulerOptions;

  return {
    ...baseOptions,
    study_hours: planner.study_hours,
    self_study_hours: planner.self_study_hours,
    lunch_time: planner.lunch_time,
  };
}

/**
 * 플랜 그룹 정보에서 스케줄 생성
 * (이미 플랜 그룹이 있는 경우 사용)
 *
 * @param planGroupId - 플랜 그룹 ID
 * @returns 스케줄 생성 결과
 */
export async function generateScheduleForPlanGroup(
  planGroupId: string
): Promise<ScheduleGenerationResult> {
  const supabase = await createSupabaseServerClient();

  // 1. 플랜 그룹 정보 조회 (student_id 포함)
  const { data: planGroup, error: groupError } = await supabase
    .from('plan_groups')
    .select(`
      id,
      student_id,
      period_start,
      period_end,
      scheduler_type,
      scheduler_options,
      study_hours,
      self_study_hours,
      lunch_time,
      block_set_id,
      non_study_time_blocks,
      planner_id,
      students!inner(tenant_id)
    `)
    .eq('id', planGroupId)
    .single();

  if (groupError || !planGroup) {
    return {
      success: false,
      error: '플랜 그룹을 찾을 수 없습니다.',
      dateTimeSlots: new Map(),
      dateAvailableTimeRanges: new Map(),
      dailySchedule: [],
    };
  }

  // 2. 플랜 그룹의 학원일정 조회 (전역 + 오버라이드 병합)
  type PlanGroupStudentInfo = { tenant_id: string | null };
  const planGroupStudentsData = planGroup.students as PlanGroupStudentInfo | PlanGroupStudentInfo[] | null;
  const planGroupStudentInfo = Array.isArray(planGroupStudentsData) ? planGroupStudentsData[0] : planGroupStudentsData;
  const effectivePlanGroupAcademySchedules = await getEffectiveAcademySchedules(
    planGroupId,
    planGroup.student_id,
    planGroupStudentInfo?.tenant_id ?? null,
    { useAdminClient: true }
  );

  // 3. 플랜 그룹의 제외일 조회
  const { data: exclusions } = await supabase
    .from('plan_group_exclusions')
    .select('exclusion_date, exclusion_type, reason')
    .eq('plan_group_id', planGroupId)
    .gte('exclusion_date', planGroup.period_start)
    .lte('exclusion_date', planGroup.period_end);

  // 4. 블록 세트 정보 조회
  let blocks: BlockInfo[] = [];
  if (planGroup.block_set_id) {
    const { data: blockData } = await supabase
      .from('tenant_block_set_items')
      .select('day_of_week, start_time, end_time')
      .eq('block_set_id', planGroup.block_set_id);

    if (blockData) {
      blocks = blockData;
    }
  }

  // 5. 스케줄러 옵션 구성
  const rawSchedulerOptions = planGroup.scheduler_options as SchedulerOptions | null;
  const schedulerOptions = {
    ...rawSchedulerOptions,
    study_hours: planGroup.study_hours,
    self_study_hours: planGroup.self_study_hours,
    lunch_time: planGroup.lunch_time,
  };

  // 6. calculateAvailableDates 호출
  const scheduleResult = calculateAvailableDates(
    planGroup.period_start,
    planGroup.period_end,
    blocks.map((b) => ({
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
    })),
    (exclusions || []).map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type as '휴가' | '개인사정' | '휴일지정' | '기타',
      reason: e.reason || undefined,
    })),
    effectivePlanGroupAcademySchedules.map((a) => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      academy_name: a.academy_name || undefined,
      subject: a.subject || undefined,
      travel_time: a.travel_time || undefined,
    })),
    {
      scheduler_type: '1730_timetable',
      scheduler_options: undefined, // study_days, review_days는 기본값 사용
      use_self_study_with_blocks: true,
      enable_self_study_for_holidays: rawSchedulerOptions?.enable_self_study_for_holidays === true,
      enable_self_study_for_study_days: rawSchedulerOptions?.enable_self_study_for_study_days === true,
      lunch_time: schedulerOptions?.lunch_time ?? undefined,
      camp_study_hours: schedulerOptions?.study_hours ?? undefined,
      camp_self_study_hours: schedulerOptions?.self_study_hours ?? undefined,
      designated_holiday_hours: rawSchedulerOptions?.designated_holiday_hours ?? undefined,
      non_study_time_blocks: (planGroup.non_study_time_blocks as NonStudyTimeBlock[]) || undefined,
    }
  );

  // 7. 스케줄 맵 추출
  const { dateTimeSlots, dateAvailableTimeRanges } = extractScheduleMaps(scheduleResult);

  // 8. daily_schedule 정보 추출
  const dailySchedule = scheduleResult.daily_schedule.map((daily) => ({
    date: daily.date,
    day_type: daily.day_type || '학습일',
    week_number: daily.week_number || null,
    cycle_day_number: daily.cycle_day_number || null,
  }));

  return {
    success: true,
    dateTimeSlots: dateTimeSlots as DateTimeSlots,
    dateAvailableTimeRanges,
    dailySchedule,
  };
}
