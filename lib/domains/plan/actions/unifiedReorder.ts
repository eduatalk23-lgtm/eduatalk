'use server';

/**
 * 통합 타임라인 재정렬 서버 액션
 *
 * 플랜과 비학습시간을 하나의 통합 타임라인으로 재정렬합니다.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { logActionError, logActionDebug } from '@/lib/logging/actionLogger';
import { revalidatePath } from 'next/cache';
import {
  type TimelineItem,
  type UnifiedReorderInput,
  type ReorderResult,
} from '@/lib/types/unifiedTimeline';
import { calculateUnifiedReorder } from '@/lib/domains/plan/utils/unifiedReorderCalculation';

interface UnifiedReorderResult {
  success: boolean;
  mode?: 'push' | 'pull';
  error?: string;
}

/**
 * 통합 타임라인 재정렬 실행
 *
 * 드래그 앤 드롭으로 아이템을 이동한 후, 모든 아이템의 시간을 재계산합니다.
 */
export async function executeUnifiedReorder(
  input: UnifiedReorderInput
): Promise<UnifiedReorderResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: '인증되지 않은 사용자입니다.' };
    }

    logActionDebug(
      { domain: 'plan', action: 'executeUnifiedReorder' },
      `Reordering items for planner ${input.plannerId} on ${input.planDate}`,
      { plannerId: input.plannerId, planDate: input.planDate }
    );

    // 디버깅: 입력 데이터의 nonStudy 아이템 확인
    const inputNonStudyItems = input.orderedItems.filter(i => i.type === 'nonStudy');
    console.log('[DEBUG] Input nonStudy items:', inputNonStudyItems.map(i => ({
      id: i.id,
      startTime: i.startTime,
      endTime: i.endTime,
      nonStudyData: i.nonStudyData,
    })));

    // 1. 현재 아이템들(드래그 후)을 TimelineItem 형식으로 변환
    const currentItems: TimelineItem[] = input.orderedItems.map((item) => ({
      id: item.id,
      type: item.type,
      startTime: item.startTime,
      endTime: item.endTime,
      durationMinutes: item.durationMinutes,
      planId: item.planId,
      nonStudyType: item.nonStudyData?.originalType,
      sourceIndex: item.nonStudyData?.sourceIndex,
      originalStartTime: item.nonStudyData?.originalStartTime,
      originalEndTime: item.nonStudyData?.originalEndTime,
    }));

    // 2. 원본 아이템들(드래그 전)을 TimelineItem 형식으로 변환
    const originalItems: TimelineItem[] = input.originalItems.map((item) => ({
      id: item.id,
      type: item.type,
      startTime: item.startTime,
      endTime: item.endTime,
      durationMinutes: item.durationMinutes,
      planId: item.planId,
      nonStudyType: item.nonStudyData?.originalType,
      sourceIndex: item.nonStudyData?.sourceIndex,
      originalStartTime: item.nonStudyData?.originalStartTime,
      originalEndTime: item.nonStudyData?.originalEndTime,
    }));

    // 3. 재정렬 계산 (Push/Pull 모드 자동 결정)
    const reorderResult: ReorderResult = calculateUnifiedReorder(
      currentItems,
      input.slotBoundary,
      input.movedItemId,
      originalItems
    );

    logActionDebug(
      { domain: 'plan', action: 'executeUnifiedReorder' },
      `Reorder mode: ${reorderResult.mode}, items: ${reorderResult.items.length}`,
      { mode: reorderResult.mode, itemCount: reorderResult.items.length }
    );

    // 4. 플랜 업데이트 데이터 준비
    const planUpdates = reorderResult.items
      .filter((item) => item.type === 'plan' && item.planId)
      .map((item, index) => ({
        id: item.planId!,
        start_time: item.startTime,
        end_time: item.endTime,
        sequence: index + 1,
      }));

    // 5. 트랜잭션으로 플랜 일괄 업데이트 (RPC 사용)
    if (planUpdates.length > 0) {
      const { error: rpcError } = await supabase.rpc('batch_update_plan_times', {
        plan_updates: planUpdates.map((p) => ({
          plan_id: p.id,
          new_start_time: p.start_time,
          new_end_time: p.end_time,
          new_sequence: p.sequence,
        })),
      });

      // RPC가 없으면 개별 업데이트로 폴백 (트랜잭션 없이)
      if (rpcError?.code === 'PGRST202' || rpcError?.message?.includes('function') || rpcError?.message?.includes('does not exist')) {
        logActionDebug(
          { domain: 'plan', action: 'executeUnifiedReorder' },
          'RPC not available, falling back to individual updates',
          { error: rpcError.message }
        );

        // 개별 업데이트 (폴백)
        for (const plan of planUpdates) {
          const { error } = await supabase
            .from('student_plan')
            .update({
              start_time: plan.start_time,
              end_time: plan.end_time,
              sequence: plan.sequence,
            })
            .eq('id', plan.id);

          if (error) {
            logActionError(
              { domain: 'plan', action: 'executeUnifiedReorder' },
              error,
              { planId: plan.id, step: 'updatePlan' }
            );
            return { success: false, error: '플랜 업데이트에 실패했습니다.' };
          }
        }
      } else if (rpcError) {
        logActionError(
          { domain: 'plan', action: 'executeUnifiedReorder' },
          rpcError,
          { step: 'batchUpdatePlans' }
        );
        return { success: false, error: '플랜 일괄 업데이트에 실패했습니다.' };
      }

      logActionDebug(
        { domain: 'plan', action: 'executeUnifiedReorder' },
        `Updated ${planUpdates.length} plans`,
        { planCount: planUpdates.length }
      );
    }

    // 6. 비학습시간 업데이트 (새 테이블 직접 UPDATE)
    // empty 슬롯 제외 (id가 'empty-'로 시작하는 것들은 시각적 플레이스홀더임)
    const nonStudyItems = reorderResult.items.filter(
      (item) => item.type === 'nonStudy' && !item.id.startsWith('empty-')
    );

    // input.orderedItems에서 recordId 매핑 (id -> recordId)
    const recordIdMap = new Map<string, string>();
    for (const orderedItem of input.orderedItems) {
      if (orderedItem.type === 'nonStudy' && orderedItem.nonStudyData?.recordId) {
        recordIdMap.set(orderedItem.id, orderedItem.nonStudyData.recordId);
      }
    }

    // 디버깅: 전체 reorderResult 확인
    console.log('[DEBUG] reorderResult mode:', reorderResult.mode);
    console.log('[DEBUG] reorderResult.items count:', reorderResult.items.length);
    console.log('[DEBUG] reorderResult.items (all):', reorderResult.items.map(i => ({
      id: i.id?.substring(0, 8),
      type: i.type,
      startTime: i.startTime,
      endTime: i.endTime,
      originalStartTime: i.originalStartTime,
      originalEndTime: i.originalEndTime,
    })));
    console.log('[DEBUG] recordIdMap:', Object.fromEntries(recordIdMap));
    console.log('[DEBUG] nonStudyItems count:', nonStudyItems.length);
    console.log('[DEBUG] nonStudyItems:', nonStudyItems.map(i => ({
      id: i.id,
      startTime: i.startTime,
      endTime: i.endTime,
      originalStartTime: i.originalStartTime,
      originalEndTime: i.originalEndTime,
    })));

    for (const item of nonStudyItems) {
      const timeChanged = item.startTime !== item.originalStartTime || item.endTime !== item.originalEndTime;
      console.log('[DEBUG] NonStudy time comparison:', {
        id: item.id,
        startTime: item.startTime,
        originalStartTime: item.originalStartTime,
        endTime: item.endTime,
        originalEndTime: item.originalEndTime,
        timeChanged,
      });

      // 시간이 변경된 경우에만 업데이트
      if (timeChanged) {
        // 새 방식: student_non_study_time 테이블 직접 UPDATE
        // input.orderedItems에서 recordId 찾기
        const recordId = recordIdMap.get(item.id);
        console.log('[DEBUG] Looking for recordId:', { itemId: item.id, foundRecordId: recordId });

        if (recordId) {
          const { error: updateError } = await supabase
            .from('student_non_study_time')
            .update({
              start_time: item.startTime + ':00', // HH:mm -> HH:mm:ss
              end_time: item.endTime + ':00',
            })
            .eq('id', recordId);

          if (updateError) {
            logActionError(
              { domain: 'plan', action: 'executeUnifiedReorder' },
              updateError,
              { itemId: item.id, recordId, step: 'updateNonStudyTime' }
            );
          } else {
            logActionDebug(
              { domain: 'plan', action: 'executeUnifiedReorder' },
              `Updated non-study time record ${recordId}`,
              { itemId: item.id, recordId }
            );
          }
        } else {
          // recordId가 없으면 구 시스템(오버라이드 기반) 플래너임 - 스킵 (에러가 아님)
          logActionDebug(
            { domain: 'plan', action: 'executeUnifiedReorder' },
            `Skipping non-study time update (no recordId - legacy planner): ${item.id}`,
            { itemId: item.id, step: 'updateNonStudyTime' }
          );
        }
      }
    }

    // 7. 캐시 무효화
    revalidatePath(`/admin/students/${input.studentId}/plans`);

    return {
      success: true,
      mode: reorderResult.mode,
    };
  } catch (error) {
    logActionError(
      { domain: 'plan', action: 'executeUnifiedReorder' },
      error,
      { plannerId: input.plannerId, planDate: input.planDate }
    );
    return { success: false, error: '예기치 않은 오류가 발생했습니다.' };
  }
}

