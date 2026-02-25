'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateScheduleForCalendar } from '@/lib/domains/admin-plan/actions/planCreation/scheduleGenerator';
import { getCalendarSettingsAction } from '@/lib/domains/calendar/actions/calendars';
import type { DailyScheduleInfo } from '@/lib/types/plan';

export interface CalendarScheduleData {
  dailySchedules: DailyScheduleInfo[][];
  calculatedSchedule?: DailyScheduleInfo[];
  exclusions: Array<{
    exclusionDate: string;
    exclusionType: string;
    reason?: string | null;
  }>;
}

/**
 * 캘린더 기반 스케줄 데이터 조회 (Server Action)
 */
export async function fetchCalendarScheduleAction(
  calendarId: string,
  studentId: string
): Promise<CalendarScheduleData> {
  const supabase = await createSupabaseServerClient();

  const [calendarSettings, planGroupsResult] = await Promise.all([
    getCalendarSettingsAction(calendarId, true).catch(() => null),
    supabase
      .from('plan_groups')
      .select('id, daily_schedule')
      .eq('calendar_id', calendarId)
      .eq('student_id', studentId)
      .is('deleted_at', null),
  ]);

  const dailySchedules: DailyScheduleInfo[][] = (planGroupsResult.data ?? [])
    .map((g) => g.daily_schedule as DailyScheduleInfo[] | null)
    .filter((s): s is DailyScheduleInfo[] => Array.isArray(s) && s.length > 0);

  let calculatedSchedule: DailyScheduleInfo[] | undefined;
  if (calendarSettings?.periodStart && calendarSettings?.periodEnd) {
    try {
      const scheduleResult = await generateScheduleForCalendar(
        calendarId,
        calendarSettings.periodStart,
        calendarSettings.periodEnd
      );
      if (scheduleResult.success) {
        calculatedSchedule = scheduleResult.dailySchedule.map((d) => ({
          date: d.date,
          day_type: d.day_type as DailyScheduleInfo['day_type'],
          study_hours: 0,
          week_number: d.week_number ?? undefined,
          cycle_day_number: d.cycle_day_number ?? undefined,
        }));
      }
    } catch {
      // fallback: plan_groups daily_schedule만 사용
    }
  }

  const exclusions = calendarSettings?.exclusions?.map((exc) => ({
    exclusionDate: exc.exclusion_date,
    exclusionType: exc.exclusion_type,
    reason: exc.reason,
  })) ?? [];

  return { dailySchedules, calculatedSchedule, exclusions };
}
