'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { logActionError } from '@/lib/logging/actionLogger';

export interface PlanGroupSummary {
  id: string;
  name: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  totalCount: number;
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
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

    // 1. 플랜 그룹 기본 정보 조회
    const { data: planGroup, error: groupError } = await supabase
      .from('plan_groups')
      .select('id, name, period_start, period_end')
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
