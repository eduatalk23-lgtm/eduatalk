'use server';

/**
 * Legacy Bridge: dock.ts / unifiedReorder.ts 호환 API → calendar_events 테이블
 *
 * 기존 UI 컴포넌트가 사용하던 함수 시그니처를 유지하면서
 * 내부적으로 calendar_events 테이블에 쓰는 브릿지 레이어.
 *
 * 마이그레이션 완료 후 UI가 useCalendarMutations로 직접 호출하면 이 파일 제거 가능.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logActionError, logActionDebug } from '@/lib/logging/actionLogger';
import { calculateUnifiedReorder } from '@/lib/domains/plan/utils/unifiedReorderCalculation';
import type { EventStatus, ContainerType } from '../types';
import type {
  TimelineItem,
  UnifiedReorderInput,
  ReorderResult,
} from '@/lib/types/unifiedTimeline';

// ============================================
// Status 매핑
// ============================================

function mapPlanStatusToEventStatus(status: string): EventStatus {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'cancelled':
    case 'skipped':
      return 'cancelled';
    case 'in_progress':
    case 'draft':
      return 'tentative';
    case 'pending':
    default:
      return 'confirmed';
  }
}

// ============================================
// deletePlan → soft delete calendar_event
// ============================================

interface DeletePlanParams {
  planId: string;
  isAdHoc?: boolean;
  skipRevalidation?: boolean;
}

interface DeletePlanResult {
  success: boolean;
  error?: string;
}

export async function deletePlan({
  planId,
}: DeletePlanParams): Promise<DeletePlanResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('calendar_events')
      .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
      .eq('id', planId)
      .is('deleted_at', null);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================
// restoreEvent → undo soft delete
// ============================================

export async function restoreEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('calendar_events')
      .update({ deleted_at: null, status: 'confirmed' })
      .eq('id', eventId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================
// updatePlanStatus → update calendar_event status
// ============================================

interface UpdatePlanStatusParams {
  planId: string;
  status: string;
  isAdHoc?: boolean;
  skipRevalidation?: boolean;
}

interface UpdatePlanStatusResult {
  success: boolean;
  error?: string;
}

export async function updatePlanStatus({
  planId,
  status,
}: UpdatePlanStatusParams): Promise<UpdatePlanStatusResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const eventStatus = mapPlanStatusToEventStatus(status);

    const { error } = await supabase
      .from('calendar_events')
      .update({ status: eventStatus })
      .eq('id', planId)
      .is('deleted_at', null);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================
// movePlanToContainer → update container_type + date
// ============================================

interface MovePlanToContainerParams {
  planId: string;
  /** dock 컴포넌트 시그니처 */
  targetContainer?: ContainerType;
  targetDate?: string;
  isAdHoc?: boolean;
  skipRevalidation?: boolean;
  /** admin 컴포넌트 시그니처 (targetContainer 대체) */
  planType?: 'plan' | 'adhoc';
  fromContainer?: ContainerType;
  toContainer?: ContainerType;
  studentId?: string;
  tenantId?: string;
}

interface MovePlanToContainerResult {
  success: boolean;
  error?: string;
}

