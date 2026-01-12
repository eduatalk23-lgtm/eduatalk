'use server';

/**
 * 플랜 그룹 단위 작업 (관리자용)
 * - 삭제 (soft delete with backup)
 * - 복사
 * - 빠른 활성화
 */

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { logActionError, logActionDebug } from '@/lib/logging/actionLogger';
import { createPlanEvent } from './planEvent';
import type { AdminPlanResponse } from '../types';

// =============================================
// 타입 정의
// =============================================

export interface DeletePlanGroupResult {
  deletedGroupId: string;
  backupId: string;
  deletedPlansCount: number;
}

export interface CopyPlanGroupResult {
  newGroupId: string;
  copiedPlansCount: number;
}

export interface ActivatePlanGroupResult {
  activatedGroupId: string;
  deactivatedGroupIds: string[];
}

// =============================================
// 플랜 그룹 삭제 (관리자용)
// =============================================

/**
 * 플랜 그룹 삭제 (관리자용)
 * - Soft delete (deleted_at 설정)
 * - 백업 데이터 저장
 * - 관련 플랜도 함께 삭제
 */
export async function deletePlanGroupAdmin(
  planGroupId: string,
  studentId: string
): Promise<AdminPlanResponse<DeletePlanGroupResult>> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    // 1. 플랜 그룹 조회
    const { data: planGroup, error: fetchError } = await supabase
      .from('plan_groups')
      .select('*')
      .eq('id', planGroupId)
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !planGroup) {
      return {
        success: false,
        error: '플랜 그룹을 찾을 수 없습니다.',
      };
    }

    // 2. 캠프 플랜 삭제 불가 체크
    if (planGroup.plan_type === 'camp' && planGroup.camp_invitation_id) {
      return {
        success: false,
        error: '캠프 프로그램 플랜은 삭제할 수 없습니다.',
      };
    }

    // 3. 관련 플랜 조회
    const { data: plans } = await supabase
      .from('student_plan')
      .select('*')
      .eq('plan_group_id', planGroupId)
      .eq('is_active', true);

    // 4. 관련 콘텐츠 조회
    const { data: contents } = await supabase
      .from('plan_contents')
      .select('*')
      .eq('plan_group_id', planGroupId);

    // 5. 백업 데이터 구성
    const backupData = {
      plan_group: {
        id: planGroup.id,
        name: planGroup.name,
        plan_purpose: planGroup.plan_purpose,
        scheduler_type: planGroup.scheduler_type,
        scheduler_options: planGroup.scheduler_options,
        period_start: planGroup.period_start,
        period_end: planGroup.period_end,
        target_date: planGroup.target_date,
        block_set_id: planGroup.block_set_id,
        status: planGroup.status,
        planner_id: planGroup.planner_id,
        created_at: planGroup.created_at,
        updated_at: planGroup.updated_at,
      },
      contents: contents || [],
      plans: plans || [],
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    };

    // 6. 백업 저장
    const { data: backup, error: backupError } = await supabase
      .from('plan_group_backups')
      .insert({
        plan_group_id: planGroupId,
        student_id: studentId,
        tenant_id: tenantId,
        backup_data: backupData,
        deleted_by: userId,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (backupError) {
      logActionError(
        { domain: 'admin-plan', action: 'deletePlanGroupAdmin' },
        backupError,
        { planGroupId, step: 'backup' }
      );
      return {
        success: false,
        error: '백업 저장에 실패했습니다.',
      };
    }

    // 7. 플랜 삭제 (hard delete)
    const deletedPlansCount = plans?.length ?? 0;
    if (deletedPlansCount > 0) {
      const { error: deletePlansError } = await supabase
        .from('student_plan')
        .delete()
        .eq('plan_group_id', planGroupId);

      if (deletePlansError) {
        logActionError(
          { domain: 'admin-plan', action: 'deletePlanGroupAdmin' },
          deletePlansError,
          { planGroupId, step: 'deletePlans' }
        );
      }
    }

    // 8. 플랜 그룹 soft delete
    const { error: deleteError } = await supabase
      .from('plan_groups')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', planGroupId);

    if (deleteError) {
      logActionError(
        { domain: 'admin-plan', action: 'deletePlanGroupAdmin' },
        deleteError,
        { planGroupId, step: 'softDelete' }
      );
      return {
        success: false,
        error: '플랜 그룹 삭제에 실패했습니다.',
      };
    }

    // 9. 이벤트 로깅
    if (tenantId) {
      await createPlanEvent({
        tenant_id: tenantId,
        student_id: studentId,
        event_type: 'plan_group_deleted',
        event_category: 'plan_group',
        actor_type: 'admin',
        actor_id: userId,
        payload: {
          action: 'delete',
          group_id: planGroupId,
          group_name: planGroup.name,
          backup_id: backup.id,
          deleted_plans_count: deletedPlansCount,
        },
      });
    }

    // 10. 경로 재검증
    revalidatePath(`/admin/students/${studentId}/plans`);
    revalidatePath('/today');
    revalidatePath('/plan');

    return {
      success: true,
      data: {
        deletedGroupId: planGroupId,
        backupId: backup.id,
        deletedPlansCount,
      },
    };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'deletePlanGroupAdmin' },
      error,
      { planGroupId, studentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : '플랜 그룹 삭제 중 오류가 발생했습니다.',
    };
  }
}

