'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { logActionError } from '@/lib/logging/actionLogger';
import type { DailyScheduleInfo } from '@/lib/types/plan/domain';

export interface PlanGroupSummary {
  id: string;
  name: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  totalCount: number;
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
  // 1730 Timetable 주기 통계
  studyDays?: number;      // 학습일 수
  reviewDays?: number;     // 복습일 수
  totalWeeks?: number;     // 전체 주차 수
  exclusionDays?: number;  // 제외일 수
}

/**
 * 플랜 그룹 요약 정보 조회 (관리자용)
 * - 플랜 그룹의 기본 정보와 플랜 상태 집계를 반환
 */
export async function getPlanGroupSummaryAction(
  planGroupId: string,
  tenantId: string
): Promise<PlanGroupSummary | null> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 1. 플랜 그룹 기본 정보 조회 (daily_schedule 포함)
    const { data: planGroup, error: groupError } = await supabase
      .from('plan_groups')
      .select('id, name, period_start, period_end, daily_schedule')
      .eq('id', planGroupId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (groupError || !planGroup) {
      logActionError(
        { domain: 'admin-plan', action: 'getPlanGroupSummaryAction' },
        groupError,
        { planGroupId, tenantId }
      );
      return null;
    }

    // 1.5 daily_schedule에서 주기 통계 계산
    let cycleStats: {
      studyDays?: number;
      reviewDays?: number;
      totalWeeks?: number;
      exclusionDays?: number;
    } = {};

    if (planGroup.daily_schedule && Array.isArray(planGroup.daily_schedule)) {
      const dailySchedule = planGroup.daily_schedule as DailyScheduleInfo[];

      let studyDays = 0;
      let reviewDays = 0;
      let exclusionDays = 0;
      let maxWeekNumber = 0;

      for (const day of dailySchedule) {
        switch (day.day_type) {
          case '학습일':
            studyDays++;
            break;
          case '복습일':
            reviewDays++;
            break;
          case '지정휴일':
          case '휴가':
          case '개인일정':
            exclusionDays++;
            break;
        }
        // 최대 주차 번호 추적
        if (day.week_number && day.week_number > maxWeekNumber) {
          maxWeekNumber = day.week_number;
        }
      }

      cycleStats = {
        studyDays,
        reviewDays,
        exclusionDays,
        totalWeeks: maxWeekNumber > 0 ? maxWeekNumber : undefined,
      };
    }

    // 2. 해당 플랜 그룹의 플랜 상태별 개수 집계
    const { data: plans, error: plansError } = await supabase
      .from('student_plan')
      .select('status')
      .eq('plan_group_id', planGroupId)
      .is('deleted_at', null);

    if (plansError) {
      logActionError(
        { domain: 'admin-plan', action: 'getPlanGroupSummaryAction' },
        plansError,
        { planGroupId }
      );
      return null;
    }

    // 3. 상태별 집계
    const statusCounts = {
      totalCount: plans?.length ?? 0,
      completedCount: 0,
      inProgressCount: 0,
      pendingCount: 0,
    };

    if (plans) {
      for (const plan of plans) {
        switch (plan.status) {
          case 'completed':
            statusCounts.completedCount++;
            break;
          case 'in_progress':
            statusCounts.inProgressCount++;
            break;
          case 'pending':
            statusCounts.pendingCount++;
            break;
        }
      }
    }

    return {
      id: planGroup.id,
      name: planGroup.name,
      periodStart: planGroup.period_start,
      periodEnd: planGroup.period_end,
      ...statusCounts,
      ...cycleStats,
    };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'getPlanGroupSummaryAction' },
      error,
      { planGroupId, tenantId }
    );
    return null;
  }
}
