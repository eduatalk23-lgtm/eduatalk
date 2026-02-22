'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { logActionError } from '@/lib/logging/actionLogger';
import type { AdminPlanResponse } from '../types';

interface MovePlanToDateInput {
  planId: string;
  studentId: string;
  targetDate: string;      // YYYY-MM-DD
  newStartTime: string;    // HH:mm
  newEndTime: string;      // HH:mm
  estimatedMinutes?: number;
}

/**
 * 플랜을 다른 날짜로 이동 (plan_date + start_time + end_time 동시 업데이트)
 * 주간 그리드 뷰에서 날짜 간 드래그 시 사용
 */
export async function movePlanToDate(
  input: MovePlanToDateInput,
): Promise<AdminPlanResponse<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: '인증되지 않은 사용자입니다.' };
    }

    const updateData: Record<string, unknown> = {
      plan_date: input.targetDate,
      start_time: input.newStartTime,
      end_time: input.newEndTime,
    };

    if (input.estimatedMinutes != null) {
      updateData.estimated_minutes = input.estimatedMinutes;
    }

    const { error } = await supabase
      .from('student_plan')
      .update(updateData)
      .eq('id', input.planId);

    if (error) {
      logActionError(
        { domain: 'admin-plan', action: 'movePlanToDate' },
        error,
        { planId: input.planId, targetDate: input.targetDate },
      );
      return { success: false, error: '플랜 날짜 이동에 실패했습니다.' };
    }

    revalidatePath(`/admin/students/${input.studentId}/plans`);
    return { success: true };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'movePlanToDate' },
      error,
      { planId: input.planId, targetDate: input.targetDate },
    );
    return { success: false, error: '예기치 않은 오류가 발생했습니다.' };
  }
}
