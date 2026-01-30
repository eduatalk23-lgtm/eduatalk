'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logActionError, logActionDebug } from '@/lib/utils/serverActionLogger';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';

// ============================================
// Types
// ============================================

export type OverrideType = 'non_study_time' | 'academy' | 'lunch';

export interface NonStudyOverride {
  id: string;
  planner_id: string;
  override_date: string;
  override_type: OverrideType;
  source_index: number | null;
  source_academy_id: string | null;
  is_disabled: boolean;
  start_time_override: string | null;
  end_time_override: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOverrideInput {
  plannerId: string;
  overrideDate: string;
  overrideType: OverrideType;
  sourceIndex?: number;
  sourceAcademyId?: string;
  isDisabled?: boolean;
  startTimeOverride?: string;
  endTimeOverride?: string;
  reason?: string;
  applyScope: 'today' | 'planner'; // 오늘만 vs 플래너 전체
}

export interface UpdateOverrideInput {
  overrideId: string;
  isDisabled?: boolean;
  startTimeOverride?: string | null;
  endTimeOverride?: string | null;
  reason?: string | null;
}

// ============================================
// Actions
// ============================================

/**
 * 비학습시간 오버라이드 생성
 */
export async function createNonStudyOverride(input: CreateOverrideInput): Promise<{
  success: boolean;
  data?: NonStudyOverride;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: '인증되지 않은 사용자입니다.' };
    }

    // applyScope에 따라 처리
    if (input.applyScope === 'planner') {
      // 플래너 전체에 적용: 플래너의 원본 데이터를 수정해야 함
      // 이 경우 오버라이드가 아니라 플래너 자체를 업데이트
      return await updatePlannerNonStudyTime(input);
    }

    // 오늘만 적용: 오버라이드 레코드 생성
    // source_index가 null인 경우 upsert의 onConflict가 작동하지 않으므로
    // 먼저 기존 레코드를 삭제한 후 새로 생성
    const deleteQuery = supabase
      .from('planner_daily_overrides')
      .delete()
      .eq('planner_id', input.plannerId)
      .eq('override_date', input.overrideDate)
      .eq('override_type', input.overrideType);

    // source_index가 있으면 조건 추가, 없으면 null인 것만 삭제
    if (input.sourceIndex !== undefined) {
      deleteQuery.eq('source_index', input.sourceIndex);
    } else {
      deleteQuery.is('source_index', null);
    }

    await deleteQuery;

    // 새 오버라이드 생성
    const { data, error } = await supabase
      .from('planner_daily_overrides')
      .insert({
        planner_id: input.plannerId,
        override_date: input.overrideDate,
        override_type: input.overrideType,
        source_index: input.sourceIndex ?? null,
        source_academy_id: input.sourceAcademyId ?? null,
        is_disabled: input.isDisabled ?? false,
        start_time_override: input.startTimeOverride ?? null,
        end_time_override: input.endTimeOverride ?? null,
        reason: input.reason ?? null,
        created_by: user.userId,
      })
      .select()
      .single();

    if (error) {
      logActionError('createNonStudyOverride', error.message);
      return { success: false, error: '오버라이드 생성에 실패했습니다.' };
    }

    logActionDebug('createNonStudyOverride', `Override created for planner ${input.plannerId} on ${input.overrideDate}`);
    return { success: true, data: data as NonStudyOverride };
  } catch (error) {
    logActionError('createNonStudyOverride', error instanceof Error ? error.message : String(error));
    return { success: false, error: '예기치 않은 오류가 발생했습니다.' };
  }
}

/**
 * 플래너의 비학습시간 원본 데이터 업데이트 (플래너 전체 적용)
 */
