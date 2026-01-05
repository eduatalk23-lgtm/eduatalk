'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { logActionError } from '@/lib/logging/actionLogger';
import type { AdminPlanResponse } from '../types';
import { createPlanEvent } from './planEvent';

export interface MoveToGroupInput {
  planIds: string[];
  targetGroupId: string | null; // null이면 그룹에서 제거
  studentId: string;
}

export interface MoveToGroupResult {
  movedCount: number;
}

export interface PlanGroupInfo {
  id: string;
  name: string;
  content_master_id: string | null;
  content_title: string | null;
  start_date: string | null;
  end_date: string | null;
  plan_count: number;
}

/**
 * 학생의 플랜 그룹 목록 조회
 */
export async function getStudentPlanGroups(
  studentId: string
): Promise<AdminPlanResponse<PlanGroupInfo[]>> {
  try {
    await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    // 플랜 그룹 조회
    const { data: groups, error: groupError } = await supabase
      .from('plan_groups')
      .select(`
        id,
        name,
        content_master_id,
        start_date,
        end_date
      `)
      .eq('student_id', studentId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (groupError) {
      return { success: false, error: groupError.message };
    }

    // 각 그룹의 플랜 수 조회
    const groupsWithCount: PlanGroupInfo[] = [];

    for (const group of groups ?? []) {
      const { count } = await supabase
        .from('student_plan')
        .select('id', { count: 'exact', head: true })
        .eq('plan_group_id', group.id)
        .eq('is_active', true);

      // content_master에서 제목 가져오기
      let contentTitle: string | null = null;
      if (group.content_master_id) {
        const { data: master } = await supabase
          .from('content_master')
          .select('title')
          .eq('id', group.content_master_id)
          .single();
        contentTitle = master?.title ?? null;
      }

      groupsWithCount.push({
        id: group.id,
        name: group.name,
        content_master_id: group.content_master_id,
        content_title: contentTitle,
        start_date: group.start_date,
        end_date: group.end_date,
        plan_count: count ?? 0,
      });
    }

    return { success: true, data: groupsWithCount };
  } catch (error) {
    logActionError({ domain: 'admin-plan', action: 'getStudentPlanGroups' }, error, { studentId });
    return {
      success: false,
      error: error instanceof Error ? error.message : '플랜 그룹 조회 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 플랜을 다른 그룹으로 이동 (관리자용)
 */
export async function movePlansToGroup(
  input: MoveToGroupInput
): Promise<AdminPlanResponse<MoveToGroupResult>> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    if (input.planIds.length === 0) {
      return { success: false, error: '이동할 플랜을 선택해주세요.' };
    }

    // 1. 기존 플랜들의 그룹 정보 조회
    const { data: existingPlans, error: fetchError } = await supabase
      .from('student_plan')
      .select('id, plan_group_id')
      .in('id', input.planIds);

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    // 2. 플랜 그룹 업데이트
    const { error: updateError } = await supabase
      .from('student_plan')
      .update({
        plan_group_id: input.targetGroupId,
        updated_at: new Date().toISOString(),
      })
      .in('id', input.planIds)
      .eq('student_id', input.studentId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // 3. 이벤트 로깅
    if (tenantId) {
      const previousGroupIds = [...new Set(existingPlans?.map((p) => p.plan_group_id) ?? [])];

      await createPlanEvent({
        tenant_id: tenantId,
        student_id: input.studentId,
        plan_group_id: input.targetGroupId,
        event_type: 'plan_updated',
        event_category: 'plan_item',
        actor_type: 'admin',
        actor_id: userId,
        payload: {
          action: 'move_to_group',
          plan_ids: input.planIds,
          previous_group_ids: previousGroupIds,
          target_group_id: input.targetGroupId,
          moved_count: input.planIds.length,
        },
      });
    }

    // 4. 경로 재검증
    revalidatePath(`/admin/students/${input.studentId}/plans`);
    revalidatePath('/today');
    revalidatePath('/plan');

    return {
      success: true,
      data: {
        movedCount: input.planIds.length,
      },
    };
  } catch (error) {
    logActionError({ domain: 'admin-plan', action: 'movePlansToGroup' }, error, {
      planIds: input.planIds,
      targetGroupId: input.targetGroupId,
      studentId: input.studentId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '플랜 이동 중 오류가 발생했습니다.',
    };
  }
}
