'use client';

import { useState, useCallback, useTransition, useMemo } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { TimeSlotBoundary, TimelineItem } from '@/lib/types/unifiedTimeline';
import { parseUnifiedId } from '@/lib/types/unifiedTimeline';
import {
  calculateUnifiedReorder,
  predictReorderMode,
  validateReorderResultConstraints,
} from '@/lib/domains/plan/utils/unifiedReorderCalculation';
import { executeUnifiedReorder, updateItemTime } from '@/lib/domains/plan/actions/unifiedReorder';
import type { UnifiedReorderData } from '../dnd';
import type { TimeSlot } from '@/lib/types/plan-generation';
import type { NonStudyItem } from '@/lib/query-options/adminDock';

/** MergedItem 타입 (DailyDock에서 사용하는 병합 아이템) */
export type MergedItemKind = 'plan' | 'nonStudy' | 'timeSlot' | 'emptySlot';

export interface MergedItemPlan {
  kind: 'plan';
  plan: {
    id: string;
    start_time?: string | null;
    end_time?: string | null;
    estimated_minutes?: number | null;
    status?: string | null;
    content_title?: string | null;
    custom_title?: string | null;
    content_subject?: string | null;
    [key: string]: unknown;
  };
  sortKey: number;
}

export interface MergedItemNonStudy {
  kind: 'nonStudy';
  item: NonStudyItem;
  sortKey: number;
}

export interface MergedItemTimeSlot {
  kind: 'timeSlot';
  slot: TimeSlot;
  sortKey: number;
  hasPlans: boolean;
}

export interface MergedItemEmptySlot {
  kind: 'emptySlot';
  slot: {
    startTime: string;
    endTime: string;
    durationMinutes: number;
  };
  sortKey: number;
}

export type MergedItem = MergedItemPlan | MergedItemNonStudy | MergedItemTimeSlot | MergedItemEmptySlot;

/** Optimistic 상태 타입 */
export interface OptimisticUnifiedOrder {
  items: Array<{
    id: string;
    kind: 'plan' | 'nonStudy';
    startTime: string;
    endTime: string;
  }>;
  mode: 'push' | 'pull';
}

/** 재정렬 입력 아이템 (서버 전달용) */
export interface ReorderInputItem {
  id: string;
  type: 'plan' | 'nonStudy';
  startTime: string;
  endTime: string;
  durationMinutes: number;
  planId?: string;
  nonStudyData?: {
    sourceIndex: number;
    originalType: string;
    originalStartTime: string;
    originalEndTime: string;
    /** 새 테이블 레코드 ID (student_non_study_time.id) */
    recordId?: string;
  };
}