export async function movePlanToContainer({
  planId,
  targetContainer,
  toContainer,
  targetDate,
}: MovePlanToContainerParams): Promise<MovePlanToContainerResult> {
  try {
    const supabase = await createSupabaseServerClient();

    // targetContainer (dock) 또는 toContainer (admin) 중 하나 사용
    const effectiveContainer = targetContainer ?? toContainer;
    if (!effectiveContainer) {
      return { success: false, error: 'targetContainer or toContainer is required' };
    }

    const updateData: Record<string, unknown> = {
      container_type: effectiveContainer,
    };

    // 날짜 변경 시 start_at/start_date도 업데이트
    if (targetDate) {
      // 기존 이벤트 조회하여 시간 정보 유지
      const { data: event } = await supabase
        .from('calendar_events')
        .select('start_at, is_all_day')
        .eq('id', planId)
        .single();

      if (event?.is_all_day) {
        updateData.start_date = targetDate;
        updateData.end_date = targetDate;
      } else if (event?.start_at) {
        // 시간 부분만 추출하여 새 날짜에 적용
        const timeMatch = event.start_at.match(/T(.+)/);
        const timePart = timeMatch ? timeMatch[1] : '09:00:00+09:00';
        updateData.start_at = `${targetDate}T${timePart}`;
      } else {
        updateData.start_date = targetDate;
      }
    }

    const { error } = await supabase
      .from('calendar_events')
      .update(updateData)
      .eq('id', planId)
      .is('deleted_at', null);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================
// updateItemTime → update start_at/end_at + estimated_minutes
// ============================================

interface UpdateItemTimeParams {
  studentId: string;
  plannerId: string;
  planDate: string;
  itemId: string;
  itemType: 'plan' | 'nonStudy';
  newStartTime: string;    // HH:mm
  newEndTime: string;       // HH:mm
  recordId?: string;
  estimatedMinutes?: number;
}

interface UpdateItemTimeResult {
  success: boolean;
  error?: string;
}

export async function updateItemTime({
  planDate,
  itemId,
  newStartTime,
  newEndTime,
  estimatedMinutes,
}: UpdateItemTimeParams): Promise<UpdateItemTimeResult> {
  try {
    const supabase = await createSupabaseServerClient();

    // HH:mm → ISO timestamp (KST)
    const startAt = `${planDate}T${newStartTime}:00+09:00`;
    const endAt = `${planDate}T${newEndTime}:00+09:00`;

    const { error: eventError } = await supabase
      .from('calendar_events')
      .update({ start_at: startAt, end_at: endAt })
      .eq('id', itemId)
      .is('deleted_at', null);

    if (eventError) return { success: false, error: eventError.message };

    // estimated_minutes는 event_study_data에 저장
    if (estimatedMinutes !== undefined) {
      await supabase
        .from('event_study_data')
        .update({ estimated_minutes: estimatedMinutes })
        .eq('event_id', itemId);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================
// deletePlanWithLogging → soft delete (admin 호환)
// ============================================

interface DeletePlanWithLoggingParams {
  planId: string;
  planType: 'plan' | 'adhoc';
  studentId: string;
  tenantId: string;
  reason?: string;
}

export async function deletePlanWithLogging({
  planId,
}: DeletePlanWithLoggingParams): Promise<{ success: boolean; error?: string }> {
  // 내부적으로 soft-delete (deletePlan과 동일 로직)
  return deletePlan({ planId });
}

// ============================================
// executeUnifiedReorder → calendar_events 일괄 업데이트
// ============================================

interface UnifiedReorderResult {
  success: boolean;
  mode?: 'push' | 'pull';
  error?: string;
}

export async function executeUnifiedReorder(
  input: UnifiedReorderInput,
): Promise<UnifiedReorderResult> {
  try {
    const supabase = await createSupabaseServerClient();

    logActionDebug(
      { domain: 'calendar', action: 'executeUnifiedReorder' },
      `Reordering items for planner ${input.plannerId} on ${input.planDate}`,
      { plannerId: input.plannerId, planDate: input.planDate },
    );

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
      originalItems,
    );

    logActionDebug(
      { domain: 'calendar', action: 'executeUnifiedReorder' },
      `Reorder mode: ${reorderResult.mode}, items: ${reorderResult.items.length}`,
      { mode: reorderResult.mode, itemCount: reorderResult.items.length },
    );

    // 4. 모든 아이템 업데이트 (calendar_events 통합)
    const planDate = input.planDate;

    for (const item of reorderResult.items) {
      // empty 슬롯은 스킵
      if (item.id.startsWith('empty-')) continue;

      if (item.type === 'plan' && item.planId) {
        // 플랜: calendar_events.start_at/end_at 업데이트
        const startAt = `${planDate}T${item.startTime}:00+09:00`;
        const endAt = `${planDate}T${item.endTime}:00+09:00`;

        const { error } = await supabase
          .from('calendar_events')
          .update({ start_at: startAt, end_at: endAt })
          .eq('id', item.planId)
          .is('deleted_at', null);

        if (error) {
          logActionError(
            { domain: 'calendar', action: 'executeUnifiedReorder' },
            error,
            { planId: item.planId, step: 'updatePlan' },
          );
          return { success: false, error: '플랜 업데이트에 실패했습니다.' };
        }
      } else if (item.type === 'nonStudy') {
        // 비학습시간: 시간 변경된 경우만 업데이트
        const timeChanged =
          item.startTime !== item.originalStartTime ||
          item.endTime !== item.originalEndTime;
        if (!timeChanged) continue;

        // recordId 찾기 (input.orderedItems에서)
        const recordId = input.orderedItems.find(
          (oi) => oi.id === item.id && oi.type === 'nonStudy',
        )?.nonStudyData?.recordId;

        if (recordId) {
          const startAt = `${planDate}T${item.startTime}:00+09:00`;
          const endAt = `${planDate}T${item.endTime}:00+09:00`;

          const { error } = await supabase
            .from('calendar_events')
            .update({ start_at: startAt, end_at: endAt })
            .eq('id', recordId)
            .is('deleted_at', null);

          if (error) {
            logActionError(
              { domain: 'calendar', action: 'executeUnifiedReorder' },
              error,
              { itemId: item.id, recordId, step: 'updateNonStudy' },
            );
          }
        }
      }
    }

    return {
      success: true,
      mode: reorderResult.mode,
    };
  } catch (error) {
    logActionError(
      { domain: 'calendar', action: 'executeUnifiedReorder' },
      error,
      { plannerId: input.plannerId, planDate: input.planDate },
    );
    return { success: false, error: '예기치 않은 오류가 발생했습니다.' };
  }
}
