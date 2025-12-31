'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logContainerMoved, logPlanDeleted } from './planEvent';
import { logActionError } from '@/lib/logging/actionLogger';
import type { AdminPlanResponse, ContainerType } from '../types';

/**
 * 플랜 제목 조회 헬퍼 함수
 */
async function getPlanTitle(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  planId: string,
  planType: 'plan' | 'adhoc'
): Promise<string> {
  if (planType === 'plan') {
    const { data } = await supabase
      .from('student_plan')
      .select('content_title, custom_title')
      .eq('id', planId)
      .single();

    return data?.custom_title ?? data?.content_title ?? '제목 없음';
  } else {
    const { data } = await supabase
      .from('ad_hoc_plans')
      .select('title')
      .eq('id', planId)
      .single();

    return data?.title ?? '제목 없음';
  }
}

/**
 * 플랜을 다른 컨테이너로 이동
 */
export async function movePlanToContainer(
  input: {
    planId: string;
    planType: 'plan' | 'adhoc';
    fromContainer: ContainerType;
    toContainer: ContainerType;
    studentId: string;
    tenantId: string;
    targetDate?: string; // Daily로 이동 시 날짜
  }
): Promise<AdminPlanResponse<{ success: boolean }>> {
  try {
    const supabase = await createSupabaseServerClient();

    // 플랜 정보 조회 (로깅용)
    const planTitle = await getPlanTitle(supabase, input.planId, input.planType);

    // 컨테이너 이동
    const tableName = input.planType === 'plan' ? 'student_plan' : 'ad_hoc_plans';
    const updateData: Record<string, unknown> = {
      container_type: input.toContainer,
      updated_at: new Date().toISOString(),
    };

    if (input.toContainer === 'daily' && input.targetDate) {
      updateData.plan_date = input.targetDate;
    }

    const { error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', input.planId);

    if (error) {
      return { success: false, error: error.message };
    }

    // 이벤트 로깅
    await logContainerMoved(
      input.tenantId,
      input.studentId,
      input.planId,
      {
        from_container: input.fromContainer,
        to_container: input.toContainer,
        plan_type: input.planType,
        plan_title: planTitle,
        plan_date: input.targetDate,
      }
    );

    return { success: true, data: { success: true } };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'movePlanToContainer' },
      error,
      { planId: input.planId, planType: input.planType, fromContainer: input.fromContainer, toContainer: input.toContainer }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 플랜 삭제 (이벤트 로깅 포함)
 */
export async function deletePlanWithLogging(
  input: {
    planId: string;
    planType: 'plan' | 'adhoc';
    studentId: string;
    tenantId: string;
    reason?: string;
  }
): Promise<AdminPlanResponse<{ success: boolean }>> {
  try {
    const supabase = await createSupabaseServerClient();

    // 플랜 정보 조회 (로깅용)
    const planTitle = await getPlanTitle(supabase, input.planId, input.planType);

    // 삭제 처리
    if (input.planType === 'adhoc') {
      const { error } = await supabase
        .from('ad_hoc_plans')
        .delete()
        .eq('id', input.planId);

      if (error) {
        return { success: false, error: error.message };
      }
    } else {
      const { error } = await supabase
        .from('student_plan')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.planId);

      if (error) {
        return { success: false, error: error.message };
      }
    }

    // 이벤트 로깅
    await logPlanDeleted(
      input.tenantId,
      input.studentId,
      input.planId,
      {
        plan_type: input.planType,
        plan_title: planTitle,
        reason: input.reason,
      }
    );

    return { success: true, data: { success: true } };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'deletePlanWithLogging' },
      error,
      { planId: input.planId, planType: input.planType }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
