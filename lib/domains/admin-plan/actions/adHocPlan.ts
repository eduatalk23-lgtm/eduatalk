'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
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
import { checkFlexibleContentExists } from '@/lib/domains/plan/utils/contentValidation';

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

    // FK 검증: flexible_content_id가 있는 경우 콘텐츠 존재 여부 확인
    if (input.flexible_content_id) {
      const contentCheck = await checkFlexibleContentExists(
        input.flexible_content_id,
        (input.content_type as 'book' | 'lecture' | 'custom') ?? null,
        input.student_id
      );
      if (!contentCheck.exists) {
        return {
          success: false,
          error: `콘텐츠를 찾을 수 없습니다. (ID: ${input.flexible_content_id.substring(0, 8)}...)`,
        };
      }
    }

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

    if (!previousData) {
      return { success: false, error: '플랜을 찾을 수 없습니다.' };
    }

    // FK 검증: flexible_content_id가 업데이트되는 경우 콘텐츠 존재 여부 확인
    if (input.flexible_content_id !== undefined && input.flexible_content_id !== null) {
      const contentType = (input.content_type ?? previousData.content_type) as 'book' | 'lecture' | 'custom' | null;
      const contentCheck = await checkFlexibleContentExists(
        input.flexible_content_id,
        contentType,
        previousData.student_id
      );
      if (!contentCheck.exists) {
        return {
          success: false,
          error: `콘텐츠를 찾을 수 없습니다. (ID: ${input.flexible_content_id.substring(0, 8)}...)`,
        };
      }
    }

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

// ============================================
// Enhanced Ad-hoc Plan Functions (Phase 3)
// ============================================

/**
 * 향상된 Ad-hoc 플랜 생성 (콘텐츠 연결, 반복 지원)
 */
export interface EnhancedAdHocPlanInput {
  studentId: string;
  tenantId: string;
  title: string;
  description?: string;
  planDate: string;
  startTime?: string;
  endTime?: string;
  containerType?: 'daily' | 'weekly' | 'unfinished';
  estimatedMinutes?: number;

  // 콘텐츠 연결 (선택)
  contentType?: 'book' | 'lecture' | 'custom';
  flexibleContentId?: string;
  pageRange?: { start: number; end: number };

  // 반복 규칙 (선택)
  recurrence?: {
    type: 'daily' | 'weekly' | 'custom';
    interval?: number;
    daysOfWeek?: number[];
    endDate?: string;
    count?: number;
  };
}

