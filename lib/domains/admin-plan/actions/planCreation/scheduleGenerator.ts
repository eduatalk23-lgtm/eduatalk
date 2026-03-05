/**
 * 스케줄 생성 함수
 *
 * 캘린더/플랜그룹 정보를 기반으로 스케줄을 생성하여
 * dateTimeSlots와 dateAvailableTimeRanges를 반환
 *
 * @module lib/domains/admin-plan/actions/planCreation/scheduleGenerator
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { calculateAvailableDates, type NonStudyTimeBlock } from '@/lib/scheduler/utils/scheduleCalculator';
import { extractScheduleMaps } from '@/lib/plan/planDataLoader';
import type { DateTimeSlots } from './timelineAdjustment';
import {
  getEffectiveAcademySchedules,
} from '@/lib/data/planGroups/academyOverrides';
import { reconstructAcademyPatternsFromCalendarEvents } from '../../utils/nonStudyTimeGenerator';
// Calendar-First: calendars 테이블에서 직접 조회

/**
 * 캘린더 설정 정보 타입
 */
interface CalendarInfo {
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
 * 캘린더 설정에서 스케줄러 옵션 구성
 */
function buildSchedulerOptions(calendar: CalendarInfo): SchedulerOptions | null {
  const baseOptions = (calendar.default_scheduler_options || {}) as SchedulerOptions;

  return {
    ...baseOptions,
    study_hours: calendar.study_hours,
    self_study_hours: calendar.self_study_hours,
    lunch_time: calendar.lunch_time,
  };
}

/**
 * 캘린더 기반 스케줄 생성 (Calendar-First)
 *
 * planners 테이블 대신 calendars 테이블에서 설정을 읽어옵니다.
 *
 * @param calendarId - 캘린더 ID
 * @param periodStart - 기간 시작 날짜
 * @param periodEnd - 기간 종료 날짜
 * @returns 스케줄 생성 결과
 */
export async function generateScheduleForCalendar(
  calendarId: string,
  periodStart: string,
  periodEnd: string
): Promise<ScheduleGenerationResult> {
  const supabase = await createSupabaseServerClient();

  // 1. 캘린더 정보 조회
  const { data: calendar, error: calendarError } = await supabase
    .from('calendars')
    .select(`
      id,
      default_scheduler_type,
      default_scheduler_options,
      study_hours,
      self_study_hours,
      non_study_time_blocks,
      block_set_id
    `)
    .eq('id', calendarId)
    .is('deleted_at', null)
    .single();

  if (calendarError || !calendar) {
    return {
      success: false,
      error: '캘린더를 찾을 수 없습니다.',
      dateTimeSlots: new Map(),
      dateAvailableTimeRanges: new Map(),
      dailySchedule: [],
    };
  }

  // 2. 제외일 조회 (is_exclusion=true)
  let exclusions: Array<{ exclusion_date: string; exclusion_type: string; reason: string | null }> = [];
  {
    const { data: exclusionEvents } = await supabase
      .from('calendar_events')
      .select('start_date, label, event_subtype, title')
      .eq('calendar_id', calendarId)
      .eq('is_exclusion', true)
      .eq('is_all_day', true)
      .is('deleted_at', null)
      .gte('start_date', periodStart)
      .lte('start_date', periodEnd);

    exclusions = (exclusionEvents || []).map((e) => ({
      exclusion_date: e.start_date!,
      exclusion_type: e.label ?? e.event_subtype ?? '기타',
      reason: e.title,
    }));
  }

  // 3. 학원 일정 조회 (label='학원' or '이동시간')
  let effectiveAcademySchedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string;
    travel_time?: number;
  }> = [];
  {
    const { data: academyEvents } = await supabase
      .from('calendar_events')
      .select('start_at, end_at, start_date, event_type, event_subtype, label, title')
      .eq('calendar_id', calendarId)
      .in('label', ['학원', '이동시간'])
      .is('deleted_at', null)
      .gte('start_date', periodStart)
      .lte('start_date', periodEnd);

    if (academyEvents && academyEvents.length > 0) {
      effectiveAcademySchedules = reconstructAcademyPatternsFromCalendarEvents(academyEvents);
    }
  }

  // 4. 블록 세트 정보 조회 (tenant_blocks)
  let blocks: BlockInfo[] = [];
  if (calendar.block_set_id) {
    const { data: blockData } = await supabase
      .from('tenant_blocks')
      .select('day_of_week, start_time, end_time')
      .eq('tenant_block_set_id', calendar.block_set_id);

    if (blockData) {
      blocks = blockData;
    }
  }

  // 5. 스케줄러 옵션 구성
  const calendarInfo: CalendarInfo = {
    id: calendar.id,
    default_scheduler_type: calendar.default_scheduler_type,
    default_scheduler_options: calendar.default_scheduler_options as Record<string, unknown> | null,
    study_hours: calendar.study_hours as { start: string; end: string } | null,
    self_study_hours: calendar.self_study_hours as { start: string; end: string } | null,
    lunch_time: null, // Calendar-First: non_study_time_blocks에 통합
    block_set_id: calendar.block_set_id,
    non_study_time_blocks: calendar.non_study_time_blocks as NonStudyTimeBlock[] | null,
  };
  const schedulerOptions = buildSchedulerOptions(calendarInfo);

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
      travel_time: a.travel_time || undefined,
    })),
    {
      scheduler_type: '1730_timetable',
      scheduler_options: undefined,
      use_self_study_with_blocks: true,
      enable_self_study_for_holidays: schedulerOptions?.enable_self_study_for_holidays === true,
      enable_self_study_for_study_days: schedulerOptions?.enable_self_study_for_study_days === true || !!schedulerOptions?.self_study_hours,
      lunch_time: schedulerOptions?.lunch_time ?? undefined,
      camp_study_hours: schedulerOptions?.study_hours ?? undefined,
      camp_self_study_hours: schedulerOptions?.self_study_hours ?? undefined,
      designated_holiday_hours: schedulerOptions?.designated_holiday_hours ?? undefined,
      non_study_time_blocks: calendarInfo.non_study_time_blocks || undefined,
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
      calendar_id,
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

  // 3. 플랜 그룹의 제외일 조회 (calendar_events 기반)
  let exclusions: Array<{ exclusion_date: string; exclusion_type: string; reason: string | null }> = [];
  {
    const { data: calExclusions } = await supabase
      .from('calendar_events')
      .select('start_date, label, event_subtype, title')
      .eq('student_id', planGroup.student_id)
      .eq('is_exclusion', true)
      .eq('is_all_day', true)
      .is('deleted_at', null)
      .gte('start_date', planGroup.period_start)
      .lte('start_date', planGroup.period_end);

    exclusions = (calExclusions || []).map((e) => ({
      exclusion_date: e.start_date!,
      exclusion_type: e.label ?? e.event_subtype ?? '기타',
      reason: e.title,
    }));
  }

  // 4. 블록 세트 정보 조회 (tenant_blocks)
  let blocks: BlockInfo[] = [];
  if (planGroup.block_set_id) {
    const { data: blockData } = await supabase
      .from('tenant_blocks')
      .select('day_of_week, start_time, end_time')
      .eq('tenant_block_set_id', planGroup.block_set_id);

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
      enable_self_study_for_study_days: rawSchedulerOptions?.enable_self_study_for_study_days === true || !!schedulerOptions?.self_study_hours,
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
