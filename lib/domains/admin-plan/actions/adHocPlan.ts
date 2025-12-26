'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import type {
  AdHocPlan,
  AdHocPlanInsert,
  AdHocPlanUpdate,
  AdHocPlanFilters,
  AdminPlanResponse,
  PaginatedResponse,
  SortOption,
  PlanStatus,
} from '../types';
import { createPlanEvent } from './planEvent';

/**
 * 단발성 플랜 목록 조회
 */
export async function getAdHocPlans(
  filters?: AdHocPlanFilters,
  sort?: SortOption,
  page = 1,
  pageSize = 20
): Promise<AdminPlanResponse<PaginatedResponse<AdHocPlan>>> {
  try {
    // 인증 및 tenant 검증
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from('ad_hoc_plans')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId); // tenant 격리

    // 필터 적용
    if (filters?.student_id) {
      query = query.eq('student_id', filters.student_id);
    }
    if (filters?.plan_date_from) {
      query = query.gte('plan_date', filters.plan_date_from);
    }
    if (filters?.plan_date_to) {
      query = query.lte('plan_date', filters.plan_date_to);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.container_type) {
      query = query.eq('container_type', filters.container_type);
    }

    // 정렬 적용
    const sortField = sort?.field ?? 'plan_date';
    const sortDirection = sort?.direction === 'asc';
    query = query.order(sortField, { ascending: sortDirection });

    // 페이지네이션 적용
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        data: data as AdHocPlan[],
        total: count ?? 0,
        page,
        page_size: pageSize,
        has_more: count ? from + pageSize < count : false,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 단발성 플랜 단일 조회
 */
export async function getAdHocPlan(
  id: string
): Promise<AdminPlanResponse<AdHocPlan>> {
  try {
    // 인증 및 tenant 검증
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('ad_hoc_plans')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId) // tenant 격리
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as AdHocPlan };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 학생별 오늘의 단발성 플랜 조회
 */
export async function getTodayAdHocPlans(
  studentId: string
): Promise<AdminPlanResponse<AdHocPlan[]>> {
  try {
    // 인증 및 tenant 검증
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('ad_hoc_plans')
      .select('*')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId) // tenant 격리
      .eq('plan_date', today)
      .order('created_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as AdHocPlan[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 단발성 플랜 생성
 */
export async function createAdHocPlan(
  input: AdHocPlanInsert,
  actorId?: string,
  actorType: 'admin' | 'student' = 'admin'
): Promise<AdminPlanResponse<AdHocPlan>> {
  try {
    // 인증 검증 (tenant_id는 input에서 제공)
    const { userId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();
    const resolvedActorId = actorId ?? userId;

    const { data, error } = await supabase
      .from('ad_hoc_plans')
      .insert(input)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const adHocPlan = data as AdHocPlan;

    // 이벤트 로깅
    await createPlanEvent({
      tenant_id: input.tenant_id,
      student_id: input.student_id,
      ad_hoc_plan_id: adHocPlan.id,
      event_type: 'adhoc_created',
      event_category: 'adhoc',
      payload: { title: input.title, plan_date: input.plan_date },
      new_state: adHocPlan as unknown as Record<string, unknown>,
      actor_id: resolvedActorId,
      actor_type: actorType,
    });

    revalidatePath('/admin/plans');
    revalidatePath('/today');

    return { success: true, data: adHocPlan };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 단발성 플랜 수정
 */
export async function updateAdHocPlan(
  id: string,
  input: AdHocPlanUpdate,
  actorId?: string,
  actorType: 'admin' | 'student' = 'admin'
): Promise<AdminPlanResponse<AdHocPlan>> {
  try {
    // 인증 및 tenant 검증
    const { userId, tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();
    const resolvedActorId = actorId ?? userId;

    // 기존 상태 조회 (tenant 격리)
    const { data: previousData } = await supabase
      .from('ad_hoc_plans')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    const { data, error } = await supabase
      .from('ad_hoc_plans')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId) // tenant 격리
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const adHocPlan = data as AdHocPlan;

    // 이벤트 로깅
    if (previousData) {
      await createPlanEvent({
        tenant_id: adHocPlan.tenant_id,
        student_id: adHocPlan.student_id,
        ad_hoc_plan_id: adHocPlan.id,
        event_type: input.status === 'completed' ? 'adhoc_completed' : 'plan_updated',
        event_category: 'adhoc',
        payload: { changes: input },
        previous_state: previousData as unknown as Record<string, unknown>,
        new_state: adHocPlan as unknown as Record<string, unknown>,
        actor_id: resolvedActorId,
        actor_type: actorType,
      });
    }

    revalidatePath('/admin/plans');
    revalidatePath('/today');

    return { success: true, data: adHocPlan };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 단발성 플랜 상태 변경
 */
export async function updateAdHocPlanStatus(
  id: string,
  status: PlanStatus,
  actorId?: string,
  actorType: 'admin' | 'student' = 'student'
): Promise<AdminPlanResponse<AdHocPlan>> {
  const updateData: AdHocPlanUpdate = { status };

  if (status === 'in_progress') {
    updateData.started_at = new Date().toISOString();
  } else if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
  }

  return updateAdHocPlan(id, updateData, actorId, actorType);
}

/**
 * 단발성 플랜 삭제
 */
export async function deleteAdHocPlan(
  id: string,
  actorId?: string
): Promise<AdminPlanResponse<void>> {
  try {
    // 인증 및 tenant 검증
    const { userId, tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();
    const resolvedActorId = actorId ?? userId;

    // 삭제 전 데이터 조회 (이벤트 로깅용, tenant 격리)
    const { data: previousData } = await supabase
      .from('ad_hoc_plans')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    const { error } = await supabase
      .from('ad_hoc_plans')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId); // tenant 격리

    if (error) {
      return { success: false, error: error.message };
    }

    // 이벤트 로깅
    if (previousData) {
      await createPlanEvent({
        tenant_id: previousData.tenant_id,
        student_id: previousData.student_id,
        ad_hoc_plan_id: id,
        event_type: 'adhoc_cancelled',
        event_category: 'adhoc',
        payload: { reason: 'deleted' },
        previous_state: previousData as unknown as Record<string, unknown>,
        actor_id: resolvedActorId,
        actor_type: 'admin',
      });
    }

    revalidatePath('/admin/plans');
    revalidatePath('/today');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 단발성 플랜 컨테이너 이동
 */
export async function moveAdHocPlanToContainer(
  id: string,
  targetContainer: 'daily' | 'weekly' | 'unfinished',
  targetDate?: string,
  actorId?: string
): Promise<AdminPlanResponse<AdHocPlan>> {
  const updateData: AdHocPlanUpdate = {
    container_type: targetContainer,
  };

  if (targetDate) {
    updateData.plan_date = targetDate;
  }

  return updateAdHocPlan(id, updateData, actorId, 'admin');
}

/**
 * 미완료 단발성 플랜을 다음 날로 이월
 */
export async function carryoverAdHocPlans(
  studentId: string,
  fromDate: string,
  toDate: string
): Promise<AdminPlanResponse<number>> {
  try {
    // 인증 및 tenant 검증
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('ad_hoc_plans')
      .update({
        plan_date: toDate,
        container_type: 'unfinished',
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId) // tenant 격리
      .eq('plan_date', fromDate)
      .in('status', ['pending', 'in_progress'])
      .select();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/plans');
    revalidatePath('/today');

    return { success: true, data: data?.length ?? 0 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