interface UseUnifiedReorderOptions {
  studentId: string;
  plannerId?: string;
  selectedDate: string;
  timeSlots?: TimeSlot[];
  mergedItems: MergedItem[];
  isDndReorderEnabled: boolean;
  enableUnifiedReorder: boolean;
  onRefresh: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

/**
 * 시간 문자열(HH:mm)을 분 단위 숫자로 변환 (로컬 버전)
 */
function parseTime(t: string): number {
  if (!t) return 0;
  const [h, m] = t.substring(0, 5).split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * 통합 재정렬 기능을 제공하는 커스텀 훅
 *
 * DailyDock에서 플랜과 비학습시간을 함께 재정렬하는 로직을 분리
 */
export function useUnifiedReorder({
  studentId,
  plannerId,
  selectedDate,
  timeSlots,
  mergedItems,
  isDndReorderEnabled,
  enableUnifiedReorder,
  onRefresh,
  showToast,
}: UseUnifiedReorderOptions) {
  const [isPending, startTransition] = useTransition();

  // Optimistic update 상태
  const [optimisticUnifiedOrder, setOptimisticUnifiedOrder] = useState<OptimisticUnifiedOrder | null>(null);

  // 헬퍼: MergedItem에서 ID 추출
  // DailyDock.tsx와 동일한 로직 사용 (UUID 우선, sourceIndex 폴백)
  const getItemId = useCallback((item: MergedItem): string => {
    if (item.kind === 'plan') return item.plan.id;
    if (item.kind === 'nonStudy') {
      // 새 테이블 레코드 ID(UUID) 우선, 없으면 sourceIndex, 마지막으로 type-time 폴백
      return item.item.id ?? item.item.sourceIndex?.toString() ?? `${item.item.type}-${item.item.start_time}`;
    }
    if (item.kind === 'timeSlot') {
      return `slot-${item.slot.type}-${item.slot.start}`;
    }
    if (item.kind === 'emptySlot') {
      return `empty-${item.slot.startTime}-${item.slot.endTime}`;
    }
    return '';
  }, []);

  // 헬퍼: MergedItem에서 시간 추출
  const getItemTimes = useCallback((item: MergedItem) => {
    if (item.kind === 'plan') {
      return {
        startTime: item.plan.start_time?.substring(0, 5) ?? '',
        endTime: item.plan.end_time?.substring(0, 5) ?? '',
        durationMinutes: item.plan.estimated_minutes ?? 30,
      };
    }
    if (item.kind === 'nonStudy') {
      const start = parseTime(item.item.start_time);
      const end = parseTime(item.item.end_time);
      return {
        startTime: item.item.start_time.substring(0, 5),
        endTime: item.item.end_time.substring(0, 5),
        durationMinutes: end - start,
      };
    }
    if (item.kind === 'timeSlot') {
      const start = parseTime(item.slot.start);
      const end = parseTime(item.slot.end);
      return {
        startTime: item.slot.start.substring(0, 5),
        endTime: item.slot.end.substring(0, 5),
        durationMinutes: end - start,
      };
    }
    if (item.kind === 'emptySlot') {
      return {
        startTime: item.slot.startTime.substring(0, 5),
        endTime: item.slot.endTime.substring(0, 5),
        durationMinutes: item.slot.durationMinutes,
      };
    }
    return { startTime: '', endTime: '', durationMinutes: 0 };
  }, []);

  // 헬퍼: MergedItem을 ReorderInputItem으로 변환
  const toReorderInputItem = useCallback((item: MergedItem): ReorderInputItem => {
    const times = getItemTimes(item);
    if (item.kind === 'plan') {
      return {
        id: item.plan.id,
        type: 'plan' as const,
        startTime: times.startTime,
        endTime: times.endTime,
        durationMinutes: times.durationMinutes,
        planId: item.plan.id,
      };
    }
    if (item.kind === 'nonStudy') {
      // 새 테이블 레코드 ID(UUID) 우선, 없으면 sourceIndex 폴백
      const itemId = item.item.id ?? item.item.sourceIndex?.toString() ?? `${item.item.type}-${item.item.start_time}`;
      return {
        id: itemId,
        type: 'nonStudy' as const,
        startTime: times.startTime,
        endTime: times.endTime,
        durationMinutes: times.durationMinutes,
        nonStudyData: {
          sourceIndex: item.item.sourceIndex ?? -1,
          originalType: item.item.type,
          originalStartTime: item.item.start_time.substring(0, 5),
          originalEndTime: item.item.end_time.substring(0, 5),
          recordId: item.item.id, // 새 테이블 레코드 ID
        },
      };
    }
    if (item.kind === 'timeSlot') {
      return {
        id: `slot-${item.slot.type}-${item.slot.start}`,
        type: 'nonStudy' as const,
        startTime: times.startTime,
        endTime: times.endTime,
        durationMinutes: times.durationMinutes,
        nonStudyData: {
          sourceIndex: -1,
          originalType: item.slot.type,
          originalStartTime: item.slot.start.substring(0, 5),
          originalEndTime: item.slot.end.substring(0, 5),
        },
      };
    }
    // emptySlot (should not reach here in unified reorder)
    return {
      id: `empty-${times.startTime}`,
      type: 'nonStudy' as const,
      startTime: times.startTime,
      endTime: times.endTime,
      durationMinutes: times.durationMinutes,
    };
  }, [getItemTimes]);

  // 통합 재정렬 예상 모드 계산 (시각적 피드백용)
  const predictedReorderMode = useMemo<'push' | 'pull' | null>(() => {
    if (!enableUnifiedReorder || !isDndReorderEnabled) return null;

    // 첫 번째 학습시간 슬롯 찾기
    const learningSlot = timeSlots?.find(
      slot => slot.type === '학습시간' || slot.type === '자율학습'
    );
    if (!learningSlot) return null;

    // 현재 아이템들을 TimelineItem으로 변환
    const timelineItems: TimelineItem[] = mergedItems
      .filter(item => item.kind === 'plan' || item.kind === 'nonStudy' || item.kind === 'timeSlot')
      .map(item => {
        if (item.kind === 'plan') {
          return {
            id: item.plan.id,
            type: 'plan' as const,
            startTime: item.plan.start_time?.substring(0, 5) ?? '',
            endTime: item.plan.end_time?.substring(0, 5) ?? '',
            durationMinutes: item.plan.estimated_minutes ?? 30,
            planId: item.plan.id,
          };
        }
        if (item.kind === 'nonStudy') {
          const start = parseTime(item.item.start_time);
          const end = parseTime(item.item.end_time);
          return {
            id: item.item.sourceIndex?.toString() ?? `${item.item.type}-${item.item.start_time}`,
            type: 'nonStudy' as const,
            startTime: item.item.start_time.substring(0, 5),
            endTime: item.item.end_time.substring(0, 5),
            durationMinutes: end - start,
            nonStudyType: item.item.type,
            sourceIndex: item.item.sourceIndex,
          };
        }
        // timeSlot
        const start = parseTime(item.slot.start);
        const end = parseTime(item.slot.end);
        return {
          id: `slot-${item.slot.type}-${item.slot.start}`,
          type: 'nonStudy' as const,
          startTime: item.slot.start.substring(0, 5),
          endTime: item.slot.end.substring(0, 5),
          durationMinutes: end - start,
          nonStudyType: item.slot.type,
        };
      });

    if (timelineItems.length === 0) return null;

    const slotBoundary: TimeSlotBoundary = {
      type: learningSlot.type as '학습시간' | '자율학습',
      start: learningSlot.start,
      end: learningSlot.end,
      capacityMinutes: parseTime(learningSlot.end) - parseTime(learningSlot.start),
    };

    return predictReorderMode(timelineItems, slotBoundary);
  }, [enableUnifiedReorder, isDndReorderEnabled, timeSlots, mergedItems]);

  // 통합 재정렬 핸들러
  const handleUnifiedReorder = useCallback(
    async (data: UnifiedReorderData) => {
      if (!plannerId) return;

      // 빈 슬롯에 드롭한 경우: 재정렬 대신 직접 시간 변경
      if (data.overItemType === 'emptySlot' && data.targetSlotTime) {
        console.log('[useUnifiedReorder] Empty slot drop detected:', data);

        // 이동한 아이템 찾기
        const movedItem = mergedItems.find(item => {
          if (data.movedItemType === 'plan' && item.kind === 'plan') {
            return item.plan.id === data.movedItemId;
          }
          if (data.movedItemType === 'nonStudy') {
            if (item.kind === 'nonStudy') {
              // UUID 직접 비교 또는 기존 방식
              return item.item.id === data.movedItemId ||
                     item.item.sourceIndex?.toString() === data.movedItemId ||
                     `${item.item.type}-${item.item.start_time}` === data.movedItemId;
            }
            if (item.kind === 'timeSlot') {
              return `slot-${item.slot.type}-${item.slot.start}` === data.movedItemId;
            }
          }
          return false;
        });

        if (!movedItem) {
          console.log('[useUnifiedReorder] Moved item not found:', data.movedItemId);
          showToast('이동할 아이템을 찾을 수 없습니다.', 'error');
          return;
        }

        console.log('[useUnifiedReorder] Found moved item:', movedItem);

        // 아이템 정보 추출
        const itemType = data.movedItemType;
        let itemId: string;
        let recordId: string | undefined;

        if (movedItem.kind === 'plan') {
          itemId = movedItem.plan.id;
        } else if (movedItem.kind === 'nonStudy') {
          itemId = movedItem.item.id ?? movedItem.item.sourceIndex?.toString() ?? `${movedItem.item.type}-${movedItem.item.start_time}`;
          recordId = movedItem.item.id; // UUID
        } else if (movedItem.kind === 'timeSlot') {
          itemId = `slot-${movedItem.slot.type}-${movedItem.slot.start}`;
          // timeSlot은 레거시 모드이므로 recordId 없음
        } else {
          showToast('지원하지 않는 아이템 타입입니다.', 'error');
          return;
        }

        // 서버 액션 호출
        startTransition(async () => {
          console.log('[useUnifiedReorder] Calling updateItemTime:', {
            studentId,
            plannerId,
            planDate: selectedDate,
            itemId,
            itemType,
            newStartTime: data.targetSlotTime!.start,
            newEndTime: data.targetSlotTime!.end,
            recordId,
          });

          const result = await updateItemTime({
            studentId,
            plannerId,
            planDate: selectedDate,
            itemId,
            itemType,
            newStartTime: data.targetSlotTime!.start,
            newEndTime: data.targetSlotTime!.end,
            recordId,
          });

          if (!result.success) {
            showToast(result.error ?? '시간 변경에 실패했습니다.', 'error');
            return;
          }

          showToast('시간이 변경되었습니다.', 'success');
          onRefresh();
        });

        return;
      }

      // 현재 mergedItems에서 재정렬 대상 아이템만 추출
      const sortableItems = mergedItems.filter(
        (item): item is MergedItem & { kind: 'plan' | 'nonStudy' | 'timeSlot' } =>
          item.kind === 'plan' || item.kind === 'nonStudy' || item.kind === 'timeSlot'
      );

      // unified ID 파싱 (unified-{type}-{id} 형식에서 원본 ID 추출)
      const parsedMovedId = parseUnifiedId(data.movedItemId);
      const parsedOverId = parseUnifiedId(data.overItemId);
      const movedOriginalId = parsedMovedId?.originalId ?? data.movedItemId;
      const overOriginalId = parsedOverId?.originalId ?? data.overItemId;

      // 이동한 아이템의 원래 인덱스 찾기
      const movedItemIndex = sortableItems.findIndex(item => {
        if (data.movedItemType === 'plan' && item.kind === 'plan') {
          return item.plan.id === movedOriginalId;
        }
        if (data.movedItemType === 'nonStudy') {
          if (item.kind === 'nonStudy') {
            // UUID 직접 비교 우선 (새 테이블), 그 다음 레거시 방식
            return item.item.id === movedOriginalId ||
                   item.item.sourceIndex?.toString() === movedOriginalId ||
                   `${item.item.type}-${item.item.start_time}` === movedOriginalId;
          }
          if (item.kind === 'timeSlot') {
            return `slot-${item.slot.type}-${item.slot.start}` === movedOriginalId;
          }
        }
        return false;
      });

      // 드롭 위치 아이템의 인덱스 찾기
      const overItemIndex = sortableItems.findIndex(item => {
        if (data.overItemType === 'plan' && item.kind === 'plan') {
          return item.plan.id === overOriginalId;
        }
        if (data.overItemType === 'nonStudy') {
          if (item.kind === 'nonStudy') {
            // UUID 직접 비교 우선 (새 테이블), 그 다음 레거시 방식
            return item.item.id === overOriginalId ||
                   item.item.sourceIndex?.toString() === overOriginalId ||
                   `${item.item.type}-${item.item.start_time}` === overOriginalId;
          }
          if (item.kind === 'timeSlot') {
            return `slot-${item.slot.type}-${item.slot.start}` === overOriginalId;
          }
        }
        return false;
      });

      if (movedItemIndex === -1 || overItemIndex === -1) return;

      // 아이템을 새 순서로 재배열
      const reorderedItems = arrayMove(sortableItems, movedItemIndex, overItemIndex);

      // 현재 시간 슬롯 경계 계산 (첫 번째 학습시간 슬롯 기준)
      const learningSlot = timeSlots?.find(slot => slot.type === '학습시간' || slot.type === '자율학습');
      if (!learningSlot) {
        showToast('학습시간 슬롯이 설정되지 않았습니다.', 'error');
        return;
      }

      const slotBoundary: TimeSlotBoundary = {
        type: learningSlot.type as '학습시간' | '자율학습',
        start: learningSlot.start,
        end: learningSlot.end,
        capacityMinutes: parseTime(learningSlot.end) - parseTime(learningSlot.start),
      };

      // TimelineItem 형식으로 변환 (클라이언트 계산용)
      const timelineItems: TimelineItem[] = reorderedItems.map(item => {
        const times = getItemTimes(item);
        return {
          id: getItemId(item),
          type: item.kind === 'plan' ? 'plan' : 'nonStudy',
          startTime: times.startTime,
          endTime: times.endTime,
          durationMinutes: times.durationMinutes,
          planId: item.kind === 'plan' ? item.plan.id : undefined,
          nonStudyType: item.kind === 'nonStudy' ? item.item.type : item.kind === 'timeSlot' ? item.slot.type : undefined,
          sourceIndex: item.kind === 'nonStudy' ? item.item.sourceIndex : undefined,
        };
      });

      // 원본 TimelineItem (이동 전 순서)
      const originalTimelineItems: TimelineItem[] = sortableItems.map(item => {
        const times = getItemTimes(item);
        return {
          id: getItemId(item),
          type: item.kind === 'plan' ? 'plan' : 'nonStudy',
          startTime: times.startTime,
          endTime: times.endTime,
          durationMinutes: times.durationMinutes,
          planId: item.kind === 'plan' ? item.plan.id : undefined,
          nonStudyType: item.kind === 'nonStudy' ? item.item.type : item.kind === 'timeSlot' ? item.slot.type : undefined,
          sourceIndex: item.kind === 'nonStudy' ? item.item.sourceIndex : undefined,
        };
      });

      console.log('[useUnifiedReorder] ID parsing:', {
        original: data.movedItemId,
        parsedMovedId: movedOriginalId,
        parsedOverId: overOriginalId,
      });

      // 클라이언트에서 새 시간 계산 (Optimistic Update용)
      const reorderResult = calculateUnifiedReorder(
        timelineItems,
        slotBoundary,
        movedOriginalId,
        originalTimelineItems
      );

      // 비학습시간 제약 검증 및 경고 표시
      const constraintWarnings = validateReorderResultConstraints(reorderResult);
      if (constraintWarnings.length > 0) {
        // 가장 심각한 경고 하나만 표시 (error > warning > info)
        const severityOrder = { error: 0, warning: 1, info: 2 };
        const sortedWarnings = constraintWarnings.sort(
          (a, b) => severityOrder[a.severity ?? 'info'] - severityOrder[b.severity ?? 'info']
        );
        const topWarning = sortedWarnings[0];
        if (topWarning.warning) {
          // 경고는 표시하되 작업은 계속 진행
          showToast(topWarning.warning, topWarning.severity === 'error' ? 'error' : 'success');
        }
      }

      // Optimistic Update: UI 즉시 반영
      setOptimisticUnifiedOrder({
        items: reorderResult.items.map(item => ({
          id: item.id,
          kind: item.type === 'plan' ? 'plan' : 'nonStudy',
          startTime: item.startTime,
          endTime: item.endTime,
        })),
        mode: reorderResult.mode,
      });

      // 서버 액션에 전달할 orderedItems (드래그 후 순서)
      const orderedItems = reorderedItems.map(toReorderInputItem);

      // 서버 액션에 전달할 originalItems (드래그 전 순서)
      const originalItems = sortableItems.map(toReorderInputItem);

      startTransition(async () => {
        const result = await executeUnifiedReorder({
          studentId,
          plannerId,
          planDate: selectedDate,
          orderedItems,
          originalItems,
          slotBoundary,
          movedItemId: movedOriginalId,
          insertIndex: overItemIndex,
        });

        if (!result.success) {
          // 실패 시 롤백
          setOptimisticUnifiedOrder(null);
          showToast(result.error ?? '재정렬에 실패했습니다.', 'error');
          return;
        }

        // 성공 시 새로고침하여 서버 데이터 반영
        showToast(
          result.mode === 'push' ? '아이템이 밀렸습니다.' : '아이템이 당겨졌습니다.',
          'success'
        );
        setOptimisticUnifiedOrder(null);
        onRefresh();
      });
    },
    [plannerId, mergedItems, timeSlots, studentId, selectedDate, showToast, onRefresh, getItemId, getItemTimes, toReorderInputItem]
  );

  // Optimistic 상태 초기화 함수
  const resetOptimisticState = useCallback(() => {
    setOptimisticUnifiedOrder(null);
  }, []);

  return {
    isPending,
    optimisticUnifiedOrder,
    predictedReorderMode,
    handleUnifiedReorder,
    resetOptimisticState,
    getItemId,
    getItemTimes,
    toReorderInputItem,
  };
}
