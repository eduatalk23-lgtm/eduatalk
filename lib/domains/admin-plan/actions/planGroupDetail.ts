'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { logActionError } from '@/lib/logging/actionLogger';

export interface PlanGroupDetail {
  id: string;
  name: string | null;
  status: string;
  planPurpose: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  updatedAt: string;
  // 통계
  totalCount: number;
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
  skippedCount: number;
  cancelledCount: number;
  // 콘텐츠별 통계
  bookCount: number;
  lectureCount: number;
  customCount: number;
}

/**
 * 플랜 그룹 상세 정보 조회 (관리자용)
 * - 플랜 그룹의 기본 정보, 상태별/콘텐츠별 통계를 반환
 */
export async function getPlanGroupDetailAction(
  planGroupId: string,
  tenantId: string
): Promise<PlanGroupDetail | null> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 1. 플랜 그룹 기본 정보 조회
    const { data: planGroup, error: groupError } = await supabase
      .from('plan_groups')
      .select('id, name, status, plan_purpose, period_start, period_end, created_at, updated_at')
      .eq('id', planGroupId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (groupError || !planGroup) {
      logActionError(
        { domain: 'admin-plan', action: 'getPlanGroupDetailAction' },
        groupError,
        { planGroupId, tenantId }
      );
      return null;
    }

    // 2. 해당 플랜 그룹의 플랜 정보 조회 (상태, 콘텐츠 유형)
    const { data: plans, error: plansError } = await supabase
      .from('student_plan')
      .select('status, content_type')
      .eq('plan_group_id', planGroupId)
      .eq('is_active', true);

    if (plansError) {
      logActionError(
        { domain: 'admin-plan', action: 'getPlanGroupDetailAction' },
        plansError,
        { planGroupId }
      );
      return null;
    }

    // 3. 통계 집계
    const stats = {
      totalCount: plans?.length ?? 0,
      completedCount: 0,
      inProgressCount: 0,
      pendingCount: 0,
      skippedCount: 0,
      cancelledCount: 0,
      bookCount: 0,
      lectureCount: 0,
      customCount: 0,
    };

    if (plans) {
      for (const plan of plans) {
        // 상태별 집계
        switch (plan.status) {
          case 'completed':
            stats.completedCount++;
            break;
          case 'in_progress':
            stats.inProgressCount++;
            break;
          case 'pending':
            stats.pendingCount++;
            break;
          case 'skipped':
            stats.skippedCount++;
            break;
          case 'cancelled':
            stats.cancelledCount++;
            break;
        }

        // 콘텐츠 유형별 집계
        switch (plan.content_type) {
          case 'book':
            stats.bookCount++;
            break;
          case 'lecture':
            stats.lectureCount++;
            break;
          case 'custom':
            stats.customCount++;
            break;
        }
      }
    }

    return {
      id: planGroup.id,
      name: planGroup.name,
      status: planGroup.status,
      planPurpose: planGroup.plan_purpose,
      periodStart: planGroup.period_start,
      periodEnd: planGroup.period_end,
      createdAt: planGroup.created_at,
      updatedAt: planGroup.updated_at,
      ...stats,
    };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'getPlanGroupDetailAction' },
      error,
      { planGroupId, tenantId }
    );
    return null;
  }
}