// =============================================
// 플랜 그룹 복사 (관리자용)
// =============================================

/**
 * 플랜 그룹 복사 (관리자용)
 * - 플랜 그룹 메타데이터 복사
 * - 관련 plan_contents 복사
 * - 관련 플랜은 복사하지 않음 (새로 생성 필요)
 */
export async function copyPlanGroupAdmin(
  planGroupId: string,
  studentId: string,
  options?: {
    newName?: string;
    newPeriodStart?: string;
    newPeriodEnd?: string;
  }
): Promise<AdminPlanResponse<CopyPlanGroupResult>> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    // 1. 원본 플랜 그룹 조회
    const { data: sourceGroup, error: fetchError } = await supabase
      .from('plan_groups')
      .select('*')
      .eq('id', planGroupId)
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !sourceGroup) {
      return {
        success: false,
        error: '원본 플랜 그룹을 찾을 수 없습니다.',
      };
    }

    // 2. 새 플랜 그룹 생성
    const now = new Date().toISOString();
    const newGroupName = options?.newName || `${sourceGroup.name || '플랜 그룹'} (복사본)`;

    const { data: newGroup, error: createError } = await supabase
      .from('plan_groups')
      .insert({
        tenant_id: tenantId,
        student_id: studentId,
        planner_id: sourceGroup.planner_id,
        name: newGroupName,
        plan_purpose: sourceGroup.plan_purpose,
        scheduler_type: sourceGroup.scheduler_type,
        scheduler_options: sourceGroup.scheduler_options,
        period_start: options?.newPeriodStart || sourceGroup.period_start,
        period_end: options?.newPeriodEnd || sourceGroup.period_end,
        target_date: sourceGroup.target_date,
        block_set_id: sourceGroup.block_set_id,
        status: 'draft', // 복사본은 항상 draft 상태로 시작
        daily_schedule: sourceGroup.daily_schedule,
        subject_constraints: sourceGroup.subject_constraints,
        additional_period_reallocation: sourceGroup.additional_period_reallocation,
        non_study_time_blocks: sourceGroup.non_study_time_blocks,
        use_slot_mode: sourceGroup.use_slot_mode,
        content_slots: sourceGroup.content_slots,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (createError || !newGroup) {
      logActionError(
        { domain: 'admin-plan', action: 'copyPlanGroupAdmin' },
        createError,
        { planGroupId, step: 'createGroup' }
      );
      return {
        success: false,
        error: '플랜 그룹 복사에 실패했습니다.',
      };
    }

    // 3. plan_contents 복사
    const { data: sourceContents } = await supabase
      .from('plan_contents')
      .select('*')
      .eq('plan_group_id', planGroupId);

    let copiedPlansCount = 0;

    if (sourceContents && sourceContents.length > 0) {
      const newContents = sourceContents.map((content) => ({
        plan_group_id: newGroup.id,
        tenant_id: tenantId,
        content_type: content.content_type,
        content_id: content.content_id,
        content_name: content.content_name,
        start_range: content.start_range,
        end_range: content.end_range,
        subject_name: content.subject_name,
        subject_category: content.subject_category,
        display_order: content.display_order,
        start_detail_id: content.start_detail_id,
        end_detail_id: content.end_detail_id,
        master_content_id: content.master_content_id,
        priority: content.priority,
        is_paused: false,
        paused_until: null,
        scheduler_mode: content.scheduler_mode,
        individual_schedule: content.individual_schedule,
        custom_study_days: content.custom_study_days,
        content_scheduler_options: content.content_scheduler_options,
        is_auto_recommended: false,
        recommendation_source: null,
        recommendation_reason: null,
        recommendation_metadata: null,
        recommended_by: null,
        recommended_at: null,
        generation_status: null,
        created_at: now,
        updated_at: now,
      }));

      const { error: contentError } = await supabase
        .from('plan_contents')
        .insert(newContents);

      if (contentError) {
        logActionError(
          { domain: 'admin-plan', action: 'copyPlanGroupAdmin' },
          contentError,
          { planGroupId, newGroupId: newGroup.id, step: 'copyContents' }
        );
        // 콘텐츠 복사 실패해도 그룹 자체는 생성되었으므로 계속 진행
      } else {
        copiedPlansCount = newContents.length;
      }
    }

    // 4. 이벤트 로깅
    if (tenantId) {
      await createPlanEvent({
        tenant_id: tenantId,
        student_id: studentId,
        event_type: 'plan_group_created',
        event_category: 'plan_group',
        actor_type: 'admin',
        actor_id: userId,
        payload: {
          action: 'copy',
          source_group_id: planGroupId,
          new_group_id: newGroup.id,
          new_group_name: newGroupName,
          copied_contents_count: copiedPlansCount,
        },
      });
    }

    logActionDebug(
      { domain: 'admin-plan', action: 'copyPlanGroupAdmin' },
      '플랜 그룹 복사 완료',
      {
        sourceGroupId: planGroupId,
        newGroupId: newGroup.id,
        copiedContentsCount: copiedPlansCount,
      }
    );

    // 5. 경로 재검증
    revalidatePath(`/admin/students/${studentId}/plans`);

    return {
      success: true,
      data: {
        newGroupId: newGroup.id,
        copiedPlansCount,
      },
    };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'copyPlanGroupAdmin' },
      error,
      { planGroupId, studentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : '플랜 그룹 복사 중 오류가 발생했습니다.',
    };
  }
}

