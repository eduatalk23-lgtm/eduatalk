'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { logActionError } from '@/lib/logging/actionLogger';
import type { PlanStatus } from '@/lib/types/plan';

export interface UpdatePlanGroupInput {
  name?: string | null;
  status?: PlanStatus;
  planPurpose?: string | null;
  periodStart?: string;
  periodEnd?: string;
}

export interface UpdatePlanGroupResult {
  success: boolean;
  error?: string;
}

// 유효한 상태값
const VALID_STATUSES: PlanStatus[] = ['draft', 'saved', 'active', 'paused', 'completed', 'cancelled'];

/**
 * 플랜 그룹 메타데이터 업데이트 (관리자용)
 * - 이름, 상태, 목적, 기간 변경 가능
 */
export async function updatePlanGroupAction(
  planGroupId: string,
  tenantId: string,
  input: UpdatePlanGroupInput
): Promise<UpdatePlanGroupResult> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 1. 기존 플랜 그룹 확인
    const { data: existingGroup, error: fetchError } = await supabase
      .from('plan_groups')
      .select('id, student_id, status, name')
      .eq('id', planGroupId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingGroup) {
      return {
        success: false,
        error: '플랜 그룹을 찾을 수 없습니다.',
      };
    }

    // 2. 업데이트할 필드 구성
    const updates: Record<string, unknown> = {};

    if (input.name !== undefined) {
      updates.name = input.name;
    }

    if (input.planPurpose !== undefined) {
      updates.plan_purpose = input.planPurpose;
    }

    if (input.periodStart !== undefined) {
      updates.period_start = input.periodStart;
    }

    if (input.periodEnd !== undefined) {
      updates.period_end = input.periodEnd;
    }

    // 3. 상태 변경 처리
    if (input.status !== undefined) {
      // 유효한 상태값인지 확인
      if (!VALID_STATUSES.includes(input.status)) {
        return {
          success: false,
          error: `유효하지 않은 상태입니다: ${input.status}`,
        };
      }

      // 활성화로 변경 시 기존 활성 그룹 비활성화
      if (input.status === 'active' && existingGroup.status !== 'active') {
        const { error: deactivateError } = await supabase
          .from('plan_groups')
          .update({ status: 'paused' })
          .eq('student_id', existingGroup.student_id)
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .neq('id', planGroupId)
          .is('deleted_at', null);

        if (deactivateError) {
          logActionError(
            { domain: 'admin-plan', action: 'updatePlanGroupAction' },
            deactivateError,
            { planGroupId, operation: 'deactivateOtherGroups' }
          );
          // 경고만 기록하고 계속 진행
        }
      }

      updates.status = input.status;
    }

    // 4. 업데이트할 내용이 없으면 종료
    if (Object.keys(updates).length === 0) {
      return { success: true };
    }

    // 5. 업데이트 실행
    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('plan_groups')
      .update(updates)
      .eq('id', planGroupId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      logActionError(
        { domain: 'admin-plan', action: 'updatePlanGroupAction' },
        updateError,
        { planGroupId, updates }
      );
      return {
        success: false,
        error: '플랜 그룹 업데이트에 실패했습니다.',
      };
    }

    // 6. 캐시 무효화
    revalidatePath(`/admin/students`);

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'updatePlanGroupAction' },
      error,
      { planGroupId, tenantId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
    };
  }
}
