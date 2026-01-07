'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { logActionError } from '@/lib/logging/actionLogger';
import type { AdminPlanResponse } from '../types';
import { createPlanEvent } from './planEvent';

export interface CopyPlanInput {
  sourcePlanIds: string[];
  targetDates: string[];
  studentId: string; // 원본 플랜 소유 학생
  targetStudentIds?: string[]; // 복사 대상 학생들 (미지정시 studentId와 동일)
}

export interface CopyPlanResult {
  copiedCount: number;
  copiedPlanIds: string[];
}

/**
 * 플랜 복사 (관리자용)
 * - 선택한 플랜들을 지정된 날짜들로 복사
 * - 각 플랜 x 각 날짜 = 복사본 생성
 */
export async function copyPlansToDate(
  input: CopyPlanInput
): Promise<AdminPlanResponse<CopyPlanResult>> {
  try {
    const { tenantId, userId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    if (input.sourcePlanIds.length === 0) {
      return { success: false, error: '복사할 플랜을 선택해주세요.' };
    }

    if (input.targetDates.length === 0) {
      return { success: false, error: '복사할 날짜를 선택해주세요.' };
    }

    // 1. 원본 플랜들 조회
    const { data: sourcePlans, error: fetchError } = await supabase
      .from('student_plan')
      .select(`
        content_master_id,
        content_detail_id,
        content_title,
        content_subject,
        custom_title,
        custom_range_display,
        planned_start_page_or_time,
        planned_end_page_or_time,
        estimated_minutes,
        plan_group_id,
        container_type,
        sequence,
        plan_details
      `)
      .in('id', input.sourcePlanIds)
      .eq('student_id', input.studentId);

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (!sourcePlans || sourcePlans.length === 0) {
      return { success: false, error: '원본 플랜을 찾을 수 없습니다.' };
    }

    // 2. 복사본 생성
    const copiedPlanIds: string[] = [];
    const now = new Date().toISOString();

    // 대상 학생 목록 (미지정시 원본 학생)
    const targetStudents = input.targetStudentIds?.length
      ? input.targetStudentIds
      : [input.studentId];

    for (const targetStudentId of targetStudents) {
      // 다른 학생에게 복사시 plan_group_id는 null로 설정 (그룹은 학생별이므로)
      const shouldClearPlanGroup = targetStudentId !== input.studentId;

      for (const sourcePlan of sourcePlans) {
        for (const targetDate of input.targetDates) {
          const newPlan = {
            student_id: targetStudentId,
            tenant_id: tenantId,
            block_index: 0,
            content_type: 'free', // 복사 시 기본값
            content_master_id: sourcePlan.content_master_id,
            content_detail_id: sourcePlan.content_detail_id,
            content_title: sourcePlan.content_title,
            content_subject: sourcePlan.content_subject,
            custom_title: sourcePlan.custom_title,
            custom_range_display: sourcePlan.custom_range_display,
            planned_start_page_or_time: sourcePlan.planned_start_page_or_time,
            planned_end_page_or_time: sourcePlan.planned_end_page_or_time,
            estimated_minutes: sourcePlan.estimated_minutes,
            plan_group_id: shouldClearPlanGroup ? null : sourcePlan.plan_group_id,
            plan_date: targetDate,
            container_type: sourcePlan.container_type,
            status: 'pending',
            is_active: true,
            sequence: sourcePlan.sequence,
            plan_details: sourcePlan.plan_details,
            created_at: now,
            updated_at: now,
          };

          const { data: inserted, error: insertError } = await supabase
            .from('student_plan')
            .insert(newPlan)
            .select('id')
            .single();

          if (!insertError && inserted) {
            copiedPlanIds.push(inserted.id);
          }
        }
      }
    }

    // 3. 이벤트 로깅
    if (tenantId) {
      await createPlanEvent({
        tenant_id: tenantId,
        student_id: input.studentId,
        event_type: 'plan_created',
        event_category: 'plan_item',
        actor_type: 'admin',
        actor_id: userId,
        payload: {
          action: 'copy',
          source_plan_ids: input.sourcePlanIds,
          target_dates: input.targetDates,
          target_student_ids: targetStudents,
          copied_count: copiedPlanIds.length,
          copied_plan_ids: copiedPlanIds,
        },
      });
    }

    // 4. 경로 재검증
    for (const targetStudentId of targetStudents) {
      revalidatePath(`/admin/students/${targetStudentId}/plans`);
    }
    revalidatePath('/today');
    revalidatePath('/plan');

    return {
      success: true,
      data: {
        copiedCount: copiedPlanIds.length,
        copiedPlanIds,
      },
    };
  } catch (error) {
    logActionError({ domain: 'admin-plan', action: 'copyPlansToDate' }, error, {
      sourcePlanIds: input.sourcePlanIds,
      targetDates: input.targetDates,
      studentId: input.studentId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '플랜 복사 중 오류가 발생했습니다.',
    };
  }
}
