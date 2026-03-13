"use server";

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prefetchAllDockData } from '@/lib/domains/admin-plan/actions/dockPrefetch';
import { getTodayInTimezone } from '@/lib/utils/dateUtils';
import { getCachedCalendarSettings } from '@/lib/cache/calendarCache';
import type { DailyScheduleInfo } from '@/lib/types/plan';
import type { TimeSlot } from '@/lib/types/plan-generation';
import type { PrefetchedDockData } from '@/lib/domains/admin-plan/actions/dockPrefetch';
import type { CalendarSettings } from '@/lib/domains/admin-plan/types';

export interface PlanGroupSummaryData {
  id: string;
  name: string | null;
  status: string;
  periodStart: string;
  periodEnd: string;
  planPurpose: string | null;
}

export interface CalendarPageData {
  calendarSettings: CalendarSettings | null;
  targetDate: string;
  calendarCalculatedSchedule?: DailyScheduleInfo[];
  calendarDateTimeSlots?: Record<string, TimeSlot[]>;
  allPlanGroups: PlanGroupSummaryData[];
  activePlanGroupId: string | null;
  calendarDailySchedules: DailyScheduleInfo[][];
  calendarExclusions: Array<{
    exclusionDate: string;
    exclusionType: string;
    reason?: string | null;
  }>;
  initialDockData?: PrefetchedDockData;
}

/**
 * 관리자 캘린더 페이지에 필요한 모든 데이터를 조회합니다.
 *
 * 스케줄 계산(generateScheduleForCalendar)은 페이지 렌더에 불필요:
 * - CalendarTab은 calendarCalculatedSchedule이 없으면 plan_groups.daily_schedule로 폴백
 * - 스케줄 계산은 플랜 생성 시에만 필요, 캘린더 뷰에는 불필요
 * - 이전: settings → schedule 계산(4~5초) → 렌더
 * - 개선: settings + planGroups + dock 병렬 조회(~500ms) → 즉시 렌더
 */
export async function fetchCalendarPageData(
  studentId: string,
  calendarId: string,
  dateOverride?: string,
): Promise<CalendarPageData> {
  const supabase = await createSupabaseServerClient();
  const targetDate = dateOverride ?? getTodayInTimezone();

  // settings + planGroups + dock 모두 즉시 병렬 시작
  const [calendarSettings, { data: calendarGroups }, initialDockData] = await Promise.all([
    getCachedCalendarSettings(calendarId),
    supabase
      .from('plan_groups')
      .select('id, name, status, period_start, period_end, plan_purpose, daily_schedule, created_at')
      .eq('calendar_id', calendarId)
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
    prefetchAllDockData(studentId, targetDate, calendarId),
  ]);

  const allPlanGroups: PlanGroupSummaryData[] = (calendarGroups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    status: g.status,
    periodStart: g.period_start ?? '',
    periodEnd: g.period_end ?? '',
    planPurpose: g.plan_purpose,
  }));

  const activePlanGroupId = calendarGroups?.find((g) => g.status === 'active')?.id ?? null;

  // plan_groups.daily_schedule에서 직접 사용 (DB에 이미 저장됨)
  const calendarDailySchedules = (calendarGroups ?? [])
    .map((g) => g.daily_schedule as DailyScheduleInfo[] | null)
    .filter((s): s is DailyScheduleInfo[] => Array.isArray(s) && s.length > 0);

  const calendarExclusions = calendarSettings?.exclusions?.map((exc) => ({
    exclusionDate: exc.exclusion_date,
    exclusionType: exc.exclusion_type,
    reason: exc.reason,
  })) ?? [];

  return {
    calendarSettings,
    targetDate,
    // 스케줄 계산 생략 → CalendarTab이 calendarDailySchedules로 폴백
    calendarCalculatedSchedule: undefined,
    calendarDateTimeSlots: undefined,
    allPlanGroups,
    activePlanGroupId,
    calendarDailySchedules,
    calendarExclusions,
    initialDockData,
  };
}
