'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { logActionError } from '@/lib/logging/actionLogger';
import type { AdminPlanResponse } from '../types';
import { createPlanEvent } from './planEvent';

export interface DeletedPlanInfo {
  id: string;
  content_title: string | null;
  custom_title: string | null;
  content_subject: string | null;
  plan_date: string;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  updated_at: string;
  plan_group_name: string | null;
}

/**
 * 삭제된 플랜 목록 조회 (관리자용)
 */
export async function getDeletedPlans(
  studentId: string
): Promise<AdminPlanResponse<DeletedPlanInfo[]>> {
  try {
    await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('student_plan')
      .select(`
        id,
        content_title,
        custom_title,
        content_subject,
        plan_date,
        planned_start_page_or_time,
        planned_end_page_or_time,
        updated_at,
        plan_groups:plan_group_id (
          name
        )
      `)
      .eq('student_id', studentId)
      .eq('is_active', false)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      return { success: false, error: error.message };
    }

    const deletedPlans: DeletedPlanInfo[] = (data ?? []).map((plan) => {
      // Supabase foreign key join 결과 처리
      let planGroupName: string | null = null;
      const pg = plan.plan_groups;
      if (pg && typeof pg === 'object' && !Array.isArray(pg) && 'name' in pg) {
        planGroupName = (pg as { name: string }).name;
      }
      return {
        id: plan.id,
        content_title: plan.content_title,
        custom_title: plan.custom_title,
        content_subject: plan.content_subject,
        plan_date: plan.plan_date,
        planned_start_page_or_time: plan.planned_start_page_or_time,
        planned_end_page_or_time: plan.planned_end_page_or_time,
        updated_at: plan.updated_at,
        plan_group_name: planGroupName,
      };
    });

    return { success: true, data: deletedPlans };
  } catch (error) {
    logActionError({ domain: 'admin-plan', action: 'getDeletedPlans' }, error, { studentId });
    return {
      success: false,
      error: error instanceof Error ? error.message : '삭제된 플랜 조회 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 삭제된 플랜 복구 (관리자용)
 */
export async function restoreDeletedPlans(
  planIds: string[],
  studentId: string
): Promise<AdminPlanResponse<{ restoredCount: number }>> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    if (planIds.length === 0) {
      return { success: false, error: '복구할 플랜을 선택해주세요.' };
    }

    // 플랜 복구
    const { error } = await supabase
      .from('student_plan')
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .in('id', planIds)
      .eq('student_id', studentId);

    if (error) {
      return { success: false, error: error.message };
    }

    // 이벤트 로깅
    if (tenantId) {
      await createPlanEvent({
        tenant_id: tenantId,
        student_id: studentId,
        event_type: 'plan_updated',
        event_category: 'plan_item',
        actor_type: 'admin',
        actor_id: userId,
        payload: {
          action: 'restore',
          plan_ids: planIds,
          restored_count: planIds.length,
        },
      });
    }

    // 경로 재검증
    revalidatePath(`/admin/students/${studentId}/plans`);
    revalidatePath('/today');
    revalidatePath('/plan');

    return {
      success: true,
      data: { restoredCount: planIds.length },
    };
  } catch (error) {
    logActionError({ domain: 'admin-plan', action: 'restoreDeletedPlans' }, error, {
      planIds,
      studentId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '플랜 복구 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 삭제된 플랜 영구 삭제 (관리자용)
 */
export async function permanentlyDeletePlans(
  planIds: string[],
  studentId: string
): Promise<AdminPlanResponse<{ deletedCount: number }>> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    if (planIds.length === 0) {
      return { success: false, error: '삭제할 플랜을 선택해주세요.' };
    }

    // 삭제 전 플랜 정보 조회 (로깅용)
    const { data: plansToDelete } = await supabase
      .from('student_plan')
      .select('id, content_title, custom_title')
      .in('id', planIds);

    // 영구 삭제
    const { error } = await supabase
      .from('student_plan')
      .delete()
      .in('id', planIds)
      .eq('student_id', studentId)
      .eq('is_active', false); // 이미 삭제된 플랜만 영구 삭제 가능

    if (error) {
      return { success: false, error: error.message };
    }

    // 이벤트 로깅
    if (tenantId) {
      await createPlanEvent({
        tenant_id: tenantId,
        student_id: studentId,
        event_type: 'plan_deleted',
        event_category: 'plan_item',
        actor_type: 'admin',
        actor_id: userId,
        payload: {
          action: 'permanent_delete',
          plan_ids: planIds,
          deleted_count: planIds.length,
          deleted_plans: plansToDelete?.map((p) => ({
            id: p.id,
            title: p.custom_title ?? p.content_title,
          })),
        },
      });
    }

    // 경로 재검증
    revalidatePath(`/admin/students/${studentId}/plans`);

    return {
      success: true,
      data: { deletedCount: planIds.length },
    };
  } catch (error) {
    logActionError({ domain: 'admin-plan', action: 'permanentlyDeletePlans' }, error, {
      planIds,
      studentId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '영구 삭제 중 오류가 발생했습니다.',
    };
  }
}
