'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
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
 * 플랜(캘린더 이벤트)을 다른 날짜로 이동
 * calendar_events 테이블의 start_at, end_at, start_date를 업데이트
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

    // 학생은 관리자 이벤트 이동 불가
    if (user.role === 'student') {
      const { data: event } = await supabase
        .from('calendar_events')
        .select('creator_role')
        .eq('id', input.planId)
        .single();
      if (event?.creator_role === 'admin') {
        return { success: false, error: '선생님이 등록한 일정은 이동할 수 없습니다.' };
      }
    }

    // HH:mm → ISO timestamp (KST)
    const startAt = `${input.targetDate}T${input.newStartTime}:00+09:00`;
    const endAt = `${input.targetDate}T${input.newEndTime}:00+09:00`;

    // timed 이벤트(is_all_day=false)는 start_date가 NULL이어야 함 (chk_event_time_consistency)
    // 날짜는 start_at에서 추출 (adapters.extractDateYMD)
    const { error: eventError } = await supabase
      .from('calendar_events')
      .update({
        start_at: startAt,
        end_at: endAt,
      })
      .eq('id', input.planId)
      .is('deleted_at', null);

    if (eventError) {
      logActionError(
        { domain: 'admin-plan', action: 'movePlanToDate' },
        eventError,
        { planId: input.planId, targetDate: input.targetDate },
      );
      return { success: false, error: '플랜 날짜 이동에 실패했습니다.' };
    }

    // estimated_minutes는 event_study_data에 저장
    if (input.estimatedMinutes != null) {
      await supabase
        .from('event_study_data')
        .update({ estimated_minutes: input.estimatedMinutes })
        .eq('event_id', input.planId);
    }

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