export async function createEnhancedAdHocPlan(
  input: EnhancedAdHocPlanInput,
  actorId?: string,
  actorType: 'admin' | 'student' = 'admin'
): Promise<AdminPlanResponse<AdHocPlan>> {
  try {
    const { userId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();
    const resolvedActorId = actorId ?? userId;

    // FK 검증: flexibleContentId가 있는 경우 콘텐츠 존재 여부 확인
    if (input.flexibleContentId) {
      const contentCheck = await checkFlexibleContentExists(
        input.flexibleContentId,
        input.contentType ?? null,
        input.studentId
      );
      if (!contentCheck.exists) {
        return {
          success: false,
          error: `콘텐츠를 찾을 수 없습니다. (ID: ${input.flexibleContentId})`,
        };
      }
    }

    const insertData: AdHocPlanInsert = {
      tenant_id: input.tenantId,
      student_id: input.studentId,
      title: input.title,
      description: input.description || null,
      plan_date: input.planDate,
      start_time: input.startTime || null,
      end_time: input.endTime || null,
      container_type: input.containerType || 'daily',
      estimated_minutes: input.estimatedMinutes || null,
      content_type: input.contentType || null,
      flexible_content_id: input.flexibleContentId || null,
      page_range_start: input.pageRange?.start || null,
      page_range_end: input.pageRange?.end || null,
      recurrence_rule: input.recurrence || null,
      created_by: resolvedActorId,
    };

    const { data, error } = await supabase
      .from('ad_hoc_plans')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const adHocPlan = data as AdHocPlan;

    // 이벤트 로깅
    await createPlanEvent({
      tenant_id: input.tenantId,
      student_id: input.studentId,
      ad_hoc_plan_id: adHocPlan.id,
      event_type: 'adhoc_created',
      event_category: 'adhoc',
      payload: {
        title: input.title,
        plan_date: input.planDate,
        has_recurrence: !!input.recurrence,
        has_content: !!input.flexibleContentId,
      },
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
 * 반복 규칙에 따라 Ad-hoc 플랜 인스턴스들 생성
 * @param templateId 반복 템플릿 플랜 ID
 * @param dateRange 생성할 날짜 범위
 */
export async function expandAdHocRecurrence(
  templateId: string,
  dateRange: { start: string; end: string }
): Promise<AdminPlanResponse<AdHocPlan[]>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    // 템플릿 플랜 조회
    const { data: template, error: fetchError } = await supabase
      .from('ad_hoc_plans')
      .select('*')
      .eq('id', templateId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !template) {
      return { success: false, error: 'Template plan not found' };
    }

    const recurrenceRule = template.recurrence_rule as {
      type: 'daily' | 'weekly' | 'custom';
      interval?: number;
      daysOfWeek?: number[];
      endDate?: string;
      count?: number;
    } | null;

    if (!recurrenceRule) {
      return { success: false, error: 'Template has no recurrence rule' };
    }

    // 날짜 범위 생성
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const ruleEndDate = recurrenceRule.endDate
      ? new Date(recurrenceRule.endDate)
      : endDate;
    const finalEndDate = ruleEndDate < endDate ? ruleEndDate : endDate;

    const dates: string[] = [];
    const interval = recurrenceRule.interval || 1;
    let currentDate = new Date(startDate);
    let count = 0;
    const maxCount = recurrenceRule.count || 100;

    while (currentDate <= finalEndDate && count < maxCount) {
      const dayOfWeek = currentDate.getDay();

      let shouldAdd = false;
      if (recurrenceRule.type === 'daily') {
        shouldAdd = true;
      } else if (recurrenceRule.type === 'weekly') {
        shouldAdd = recurrenceRule.daysOfWeek?.includes(dayOfWeek) ?? false;
      } else if (recurrenceRule.type === 'custom') {
        shouldAdd = recurrenceRule.daysOfWeek?.includes(dayOfWeek) ?? false;
      }

      if (shouldAdd) {
        dates.push(currentDate.toISOString().split('T')[0]);
        count++;
      }

      // 다음 날로 이동 (interval 적용은 weekly의 경우 주 단위)
      if (recurrenceRule.type === 'daily') {
        currentDate.setDate(currentDate.getDate() + interval);
      } else {
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // 기존 인스턴스 확인 (중복 방지)
    const { data: existingInstances } = await supabase
      .from('ad_hoc_plans')
      .select('plan_date')
      .eq('recurrence_parent_id', templateId)
      .in('plan_date', dates);

    const existingDates = new Set(existingInstances?.map((i) => i.plan_date) || []);
    const newDates = dates.filter((d) => !existingDates.has(d));

    if (newDates.length === 0) {
      return { success: true, data: [] };
    }

    // 인스턴스들 생성
    const instances = newDates.map((date) => ({
      tenant_id: template.tenant_id,
      student_id: template.student_id,
      plan_date: date,
      title: template.title,
      description: template.description,
      content_type: template.content_type,
      flexible_content_id: template.flexible_content_id,
      estimated_minutes: template.estimated_minutes,
      container_type: template.container_type,
      page_range_start: template.page_range_start,
      page_range_end: template.page_range_end,
      start_time: template.start_time,
      end_time: template.end_time,
      recurrence_parent_id: templateId,
      created_by: template.created_by,
    }));

    const { data: createdInstances, error: insertError } = await supabase
      .from('ad_hoc_plans')
      .insert(instances)
      .select();

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    revalidatePath('/admin/plans');
    revalidatePath('/today');

    return { success: true, data: createdInstances as AdHocPlan[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 반복 템플릿의 모든 미래 인스턴스 삭제
 * @param templateId 반복 템플릿 플랜 ID
 * @param fromDate 해당 날짜 이후의 인스턴스만 삭제 (기본: 오늘)
 */
export async function deleteRecurrenceInstances(
  templateId: string,
  fromDate?: string
): Promise<AdminPlanResponse<number>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    const targetDate = fromDate || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('ad_hoc_plans')
      .delete()
      .eq('recurrence_parent_id', templateId)
      .eq('tenant_id', tenantId)
      .gte('plan_date', targetDate)
      .in('status', ['pending']) // 완료되지 않은 것만 삭제
      .select('id');

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

/**
 * 반복 템플릿의 인스턴스 목록 조회
 * @param templateId 반복 템플릿 플랜 ID
 */
export async function getRecurrenceInstances(
  templateId: string
): Promise<AdminPlanResponse<AdHocPlan[]>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('ad_hoc_plans')
      .select('*')
      .eq('recurrence_parent_id', templateId)
      .eq('tenant_id', tenantId)
      .order('plan_date', { ascending: true });

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

// ============================================
// Ad-hoc Plan Promotion Functions
// ============================================

/**
 * 승격 가능한 Ad-hoc 플랜 분석 결과
 */
export interface PromotionCandidate {
  contentId: string | null;
  contentType: 'book' | 'lecture' | 'custom' | null;
  contentTitle: string;
  occurrenceCount: number;
  totalMinutes: number;
  averageMinutes: number;
  lastUsedDate: string;
  relatedPlanIds: string[];
  recommendedDaysPerWeek: number;
  promotionScore: number; // 0-100, 승격 권장 점수
}

/**
 * 승격 가능한 Ad-hoc 플랜 분석
 * 반복적으로 사용되는 Ad-hoc 플랜 패턴을 감지합니다.
 *
 * @param studentId 학생 ID
 * @param minOccurrences 최소 발생 횟수 (기본: 3)
 * @param lookbackDays 분석 기간 (기본: 30일)
 */
export async function analyzePromotionCandidates(
  studentId: string,
  minOccurrences = 3,
  lookbackDays = 30
): Promise<AdminPlanResponse<PromotionCandidate[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다.' };
    }

    // 자신의 데이터만 조회 가능
    if (studentId !== user.userId) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const supabase = await createSupabaseServerClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);
    const startDateStr = startDate.toISOString().split('T')[0];

    // 최근 Ad-hoc 플랜 조회
    const { data: plans, error } = await supabase
      .from('ad_hoc_plans')
      .select('*')
      .eq('student_id', studentId)
      .gte('plan_date', startDateStr)
      .order('plan_date', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!plans || plans.length === 0) {
      return { success: true, data: [] };
    }

    // 콘텐츠/제목 기반으로 그룹화
    const groupedByContent = new Map<string, AdHocPlan[]>();

    for (const plan of plans) {
      // 그룹화 키: content_id가 있으면 content_id, 없으면 title 기반
      const key = plan.flexible_content_id
        ? `content:${plan.flexible_content_id}`
        : `title:${plan.title.toLowerCase().trim()}`;

      if (!groupedByContent.has(key)) {
        groupedByContent.set(key, []);
      }
      groupedByContent.get(key)!.push(plan as AdHocPlan);
    }

    // 승격 후보 분석
    const candidates: PromotionCandidate[] = [];

    for (const [key, groupPlans] of groupedByContent) {
      if (groupPlans.length < minOccurrences) {
        continue;
      }

      // 사용된 요일 분석
      const dayOfWeekCounts = new Map<number, number>();
      let totalMinutes = 0;

      for (const plan of groupPlans) {
        const date = new Date(plan.plan_date);
        const dayOfWeek = date.getDay();
        dayOfWeekCounts.set(dayOfWeek, (dayOfWeekCounts.get(dayOfWeek) || 0) + 1);
        totalMinutes += plan.estimated_minutes || 30;
      }

      // 가장 많이 사용된 요일 수
      const activeDays = [...dayOfWeekCounts.entries()]
        .filter(([, count]) => count >= 2)
        .length;

      // 승격 점수 계산
      // - 발생 횟수 (0-40점)
      // - 규칙적인 요일 패턴 (0-30점)
      // - 최근 사용 (0-30점)
      const occurrenceScore = Math.min(40, (groupPlans.length / 10) * 40);
      const patternScore = Math.min(30, (activeDays / 7) * 30 * 2);

      const lastPlanDate = new Date(groupPlans[0].plan_date);
      const daysSinceLastUse = Math.floor(
        (Date.now() - lastPlanDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const recencyScore = Math.max(0, 30 - daysSinceLastUse);

      const promotionScore = Math.round(occurrenceScore + patternScore + recencyScore);

      const firstPlan = groupPlans[0];

      candidates.push({
        contentId: firstPlan.flexible_content_id,
        contentType: firstPlan.content_type as PromotionCandidate['contentType'],
        contentTitle: firstPlan.title,
        occurrenceCount: groupPlans.length,
        totalMinutes,
        averageMinutes: Math.round(totalMinutes / groupPlans.length),
        lastUsedDate: firstPlan.plan_date,
        relatedPlanIds: groupPlans.map((p) => p.id),
        recommendedDaysPerWeek: Math.min(7, Math.max(1, activeDays || 3)),
        promotionScore,
      });
    }

    // 승격 점수 순으로 정렬
    candidates.sort((a, b) => b.promotionScore - a.promotionScore);

    return { success: true, data: candidates };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Ad-hoc 플랜을 정규 플랜그룹으로 승격
 *
 * @param studentId 학생 ID
 * @param candidate 승격 대상 정보
 * @param settings 새 플랜그룹 설정
 */
export interface PromoteToRegularPlanInput {
  studentId: string;
  tenantId: string;
  candidate: PromotionCandidate;
  settings: {
    name: string;
    periodStart: string;
    periodEnd: string;
    weekdays: number[];
    dailyMinutes?: number;
  };
}

export async function promoteToRegularPlan(
  input: PromoteToRegularPlanInput
): Promise<AdminPlanResponse<{ planGroupId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다.' };
    }

    // 자신의 데이터만 처리 가능
    if (input.studentId !== user.userId) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const supabase = await createSupabaseServerClient();

    // 1. 새 플랜그룹 생성 (content_based)
    const { data: planGroup, error: groupError } = await supabase
      .from('plan_groups')
      .insert({
        student_id: input.studentId,
        tenant_id: input.tenantId,
        name: input.settings.name,
        period_start: input.settings.periodStart,
        period_end: input.settings.periodEnd,
        status: 'active',
        creation_mode: 'content_based',
        promoted_from_adhoc: true, // 승격 여부 표시
      })
      .select('id')
      .single();

    if (groupError) {
      return { success: false, error: groupError.message };
    }

    // 2. 플랜 콘텐츠 생성 (콘텐츠 연결이 있는 경우)
    if (input.candidate.contentId) {
      const { error: contentError } = await supabase.from('plan_contents').insert({
        plan_group_id: planGroup.id,
        content_type: input.candidate.contentType,
        content_id: input.candidate.contentId,
        generation_status: 'pending',
      });

      if (contentError) {
        console.error('[promoteToRegularPlan] Content creation error:', contentError);
      }
    }

    // 3. 기존 Ad-hoc 플랜들에 승격 정보 추가 (삭제하지 않고 참조 유지)
    if (input.candidate.relatedPlanIds.length > 0) {
      const { error: updateError } = await supabase
        .from('ad_hoc_plans')
        .update({
          promoted_to_plan_group_id: planGroup.id,
          updated_at: new Date().toISOString(),
        })
        .in('id', input.candidate.relatedPlanIds);

      if (updateError) {
        console.error('[promoteToRegularPlan] Update error:', updateError);
      }
    }

    // 4. 이벤트 로깅
    await createPlanEvent({
      tenant_id: input.tenantId,
      student_id: input.studentId,
      plan_group_id: planGroup.id,
      event_type: 'adhoc_promoted',
      event_category: 'adhoc',
      payload: {
        promotedFrom: input.candidate.relatedPlanIds,
        contentTitle: input.candidate.contentTitle,
        occurrenceCount: input.candidate.occurrenceCount,
      },
      actor_id: user.userId,
      actor_type: 'student',
    });

    revalidatePath('/today');
    revalidatePath('/plan');

    return { success: true, data: { planGroupId: planGroup.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Student-accessible Ad-hoc Plan Functions
// ============================================

export interface StudentAdHocPlanInput {
  tenant_id: string;
  student_id: string;
  plan_date: string;
  title: string;
  description?: string | null;
  estimated_minutes?: number | null;
  container_type?: 'daily' | 'weekly' | 'unfinished';
  recurrence_rule?: {
    type: 'daily' | 'weekly';
    weekdays?: number[];
    end_date?: string;
    max_occurrences?: number;
  };
  content_link?: {
    content_type: 'book' | 'lecture' | 'custom';
    content_id: string;
    content_title: string;
    range_start: number;
    range_end: number;
  };
  // Free learning item fields
  content_type?: 'book' | 'lecture' | 'custom' | 'free' | 'review' | 'practice' | 'reading' | 'video' | 'assignment';
  tags?: string[] | null;
  color?: string | null;
  icon?: string | null;
}

/**
 * 학생용 향상된 Ad-hoc 플랜 생성 (콘텐츠 연결, 반복 지원)
 * 관리자 권한 없이 자신의 플랜만 생성 가능
 */
export async function createStudentAdHocPlan(
  input: StudentAdHocPlanInput
): Promise<AdminPlanResponse<AdHocPlan>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다.' };
    }

    // 자신의 플랜만 생성 가능
    if (input.student_id !== user.userId) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const supabase = await createSupabaseServerClient();

    // FK 검증: content_link가 있는 경우 콘텐츠 존재 여부 확인
    if (input.content_link?.content_id) {
      const contentCheck = await checkFlexibleContentExists(
        input.content_link.content_id,
        input.content_link.content_type ?? null,
        input.student_id
      );
      if (!contentCheck.exists) {
        return {
          success: false,
          error: `콘텐츠를 찾을 수 없습니다. (ID: ${input.content_link.content_id})`,
        };
      }
    }

    // 콘텐츠 연결 정보가 있으면 제목에 범위 포함
    const finalTitle = input.content_link
      ? `${input.content_link.content_title} (${input.content_link.range_start}-${input.content_link.range_end})`
      : input.title;

    const insertData: AdHocPlanInsert = {
      tenant_id: input.tenant_id,
      student_id: input.student_id,
      title: finalTitle,
      description: input.description || null,
      plan_date: input.plan_date,
      container_type: input.container_type || 'daily',
      estimated_minutes: input.estimated_minutes || null,
      // content_type: 직접 지정 > content_link에서 추출 > null
      content_type: input.content_type || input.content_link?.content_type || null,
      flexible_content_id: input.content_link?.content_id || null,
      page_range_start: input.content_link?.range_start || null,
      page_range_end: input.content_link?.range_end || null,
      recurrence_rule: input.recurrence_rule || null,
      // 학생이 직접 생성하는 플랜은 created_by를 null로 설정
      // (created_by는 admin_users.id를 참조하므로 학생 ID 사용 불가)
      created_by: null,
      // Free learning item fields
      tags: input.tags || null,
      color: input.color || null,
      icon: input.icon || null,
    };

    const { data, error } = await supabase
      .from('ad_hoc_plans')
      .insert(insertData)
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
      payload: {
        title: finalTitle,
        plan_date: input.plan_date,
        has_recurrence: !!input.recurrence_rule,
        has_content: !!input.content_link,
      },
      new_state: adHocPlan as unknown as Record<string, unknown>,
      actor_id: user.userId,
      actor_type: 'student',
    });

    revalidatePath('/today');

    return { success: true, data: adHocPlan };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
