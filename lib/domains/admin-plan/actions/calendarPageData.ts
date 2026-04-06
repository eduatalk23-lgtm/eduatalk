"use server";

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getTodayInTimezone } from '@/lib/utils/dateUtils';
import { getCachedCalendarSettings } from '@/lib/cache/calendarCache';
import type { DailyScheduleInfo } from '@/lib/types/plan';
import type { TimeSlot } from '@/lib/types/plan-generation';
import type { CalendarSettings } from '@/lib/domains/admin-plan/types';

export interface PlanGroupSummaryData {
  id: string;
  name: string | null;
  status: string;
  periodStart: string;
  periodEnd: string;
  planPurpose: string | null;
  planType?: string | null;
  campTemplateId?: string | null;
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
}

/**
 * 관리자 캘린더 페이지에 필요한 모든 데이터를 조회합니다.
 *
 * Dock 데이터(학습 플랜, 비학습시간)는 SSR 프리페치하지 않음:
 * - DailyDock은 calendar_events를 React Query로 클라이언트에서 직접 조회
 * - 기존 student_plan 기반 SSR 프리페치는 데이터 소스 불일치로 사용되지 않았음
 * - 제거로 서버 DB 쿼리 2개 절감 → TTFB ~200-500ms 개선
 */
export async function fetchCalendarPageData(
  studentId: string,
  calendarId: string,
  dateOverride?: string,
): Promise<CalendarPageData> {
  const supabase = await createSupabaseServerClient();
  const targetDate = dateOverride ?? getTodayInTimezone();

  // settings + planGroups 병렬 조회 (dock 프리페치 제거)
  const [calendarSettings, { data: calendarGroups }] = await Promise.all([
    getCachedCalendarSettings(calendarId),
    supabase
      .from('plan_groups')
      .select('id, name, status, period_start, period_end, plan_purpose, plan_type, camp_template_id, daily_schedule, created_at')
      .eq('calendar_id', calendarId)
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const allPlanGroups: PlanGroupSummaryData[] = (calendarGroups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    status: g.status,
    periodStart: g.period_start ?? '',
    periodEnd: g.period_end ?? '',
    planPurpose: g.plan_purpose,
    planType: g.plan_type ?? null,
    campTemplateId: g.camp_template_id ?? null,
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
    calendarCalculatedSchedule: undefined,
    calendarDateTimeSlots: undefined,
    allPlanGroups,
    activePlanGroupId,
    calendarDailySchedules,
    calendarExclusions,
  };
}
