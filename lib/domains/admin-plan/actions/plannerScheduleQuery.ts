'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPlannerAction } from '@/lib/domains/admin-plan/actions/planners';
import { generateScheduleForPlanner } from '@/lib/domains/admin-plan/actions/planCreation/scheduleGenerator';
import type { DailyScheduleInfo } from '@/lib/types/plan';

export interface PlannerScheduleData {
  dailySchedules: DailyScheduleInfo[][];
  calculatedSchedule?: DailyScheduleInfo[];
  exclusions: Array<{
    exclusionDate: string;
    exclusionType: string;
    reason?: string | null;
  }>;
}

/**
 * 플래너 스케줄 데이터 조회 (Server Action)
 * - plan_groups.daily_schedule (플랜 그룹 기반)
 * - generateScheduleForPlanner (플래너 기간 기반 계산, fallback)
 * - 플래너 제외일
 */
export async function fetchPlannerScheduleAction(
  plannerId: string,
  studentId: string
): Promise<PlannerScheduleData> {
  const supabase = await createSupabaseServerClient();

  const [plannerDetail, planGroupsResult] = await Promise.all([
    getPlannerAction(plannerId, true).catch(() => null),
    supabase
      .from('plan_groups')
      .select('id, daily_schedule')
      .eq('planner_id', plannerId)
      .eq('student_id', studentId)
      .is('deleted_at', null),
  ]);

  // plan_groups.daily_schedule 추출
  const dailySchedules: DailyScheduleInfo[][] = (planGroupsResult.data ?? [])
    .map((g) => g.daily_schedule as DailyScheduleInfo[] | null)
    .filter((s): s is DailyScheduleInfo[] => Array.isArray(s) && s.length > 0);

  // 플래너 기간 기반 스케줄 계산 (fallback)
  let calculatedSchedule: DailyScheduleInfo[] | undefined;
  if (plannerDetail?.periodStart && plannerDetail?.periodEnd) {
    try {
      const scheduleResult = await generateScheduleForPlanner(
        plannerId,
        plannerDetail.periodStart,
        plannerDetail.periodEnd
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

  // 제외일
  const exclusions = plannerDetail?.exclusions?.map((exc) => ({
    exclusionDate: exc.exclusionDate,
    exclusionType: exc.exclusionType,
    reason: exc.reason,
  })) ?? [];

  return { dailySchedules, calculatedSchedule, exclusions };
}