/**
 * 단일 아이템 시간 변경
 *
 * 빈 슬롯에 드롭했을 때 해당 시간에 아이템을 배치합니다.
 * recordId는 student_non_study_time 테이블의 UUID입니다.
 */
export async function updateItemTime(input: {
  studentId: string;
  plannerId: string;
  planDate: string;
  itemId: string;
  itemType: 'plan' | 'nonStudy';
  newStartTime: string;
  newEndTime: string;
  /** 비학습시간인 경우 student_non_study_time.id */
  recordId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: '인증되지 않은 사용자입니다.' };
    }

    if (input.itemType === 'plan') {
      // 플랜 시간 업데이트
      const { error } = await supabase
        .from('student_plan')
        .update({
          start_time: input.newStartTime,
          end_time: input.newEndTime,
        })
        .eq('id', input.itemId);

      if (error) {
        logActionError(
          { domain: 'plan', action: 'updateItemTime' },
          error,
          { itemId: input.itemId, itemType: input.itemType }
        );
        return { success: false, error: '플랜 업데이트에 실패했습니다.' };
      }
    } else if (input.itemType === 'nonStudy') {
      // student_non_study_time 테이블 직접 UPDATE
      if (!input.recordId) {
        logActionError(
          { domain: 'plan', action: 'updateItemTime' },
          new Error('recordId is required for nonStudy items'),
          { itemId: input.itemId, itemType: input.itemType }
        );
        return { success: false, error: '비학습시간 레코드 ID가 필요합니다.' };
      }

      const { error: updateError } = await supabase
        .from('student_non_study_time')
        .update({
          start_time: input.newStartTime + ':00', // HH:mm -> HH:mm:ss
          end_time: input.newEndTime + ':00',
        })
        .eq('id', input.recordId);

      if (updateError) {
        logActionError(
          { domain: 'plan', action: 'updateItemTime' },
          updateError,
          { itemId: input.itemId, recordId: input.recordId, itemType: input.itemType }
        );
        return { success: false, error: '비학습시간 업데이트에 실패했습니다.' };
      }
    }

    revalidatePath(`/admin/students/${input.studentId}/plans`);
    return { success: true };
  } catch (error) {
    logActionError(
      { domain: 'plan', action: 'updateItemTime' },
      error,
      { itemId: input.itemId, itemType: input.itemType }
    );
    return { success: false, error: '예기치 않은 오류가 발생했습니다.' };
  }
}
