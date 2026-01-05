'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { logActionError } from '@/lib/logging/actionLogger';
import type { AdminPlanResponse } from '../types';

export interface PlanTemplateItem {
  content_master_id: string | null;
  content_detail_id: string | null;
  content_title: string | null;
  content_subject: string | null;
  custom_title: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  estimated_minutes: number | null;
  container_type: string;
  sequence: number;
}

export interface PlanTemplate {
  id: string;
  name: string;
  description: string | null;
  tenant_id: string;
  created_by: string;
  items: PlanTemplateItem[];
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  planIds: string[];
  studentId: string;
}

/**
 * 플랜 템플릿 목록 조회 (관리자용)
 */
export async function getPlanTemplates(): Promise<AdminPlanResponse<PlanTemplate[]>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('plan_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === '42P01') {
        return { success: true, data: [] };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    logActionError({ domain: 'admin-plan', action: 'getPlanTemplates' }, error, {});
    return {
      success: false,
      error: error instanceof Error ? error.message : '템플릿 조회 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 선택한 플랜들로 템플릿 생성 (관리자용)
 */
export async function createPlanTemplate(
  input: CreateTemplateInput
): Promise<AdminPlanResponse<{ templateId: string }>> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    if (!input.name.trim()) {
      return { success: false, error: '템플릿 이름을 입력해주세요.' };
    }

    if (input.planIds.length === 0) {
      return { success: false, error: '템플릿에 포함할 플랜을 선택해주세요.' };
    }

    // 1. 원본 플랜 정보 조회
    const { data: sourcePlans, error: fetchError } = await supabase
      .from('student_plan')
      .select(`
        content_master_id,
        content_detail_id,
        content_title,
        content_subject,
        custom_title,
        planned_start_page_or_time,
        planned_end_page_or_time,
        estimated_minutes,
        container_type,
        sequence
      `)
      .in('id', input.planIds)
      .eq('student_id', input.studentId)
      .order('sequence', { ascending: true });

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (!sourcePlans || sourcePlans.length === 0) {
      return { success: false, error: '플랜 정보를 찾을 수 없습니다.' };
    }

    // 2. 템플릿 아이템 생성
    const items: PlanTemplateItem[] = sourcePlans.map((plan, index) => ({
      content_master_id: plan.content_master_id,
      content_detail_id: plan.content_detail_id,
      content_title: plan.content_title,
      content_subject: plan.content_subject,
      custom_title: plan.custom_title,
      planned_start_page_or_time: plan.planned_start_page_or_time,
      planned_end_page_or_time: plan.planned_end_page_or_time,
      estimated_minutes: plan.estimated_minutes,
      container_type: plan.container_type ?? 'daily',
      sequence: index + 1,
    }));

    // 3. 템플릿 저장
    const now = new Date().toISOString();
    const { data: template, error: insertError } = await supabase
      .from('plan_templates')
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        tenant_id: tenantId,
        created_by: userId,
        items,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (insertError) {
      // 테이블이 없으면 생성 안내
      if (insertError.code === '42P01') {
        return {
          success: false,
          error: 'plan_templates 테이블이 없습니다. 마이그레이션을 실행해주세요.',
        };
      }
      return { success: false, error: insertError.message };
    }

    revalidatePath('/admin/students');

    return {
      success: true,
      data: { templateId: template.id },
    };
  } catch (error) {
    logActionError({ domain: 'admin-plan', action: 'createPlanTemplate' }, error, {
      name: input.name,
      planCount: input.planIds.length,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '템플릿 생성 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 템플릿을 학생에게 적용 (관리자용)
 */
export async function applyPlanTemplate(
  templateId: string,
  studentId: string,
  targetDate: string,
  planGroupId?: string
): Promise<AdminPlanResponse<{ createdCount: number }>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    // 1. 템플릿 조회
    const { data: template, error: fetchError } = await supabase
      .from('plan_templates')
      .select('*')
      .eq('id', templateId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !template) {
      return { success: false, error: '템플릿을 찾을 수 없습니다.' };
    }

    const items = template.items as PlanTemplateItem[];
    if (!items || items.length === 0) {
      return { success: false, error: '템플릿에 플랜 항목이 없습니다.' };
    }

    // 2. 플랜 생성
    const now = new Date().toISOString();
    const newPlans = items.map((item) => ({
      student_id: studentId,
      content_master_id: item.content_master_id,
      content_detail_id: item.content_detail_id,
      content_title: item.content_title,
      content_subject: item.content_subject,
      custom_title: item.custom_title,
      planned_start_page_or_time: item.planned_start_page_or_time,
      planned_end_page_or_time: item.planned_end_page_or_time,
      estimated_minutes: item.estimated_minutes,
      plan_date: targetDate,
      container_type: item.container_type,
      plan_group_id: planGroupId || null,
      status: 'pending',
      is_completed: false,
      is_active: true,
      sequence: item.sequence,
      created_at: now,
      updated_at: now,
    }));

    const { error: insertError } = await supabase.from('student_plan').insert(newPlans);

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    revalidatePath(`/admin/students/${studentId}/plans`);
    revalidatePath('/today');
    revalidatePath('/plan');

    return {
      success: true,
      data: { createdCount: items.length },
    };
  } catch (error) {
    logActionError({ domain: 'admin-plan', action: 'applyPlanTemplate' }, error, {
      templateId,
      studentId,
      targetDate,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '템플릿 적용 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 템플릿 삭제 (관리자용)
 */
export async function deletePlanTemplate(
  templateId: string
): Promise<AdminPlanResponse<void>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('plan_templates')
      .delete()
      .eq('id', templateId)
      .eq('tenant_id', tenantId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/students');

    return { success: true, data: undefined };
  } catch (error) {
    logActionError({ domain: 'admin-plan', action: 'deletePlanTemplate' }, error, { templateId });
    return {
      success: false,
      error: error instanceof Error ? error.message : '템플릿 삭제 중 오류가 발생했습니다.',
    };
  }
}
