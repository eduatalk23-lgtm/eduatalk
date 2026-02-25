'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logActionError, logActionDebug } from '@/lib/utils/serverActionLogger';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';

// ============================================
// Types
// ============================================

export type OverrideType = 'non_study_time' | 'academy' | 'lunch';

export interface UpdateCalendarNonStudyInput {
  calendarId: string;
  overrideType: OverrideType;
  sourceIndex?: number;
  sourceAcademyId?: string;
  isDisabled?: boolean;
  startTimeOverride?: string;
  endTimeOverride?: string;
}


// ============================================
// Actions
// ============================================

/**
 * 캘린더의 비학습시간 설정 업데이트
 *
 * calendars 테이블의 non_study_time_blocks JSONB를 직접 수정합니다.
 */
export async function updateCalendarNonStudyTime(input: UpdateCalendarNonStudyInput): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: '인증되지 않은 사용자입니다.' };
    }

    // 캘린더 조회
    const { data: calendar, error: fetchError } = await supabase
      .from('calendars')
      .select('id, non_study_time_blocks')
      .eq('id', input.calendarId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !calendar) {
      return { success: false, error: '캘린더를 찾을 수 없습니다.' };
    }

    if (input.overrideType === 'lunch') {
      // 점심시간: non_study_time_blocks 내 "점심식사" 블록 업데이트
      const blocks = (calendar.non_study_time_blocks as Array<{
        type: string;
        start_time: string;
        end_time: string;
      }>) ?? [];

      const lunchIndex = blocks.findIndex(b => b.type === '점심식사');

      if (input.isDisabled) {
        if (lunchIndex >= 0) blocks.splice(lunchIndex, 1);
      } else {
        const lunchBlock = {
          type: '점심식사',
          start_time: input.startTimeOverride ?? '12:00',
          end_time: input.endTimeOverride ?? '13:00',
        };
        if (lunchIndex >= 0) {
          blocks[lunchIndex] = lunchBlock;
        } else {
          blocks.push(lunchBlock);
        }
      }

      const { error: updateError } = await supabase
        .from('calendars')
        .update({ non_study_time_blocks: blocks })
        .eq('id', input.calendarId);

      if (updateError) {
        return { success: false, error: '점심시간 업데이트에 실패했습니다.' };
      }

      logActionDebug('updateCalendarNonStudyTime', `Lunch time updated for calendar ${input.calendarId}`);
      return { success: true };
    }

    if (input.overrideType === 'non_study_time' && input.sourceIndex !== undefined) {
      const nonStudyBlocks = (calendar.non_study_time_blocks as Array<{
        type: string;
        start_time: string;
        end_time: string;
      }>) ?? [];

      if (input.sourceIndex < 0 || input.sourceIndex >= nonStudyBlocks.length) {
        return { success: false, error: '잘못된 인덱스입니다.' };
      }

      if (input.isDisabled) {
        nonStudyBlocks.splice(input.sourceIndex, 1);
      } else {
        nonStudyBlocks[input.sourceIndex] = {
          ...nonStudyBlocks[input.sourceIndex],
          start_time: input.startTimeOverride ?? nonStudyBlocks[input.sourceIndex].start_time,
          end_time: input.endTimeOverride ?? nonStudyBlocks[input.sourceIndex].end_time,
        };
      }

      const { error: updateError } = await supabase
        .from('calendars')
        .update({ non_study_time_blocks: nonStudyBlocks })
        .eq('id', input.calendarId);

      if (updateError) {
        return { success: false, error: '비학습시간 업데이트에 실패했습니다.' };
      }

      logActionDebug('updateCalendarNonStudyTime', `Non-study time updated for calendar ${input.calendarId}`);
      return { success: true };
    }

    return { success: false, error: '지원하지 않는 오버라이드 타입입니다.' };
  } catch (error) {
    logActionError('updateCalendarNonStudyTime', error instanceof Error ? error.message : String(error));
    return { success: false, error: '예기치 않은 오류가 발생했습니다.' };
  }
}

