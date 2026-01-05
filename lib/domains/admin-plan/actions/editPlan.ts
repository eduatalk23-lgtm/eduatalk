'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { logActionError } from '@/lib/logging/actionLogger';
import type { AdminPlanResponse, PlanStatus, ContainerType } from '../types';
import { createPlanEvent } from './planEvent';

/**
 * 플랜 수정 가능한 필드들
 */
export interface StudentPlanUpdateInput {
  custom_title?: string;
  plan_date?: string;
  start_time?: string | null;
  end_time?: string | null;
  planned_start_page_or_time?: number | null;
  planned_end_page_or_time?: number | null;
  estimated_minutes?: number | null;
  status?: PlanStatus;
  container_type?: ContainerType;
}

/**
 * 플랜 조회 결과 타입
 */
export interface StudentPlanDetail {
  id: string;
  student_id: string;
  plan_group_id: string | null;
  content_title: string | null;
  content_subject: string | null;
  custom_title: string | null;
  plan_date: string;
  start_time: string | null;
  end_time: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  estimated_minutes: number | null;
  status: string;
  container_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 단일 플랜 조회 (관리자용)
 */
export async function getStudentPlanForEdit(
  planId: string,
  studentId: string
): Promise<AdminPlanResponse<StudentPlanDetail>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('student_plan')
      .select(`
        id,
        student_id,
        plan_group_id,
        content_title,
        content_subject,
        custom_title,
        plan_date,
        start_time,
        end_time,
        planned_start_page_or_time,
        planned_end_page_or_time,
        estimated_minutes,
        status,
        container_type,
        is_active,
        created_at,
        updated_at
      `)
      .eq('id', planId)
      .eq('student_id', studentId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: '플랜을 찾을 수 없습니다.' };
    }

    return { success: true, data: data as StudentPlanDetail };
  } catch (error) {
    logActionError({ domain: 'admin-plan', action: 'getStudentPlanForEdit' }, error, { planId, studentId });
    return {
      success: false,
      error: error instanceof Error ? error.message : '플랜 조회 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 플랜 수정 (관리자용)
 * - 관리자 인증 필요
 * - 이벤트 로깅 포함
 * - 경로 재검증 자동 처리
 */
export async function adminUpdateStudentPlan(
  planId: string,
  studentId: string,
  updates: StudentPlanUpdateInput
): Promise<AdminPlanResponse<StudentPlanDetail>> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    // 1. 기존 플랜 조회
    const { data: existingPlan, error: fetchError } = await supabase
      .from('student_plan')
      .select('*')
      .eq('id', planId)
      .eq('student_id', studentId)
      .single();

    if (fetchError || !existingPlan) {
      return { success: false, error: '플랜을 찾을 수 없습니다.' };
    }

    // 2. 업데이트 데이터 준비
    const updateData: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // 3. 플랜 업데이트
    const { data: updatedPlan, error: updateError } = await supabase
      .from('student_plan')
      .update(updateData)
      .eq('id', planId)
      .select(`
        id,
        student_id,
        plan_group_id,
        content_title,
        content_subject,
        custom_title,
        plan_date,
        start_time,
        end_time,
        planned_start_page_or_time,
        planned_end_page_or_time,
        estimated_minutes,
        status,
        container_type,
        is_active,
        created_at,
        updated_at
      `)
      .single();

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // 4. 이벤트 로깅
    if (!tenantId) {
      return { success: false, error: 'Tenant ID를 확인할 수 없습니다.' };
    }
    const eventResult = await createPlanEvent({
      tenant_id: tenantId,
      student_id: studentId,
      student_plan_id: planId,
      plan_group_id: existingPlan.plan_group_id,
      event_type: 'plan_updated',
      event_category: 'plan_item',
      actor_type: 'admin',
      actor_id: userId,
      payload: {
        previous: {
          custom_title: existingPlan.custom_title,
          plan_date: existingPlan.plan_date,
          start_time: existingPlan.start_time,
          end_time: existingPlan.end_time,
          planned_start_page_or_time: existingPlan.planned_start_page_or_time,
          planned_end_page_or_time: existingPlan.planned_end_page_or_time,
          status: existingPlan.status,
          container_type: existingPlan.container_type,
        },
        updated: updates,
      },
    });

    // 5. 경로 재검증
    revalidatePath(`/admin/students/${studentId}/plans`);
    revalidatePath('/today');
    revalidatePath('/plan');

    return {
      success: true,
      data: updatedPlan as StudentPlanDetail,
      event_id: eventResult.data?.id,
    };
  } catch (error) {
    logActionError({ domain: 'admin-plan', action: 'adminUpdateStudentPlan' }, error, {
      planId,
      studentId,
      updates,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '플랜 수정 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 일괄 플랜 수정 (관리자용)
 */
export async function adminBulkUpdatePlans(
  planIds: string[],
  studentId: string,
  updates: Partial<StudentPlanUpdateInput>
): Promise<AdminPlanResponse<{ updatedCount: number }>> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    if (planIds.length === 0) {
      return { success: false, error: '수정할 플랜을 선택해주세요.' };
    }

    // 업데이트 데이터 준비
    const updateData: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // 일괄 업데이트
    const { error } = await supabase
      .from('student_plan')
      .update(updateData)
      .in('id', planIds)
      .eq('student_id', studentId);

    if (error) {
      return { success: false, error: error.message };
    }

    // 이벤트 로깅 (일괄)
    if (tenantId) {
      await createPlanEvent({
        tenant_id: tenantId,
        student_id: studentId,
        event_type: 'plan_updated',
        event_category: 'plan_item',
        actor_type: 'admin',
        actor_id: userId,
        payload: {
          bulk_update: true,
          plan_ids: planIds,
          updates,
          count: planIds.length,
        },
      });
    }

    // 경로 재검증
    revalidatePath(`/admin/students/${studentId}/plans`);
    revalidatePath('/today');
    revalidatePath('/plan');

    return {
      success: true,
      data: { updatedCount: planIds.length },
    };
  } catch (error) {
    logActionError({ domain: 'admin-plan', action: 'adminBulkUpdatePlans' }, error, {
      planIds,
      studentId,
      updates,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '일괄 수정 중 오류가 발생했습니다.',
    };
  }
}
