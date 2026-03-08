"use server";

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prefetchAllDockData } from '@/lib/domains/admin-plan/actions/dockPrefetch';
import { getCalendarSettingsAction } from '@/lib/domains/calendar/actions/calendars';
import { generateScheduleForCalendar } from '@/lib/domains/admin-plan/actions/planCreation/scheduleGenerator';
import { getTodayInTimezone } from '@/lib/utils/dateUtils';
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
 * `/admin/students/[id]/plans/calendar/[calendarId]`와
 * `/admin/calendar?student=...` 양쪽에서 재사용합니다.
 */
export async function fetchCalendarPageData(
  studentId: string,
  calendarId: string,
  dateOverride?: string,
): Promise<CalendarPageData> {
  const supabase = await createSupabaseServerClient();
  const targetDate = dateOverride ?? getTodayInTimezone();

  // 캘린더 설정 조회 (exclusions 포함) — 스케줄 계산에 필요하므로 먼저 실행
  const calendarSettings = await getCalendarSettingsAction(calendarId, true);

  // 플랜 그룹 조회 + Dock 프리페치 + 스케줄 계산을 병렬 실행
  const planGroupsPromise = supabase
    .from('plan_groups')
    .select('id, name, status, period_start, period_end, plan_purpose, daily_schedule, created_at')
    .eq('calendar_id', calendarId)
    .eq('student_id', studentId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const dockPromise = prefetchAllDockData(studentId, targetDate, calendarId);

  const schedulePromise = (async () => {
    let calendarCalculatedSchedule: DailyScheduleInfo[] | undefined;
    let calendarDateTimeSlots: Record<string, TimeSlot[]> | undefined;
    if (calendarSettings?.periodStart && calendarSettings?.periodEnd) {
      const scheduleResult = await generateScheduleForCalendar(
        calendarId,
        calendarSettings.periodStart,
        calendarSettings.periodEnd,
      );
      if (scheduleResult.success) {
        calendarCalculatedSchedule = scheduleResult.dailySchedule.map((d) => ({
          date: d.date,
          day_type: d.day_type as DailyScheduleInfo['day_type'],
          study_hours: 0,
          week_number: d.week_number ?? undefined,
          cycle_day_number: d.cycle_day_number ?? undefined,
        }));
        calendarDateTimeSlots = Object.fromEntries(scheduleResult.dateTimeSlots);
      }
    }
    return { calendarCalculatedSchedule, calendarDateTimeSlots };
  })();

  const [{ data: calendarGroups }, initialDockData, scheduleData] = await Promise.all([
    planGroupsPromise,
    dockPromise,
    schedulePromise,
  ]);

  const { calendarCalculatedSchedule, calendarDateTimeSlots } = scheduleData;

  const allPlanGroups: PlanGroupSummaryData[] = (calendarGroups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    status: g.status,
    periodStart: g.period_start ?? '',
    periodEnd: g.period_end ?? '',
    planPurpose: g.plan_purpose,
  }));

  const activePlanGroupId = calendarGroups?.find((g) => g.status === 'active')?.id ?? null;

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
    calendarCalculatedSchedule,
    calendarDateTimeSlots,
    allPlanGroups,
    activePlanGroupId,
    calendarDailySchedules,
    calendarExclusions,
    initialDockData,
  };
}