async function updatePlannerNonStudyTime(input: CreateOverrideInput): Promise<{
  success: boolean;
  data?: NonStudyOverride;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    // 플래너 조회
    const { data: planner, error: fetchError } = await supabase
      .from('planners')
      .select('id, non_study_times, lunch_time')
      .eq('id', input.plannerId)
      .single();

    if (fetchError || !planner) {
      return { success: false, error: '플래너를 찾을 수 없습니다.' };
    }

    if (input.overrideType === 'lunch') {
      // 점심시간 업데이트
      const newLunchTime = input.isDisabled
        ? null
        : {
            start: input.startTimeOverride ?? '12:00',
            end: input.endTimeOverride ?? '13:00',
          };

      const { error: updateError } = await supabase
        .from('planners')
        .update({ lunch_time: newLunchTime })
        .eq('id', input.plannerId);

      if (updateError) {
        return { success: false, error: '점심시간 업데이트에 실패했습니다.' };
      }

      logActionDebug('updatePlannerNonStudyTime', `Lunch time updated for planner ${input.plannerId}`);
      return { success: true };
    }

    if (input.overrideType === 'non_study_time' && input.sourceIndex !== undefined) {
      // non_study_times 배열 업데이트
      const nonStudyTimes = (planner.non_study_times as Array<{
        type: string;
        start_time: string;
        end_time: string;
      }>) ?? [];

      if (input.sourceIndex < 0 || input.sourceIndex >= nonStudyTimes.length) {
        return { success: false, error: '잘못된 인덱스입니다.' };
      }

      if (input.isDisabled) {
        // 해당 항목 삭제
        nonStudyTimes.splice(input.sourceIndex, 1);
      } else {
        // 시간 업데이트
        nonStudyTimes[input.sourceIndex] = {
          ...nonStudyTimes[input.sourceIndex],
          start_time: input.startTimeOverride ?? nonStudyTimes[input.sourceIndex].start_time,
          end_time: input.endTimeOverride ?? nonStudyTimes[input.sourceIndex].end_time,
        };
      }

      const { error: updateError } = await supabase
        .from('planners')
        .update({ non_study_times: nonStudyTimes })
        .eq('id', input.plannerId);

      if (updateError) {
        return { success: false, error: '비학습시간 업데이트에 실패했습니다.' };
      }

      logActionDebug('updatePlannerNonStudyTime', `Non-study time updated for planner ${input.plannerId}`);
      return { success: true };
    }

    return { success: false, error: '지원하지 않는 오버라이드 타입입니다.' };
  } catch (error) {
    logActionError('updatePlannerNonStudyTime', error instanceof Error ? error.message : String(error));
    return { success: false, error: '예기치 않은 오류가 발생했습니다.' };
  }
}

/**
 * 특정 날짜의 오버라이드 목록 조회
 */
export async function getOverridesForDate(
  plannerId: string,
  date: string
): Promise<{
  success: boolean;
  data?: NonStudyOverride[];
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('planner_daily_overrides')
      .select('*')
      .eq('planner_id', plannerId)
      .eq('override_date', date);

    if (error) {
      logActionError('getOverridesForDate', error.message);
      return { success: false, error: '오버라이드 조회에 실패했습니다.' };
    }

    return { success: true, data: data as NonStudyOverride[] };
  } catch (error) {
    logActionError('getOverridesForDate', error instanceof Error ? error.message : String(error));
    return { success: false, error: '예기치 않은 오류가 발생했습니다.' };
  }
}

/**
 * 오버라이드 삭제 (원래 설정으로 복원)
 */
export async function deleteNonStudyOverride(overrideId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('planner_daily_overrides')
      .delete()
      .eq('id', overrideId);

    if (error) {
      logActionError('deleteNonStudyOverride', error.message);
      return { success: false, error: '오버라이드 삭제에 실패했습니다.' };
    }

    logActionDebug('deleteNonStudyOverride', `Override ${overrideId} deleted`);
    return { success: true };
  } catch (error) {
    logActionError('deleteNonStudyOverride', error instanceof Error ? error.message : String(error));
    return { success: false, error: '예기치 않은 오류가 발생했습니다.' };
  }
}

/**
 * 오버라이드 업데이트
 */
export async function updateNonStudyOverride(input: UpdateOverrideInput): Promise<{
  success: boolean;
  data?: NonStudyOverride;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    const updateData: Record<string, unknown> = {};
    if (input.isDisabled !== undefined) updateData.is_disabled = input.isDisabled;
    if (input.startTimeOverride !== undefined) updateData.start_time_override = input.startTimeOverride;
    if (input.endTimeOverride !== undefined) updateData.end_time_override = input.endTimeOverride;
    if (input.reason !== undefined) updateData.reason = input.reason;

    const { data, error } = await supabase
      .from('planner_daily_overrides')
      .update(updateData)
      .eq('id', input.overrideId)
      .select()
      .single();

    if (error) {
      logActionError('updateNonStudyOverride', error.message);
      return { success: false, error: '오버라이드 업데이트에 실패했습니다.' };
    }

    logActionDebug('updateNonStudyOverride', `Override ${input.overrideId} updated`);
    return { success: true, data: data as NonStudyOverride };
  } catch (error) {
    logActionError('updateNonStudyOverride', error instanceof Error ? error.message : String(error));
    return { success: false, error: '예기치 않은 오류가 발생했습니다.' };
  }
}
