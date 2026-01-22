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
      .eq('is_active', true);

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

/**
 * 전체 플랜 그룹 통합 요약 (전체 보기용)
 */
export interface AllGroupsSummary {
  groupCount: number;
  totalCount: number;
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
  periodStart: string | null;
  periodEnd: string | null;
}

/**
 * 플래너의 전체 플랜 그룹 통합 요약 조회
 * - 전체 보기 모드에서 모든 그룹의 플랜 상태를 집계
 */
export async function getAllPlanGroupsSummaryAction(
  plannerId: string,
  tenantId: string
): Promise<AllGroupsSummary | null> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 1. 해당 플래너의 모든 플랜 그룹 조회
    const { data: planGroups, error: groupsError } = await supabase
      .from('plan_groups')
      .select('id, period_start, period_end')
      .eq('planner_id', plannerId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (groupsError) {
      logActionError(
        { domain: 'admin-plan', action: 'getAllPlanGroupsSummaryAction' },
        groupsError,
        { plannerId, tenantId }
      );
      return null;
    }

    if (!planGroups || planGroups.length === 0) {
      return {
        groupCount: 0,
        totalCount: 0,
        completedCount: 0,
        inProgressCount: 0,
        pendingCount: 0,
        periodStart: null,
        periodEnd: null,
      };
    }

    // 2. 전체 기간 계산 (가장 빠른 시작일 ~ 가장 늦은 종료일)
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    for (const group of planGroups) {
      if (group.period_start) {
        if (!periodStart || group.period_start < periodStart) {
          periodStart = group.period_start;
        }
      }
      if (group.period_end) {
        if (!periodEnd || group.period_end > periodEnd) {
          periodEnd = group.period_end;
        }
      }
    }

    // 3. 모든 그룹의 플랜 상태 집계
    const groupIds = planGroups.map(g => g.id);
    const { data: plans, error: plansError } = await supabase
      .from('student_plan')
      .select('status')
      .in('plan_group_id', groupIds)
      .eq('is_active', true);

    if (plansError) {
      logActionError(
        { domain: 'admin-plan', action: 'getAllPlanGroupsSummaryAction' },
        plansError,
        { plannerId, groupIds }
      );
      return null;
    }

    // 4. 상태별 집계
    let completedCount = 0;
    let inProgressCount = 0;
    let pendingCount = 0;

    if (plans) {
      for (const plan of plans) {
        switch (plan.status) {
          case 'completed':
            completedCount++;
            break;
          case 'in_progress':
            inProgressCount++;
            break;
          case 'pending':
            pendingCount++;
            break;
        }
      }
    }

    return {
      groupCount: planGroups.length,
      totalCount: plans?.length ?? 0,
      completedCount,
      inProgressCount,
      pendingCount,
      periodStart,
      periodEnd,
    };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'getAllPlanGroupsSummaryAction' },
      error,
      { plannerId, tenantId }
    );
    return null;
  }
}