// =============================================
// 플랜 그룹 빠른 활성화 (관리자용)
// =============================================

/**
 * 플랜 그룹 빠른 활성화 (관리자용)
 * - 선택한 그룹을 활성화
 * - 기존 활성 그룹은 일시정지로 변경
 */
export async function activatePlanGroupAdmin(
  planGroupId: string,
  studentId: string
): Promise<AdminPlanResponse<ActivatePlanGroupResult>> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    // 1. 대상 플랜 그룹 확인
    const { data: targetGroup, error: fetchError } = await supabase
      .from('plan_groups')
      .select('id, name, status')
      .eq('id', planGroupId)
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !targetGroup) {
      return {
        success: false,
        error: '플랜 그룹을 찾을 수 없습니다.',
      };
    }

    // 이미 활성화된 경우
    if (targetGroup.status === 'active') {
      return {
        success: true,
        data: {
          activatedGroupId: planGroupId,
          deactivatedGroupIds: [],
        },
      };
    }

    // 2. 기존 활성 그룹들을 일시정지로 변경
    const { data: activeGroups, error: fetchActiveError } = await supabase
      .from('plan_groups')
      .select('id')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .neq('id', planGroupId)
      .is('deleted_at', null);

    const deactivatedGroupIds: string[] = [];

    if (!fetchActiveError && activeGroups && activeGroups.length > 0) {
      const activeGroupIds = activeGroups.map((g) => g.id);

      const { error: deactivateError } = await supabase
        .from('plan_groups')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .in('id', activeGroupIds);

      if (deactivateError) {
        logActionError(
          { domain: 'admin-plan', action: 'activatePlanGroupAdmin' },
          deactivateError,
          { planGroupId, step: 'deactivate' }
        );
      } else {
        deactivatedGroupIds.push(...activeGroupIds);
      }
    }

    // 3. 대상 그룹 활성화
    const { error: activateError } = await supabase
      .from('plan_groups')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', planGroupId);

    if (activateError) {
      logActionError(
        { domain: 'admin-plan', action: 'activatePlanGroupAdmin' },
        activateError,
        { planGroupId, step: 'activate' }
      );
      return {
        success: false,
        error: '플랜 그룹 활성화에 실패했습니다.',
      };
    }

    // 4. 이벤트 로깅
    if (tenantId) {
      await createPlanEvent({
        tenant_id: tenantId,
        student_id: studentId,
        event_type: 'plan_group_updated',
        event_category: 'plan_group',
        actor_type: 'admin',
        actor_id: userId,
        payload: {
          action: 'activate',
          group_id: planGroupId,
          group_name: targetGroup.name,
          deactivated_group_ids: deactivatedGroupIds,
        },
      });
    }

    // 5. 경로 재검증
    revalidatePath(`/admin/students/${studentId}/plans`);
    revalidatePath('/today');
    revalidatePath('/plan');

    return {
      success: true,
      data: {
        activatedGroupId: planGroupId,
        deactivatedGroupIds,
      },
    };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'activatePlanGroupAdmin' },
      error,
      { planGroupId, studentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : '플랜 그룹 활성화 중 오류가 발생했습니다.',
    };
  }
}
