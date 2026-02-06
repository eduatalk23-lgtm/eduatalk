'use client';

import { createContext, useContext, ReactNode, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  DndContext as DndKitContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragMoveEvent,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
} from '@dnd-kit/core';
import type { PlanItemData } from '@/lib/types/planItem';
import type { TimelineItem, TimeSlotBoundary } from '@/lib/types/unifiedTimeline';
import { predictReorderMode } from '@/lib/domains/plan/utils/unifiedReorderCalculation';
import { parseUnifiedId } from './SortableUnifiedItem';

// 기본 컨테이너 타입
export type BaseContainerType = 'unfinished' | 'daily' | 'weekly';

// 확장 컨테이너 타입 (날짜 기반 드롭 지원)
// 예: 'daily', 'daily-2025-01-05', 'weekly'
export type ContainerType = BaseContainerType | `daily-${string}`;

export interface DragItem {
  id: string;
  type: 'plan' | 'adhoc' | 'non_study' | 'unified';
  containerId: ContainerType;
  title: string;
  subject?: string;
  range?: string;
  planDate?: string; // 원본 플랜 날짜
  planData?: PlanItemData; // 오버레이용 전체 데이터
  // 비학습시간 전용 필드
  nonStudyData?: {
    originalStartTime: string;
    originalEndTime: string;
    itemType: string; // '점심식사', '학원' 등
    sourceIndex?: number;
    /** 새 테이블 레코드 ID (student_non_study_time.id) */
    recordId?: string;
  };
  // 통합 아이템 필드 (SortableUnifiedItem에서 사용)
  unifiedId?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
}

// 컨테이너 ID에서 날짜 추출 (없으면 null)
export function extractDateFromContainerId(containerId: string | undefined | null): string | null {
  if (!containerId) return null;
  if (containerId.startsWith('daily-')) {
    return containerId.slice(6); // 'daily-' 이후 부분
  }
  return null;
}

// 컨테이너의 기본 타입 추출
export function getBaseContainerType(containerId: string): BaseContainerType {
  if (containerId === 'unfinished') return 'unfinished';
  if (containerId === 'weekly') return 'weekly';
  return 'daily'; // 'daily' 또는 'daily-YYYY-MM-DD'
}

interface DndContextValue {
  activeItem: DragItem | null;
  overId: string | null;
  /** 통합 재정렬 예상 모드 ('push' | 'pull' | null) */
  unifiedReorderMode: 'push' | 'pull' | null;
}

const PlanDndContext = createContext<DndContextValue>({
  activeItem: null,
  overId: null,
  unifiedReorderMode: null,
});

export function usePlanDnd() {
  return useContext(PlanDndContext);
}

/** 빈 시간 슬롯 정보 */
export interface EmptySlotDropData {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

/** 비학습시간 드롭 데이터 */
export interface NonStudyDropData {
  originalStartTime: string;
  originalEndTime: string;
  newStartTime: string;
  itemType: string;
  sourceIndex?: number;
}

/** 통합 재정렬 드롭 데이터 */
export interface UnifiedReorderData {
  /** 이동한 아이템 ID */
  movedItemId: string;
  /** 이동한 아이템의 통합 타입 */
  movedItemType: 'plan' | 'nonStudy';
  /** 드롭 위치의 아이템 ID */
  overItemId: string;
  /** 드롭 위치의 통합 타입 */
  overItemType: 'plan' | 'nonStudy' | 'emptySlot';
  /** 빈 시간 슬롯에 드롭한 경우의 타겟 시간 */
  targetSlotTime?: { start: string; end: string };
}

interface PlanDndProviderProps {
  children: ReactNode;
  onMoveItem: (
    itemId: string,
    itemType: 'plan' | 'adhoc',
    fromContainer: ContainerType,
    toContainer: ContainerType,
    targetDate?: string // 날짜 기반 드롭 시 대상 날짜
  ) => Promise<void>;
  /** 같은 컨테이너 내에서 아이템 재정렬 시 호출 */
  onReorderItems?: (
    containerId: ContainerType,
    activeId: string,
    overId: string
  ) => Promise<void>;
  /** 빈 시간 슬롯에 드롭 시 호출 (해당 시간에 플랜 배치) */
  onDropOnEmptySlot?: (
    itemId: string,
    itemType: 'plan' | 'adhoc',
    fromContainer: ContainerType,
    slotData: EmptySlotDropData
  ) => Promise<void>;
  /** 비학습시간 드래그 후 드롭 시 호출 (시간 조정) */
  onDropNonStudyTime?: (dropData: NonStudyDropData) => void;
  /** 통합 재정렬 시 호출 (플랜 + 비학습시간 함께 재정렬) */
  onUnifiedReorder?: (data: UnifiedReorderData) => Promise<void>;
  /** 통합 재정렬용 슬롯 경계 정보 */
  unifiedSlotBoundary?: TimeSlotBoundary | null;
  /** 통합 재정렬용 타임라인 아이템 목록 */
  unifiedTimelineItems?: TimelineItem[];
}

export function PlanDndProvider({
  children,
  onMoveItem,
  onReorderItems,
  onDropOnEmptySlot,
  onDropNonStudyTime,
  onUnifiedReorder,
  unifiedSlotBoundary,
  unifiedTimelineItems,
}: PlanDndProviderProps) {
  const [activeItem, setActiveItem] = useState<DragItem | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // 통합 재정렬 예상 모드 (드래그 중에만 유효)
  const unifiedReorderMode = useMemo<'push' | 'pull' | null>(() => {
    // unified 아이템 드래그 중이고, 슬롯 경계와 아이템 정보가 있을 때만 계산
    if (!activeItem?.unifiedId || !unifiedSlotBoundary || !unifiedTimelineItems?.length) {
      return null;
    }
    return predictReorderMode(unifiedTimelineItems, unifiedSlotBoundary);
  }, [activeItem?.unifiedId, unifiedSlotBoundary, unifiedTimelineItems]);

  // 커서 위치 추적 (DragOverlay 위치 보정용)
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const initialCursorRef = useRef<{ x: number; y: number } | null>(null);

  // 초기 마운트 후 DndKitContext 재마운트 (React 19 + CSS 트랜지션 호환성)
  // CSS 레이아웃이 안정화된 후 @dnd-kit이 정확한 rect를 측정하도록 함
  const [dndKey, setDndKey] = useState(0);
  useEffect(() => {
    // CSS 트랜지션 완료 후 (300ms) + 여유 시간
    const timer = setTimeout(() => {
      setDndKey(1);
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  // MouseSensor + TouchSensor 사용 (PointerSensor 대신, React 19 호환성 개선)
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // 측정 설정: 드래그 시작 시 한 번만 측정 (React 19 Concurrent Mode 호환)
  const measuring = useMemo(() => ({
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  }), []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active, activatorEvent } = event;
    const item = active.data.current as DragItem | undefined;

    if (item) {
      setActiveItem(item);
      // 드래그 시작 시 초기 커서 위치 저장
      const pointerEvent = activatorEvent as PointerEvent | MouseEvent | TouchEvent;
      if ('clientX' in pointerEvent) {
        initialCursorRef.current = { x: pointerEvent.clientX, y: pointerEvent.clientY };
        setCursorPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY });
      }
    }
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    // 드래그 중 커서 위치 업데이트
    const { delta } = event;
    if (initialCursorRef.current) {
      setCursorPosition({
        x: initialCursorRef.current.x + delta.x,
        y: initialCursorRef.current.y + delta.y,
      });
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  }, []);

  // 드래그 종료 시 상태 정리 헬퍼
  const clearDragState = useCallback(() => {
    setActiveItem(null);
    setOverId(null);
    setCursorPosition(null);
    initialCursorRef.current = null;
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || !activeItem) {
        clearDragState();
        return;
      }

      const overId = over.id as string;

      // 통합 재정렬 처리 (unified- 접두사로 시작하는 아이템)
      if (overId.startsWith('unified-') && onUnifiedReorder) {
        const activeUnified = parseUnifiedId(active.id as string);
        const overUnified = parseUnifiedId(overId);

        // empty 타입은 드래그할 수 없음 (드롭 타겟만 가능)
        if (!activeUnified || activeUnified.type === 'empty') {
          clearDragState();
          return;
        }

        if (overUnified) {
          // movedItemType은 'plan' | 'nonStudy'만 가능
          const movedItemType = activeUnified.type as 'plan' | 'nonStudy';
          // overItemType: empty → emptySlot으로 매핑
          const overItemType = overUnified.type === 'empty' ? 'emptySlot' : overUnified.type as 'plan' | 'nonStudy';

          await onUnifiedReorder({
            movedItemId: activeUnified.originalId,
            movedItemType,
            overItemId: overUnified.originalId,
            overItemType,
          });
          clearDragState();
          return;
        }
      }

      // 비학습시간 드래그 처리
      if (activeItem.type === 'non_study' && activeItem.nonStudyData && onDropNonStudyTime) {
        // 빈 시간 슬롯에 드롭한 경우
        if (overId.startsWith('empty-slot-')) {
          const slotInfo = over.data.current as { type: string; slot?: EmptySlotDropData } | undefined;
          if (slotInfo?.slot) {
            onDropNonStudyTime({
              originalStartTime: activeItem.nonStudyData.originalStartTime,
              originalEndTime: activeItem.nonStudyData.originalEndTime,
              newStartTime: slotInfo.slot.startTime,
              itemType: activeItem.nonStudyData.itemType,
              sourceIndex: activeItem.nonStudyData.sourceIndex,
            });
          }
        }
        // 다른 위치에 드롭한 경우 (플랜 아이템 위 등) - 해당 아이템의 시간을 기준으로
        else if (!overId.startsWith('daily') && !overId.startsWith('weekly') && overId !== 'unfinished') {
          // over.data.current에서 planDate 또는 start_time 정보가 있으면 활용
          const overData = over.data.current as { startTime?: string } | undefined;
          if (overData?.startTime) {
            onDropNonStudyTime({
              originalStartTime: activeItem.nonStudyData.originalStartTime,
              originalEndTime: activeItem.nonStudyData.originalEndTime,
              newStartTime: overData.startTime,
              itemType: activeItem.nonStudyData.itemType,
              sourceIndex: activeItem.nonStudyData.sourceIndex,
            });
          }
        }

        clearDragState();
        return;
      }

      // 빈 시간 슬롯에 드롭하는 경우 (empty-slot-HH:mm-HH:mm 형식)
      // 참고: non_study, unified 타입은 별도 처리되므로 여기서는 plan 또는 adhoc만 해당
      if (
        overId.startsWith('empty-slot-') &&
        onDropOnEmptySlot &&
        (activeItem.type === 'plan' || activeItem.type === 'adhoc')
      ) {
        // over.data.current에서 슬롯 정보 추출
        const slotInfo = over.data.current as { type: string; slot?: EmptySlotDropData } | undefined;

        if (slotInfo?.slot) {
          await onDropOnEmptySlot(
            activeItem.id,
            activeItem.type,
            activeItem.containerId,
            slotInfo.slot
          );
        }

        clearDragState();
        return;
      }

      // over.id가 컨테이너 ID인지 아이템 ID인지 판단
      // 컨테이너 ID: 'daily', 'weekly', 'unfinished', 'daily-YYYY-MM-DD'
      const isContainerDrop =
        overId === 'daily' ||
        overId === 'weekly' ||
        overId === 'unfinished' ||
        overId.startsWith('daily-');

      // 컨테이너 간 이동: plan, adhoc만 가능 (non_study, unified는 컨테이너 간 이동 불가)
      if (
        isContainerDrop &&
        (activeItem.type === 'plan' || activeItem.type === 'adhoc')
      ) {
        const toContainer = overId;

        // 같은 컨테이너면 무시 (기존 동작)
        if (activeItem.containerId === toContainer) {
          clearDragState();
          return;
        }

        // 유효한 컨테이너인지 확인
        const baseType = getBaseContainerType(toContainer);
        const isValidContainer =
          baseType === 'unfinished' ||
          baseType === 'daily' ||
          baseType === 'weekly';

        if (!isValidContainer) {
          clearDragState();
          return;
        }

        // 날짜 기반 드롭인 경우 날짜 추출
        const targetDate = extractDateFromContainerId(toContainer);

        await onMoveItem(
          activeItem.id,
          activeItem.type,
          activeItem.containerId,
          toContainer as ContainerType,
          targetDate ?? undefined
        );
      } else if (!isContainerDrop) {
        // over.id가 아이템 ID인 경우 → 같은 컨테이너 내 재정렬
        // overId에서 실제 planId 추출 (형식: containerId-planId)
        const overPlanId = overId.includes('-')
          ? overId.substring(overId.lastIndexOf('-') + 1)
          : overId;

        // 같은 아이템이면 무시
        if (activeItem.id === overPlanId) {
          clearDragState();
          return;
        }

        // onReorderItems 콜백이 있고 containerId가 유효하면 재정렬 실행
        // 비학습시간, unified는 재정렬 대상이 아님 (시간 조정은 별도 처리)
        if (
          onReorderItems &&
          activeItem.containerId &&
          (activeItem.type === 'plan' || activeItem.type === 'adhoc')
        ) {
          await onReorderItems(
            activeItem.containerId,
            activeItem.id,
            overPlanId
          );
        }
      }

      clearDragState();
    },
    [activeItem, clearDragState, onMoveItem, onReorderItems, onDropOnEmptySlot, onDropNonStudyTime, onUnifiedReorder]
  );

  const handleDragCancel = useCallback(() => {
    clearDragState();
  }, [clearDragState]);

  // 컨텍스트 값 메모이제이션 (불필요한 리렌더링 방지)
  const contextValue = useMemo(() => ({ activeItem, overId, unifiedReorderMode }), [activeItem, overId, unifiedReorderMode]);

  return (
    <PlanDndContext.Provider value={contextValue}>
      <DndKitContext
        key={dndKey}
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={measuring}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        {/* 커스텀 드래그 오버레이 - 커서 위치 직접 추적 (React 19 호환) */}
        {activeItem && cursorPosition && (
          <div
            style={{
              position: 'fixed',
              left: cursorPosition.x,
              top: cursorPosition.y,
              transform: 'translate(-50%, -50%)',
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          >
            <div className={`rounded-lg p-3 shadow-lg border-2 opacity-90 ${
              // 통합 재정렬 모드에 따른 테두리 색상
              unifiedReorderMode === 'push'
                ? 'bg-green-50 border-green-500'
                : unifiedReorderMode === 'pull'
                ? 'bg-orange-50 border-orange-500'
                : activeItem.type === 'non_study' || (activeItem.unifiedId?.includes('nonStudy'))
                ? 'bg-amber-50 border-amber-400'
                : 'bg-white border-blue-500'
            }`}>
              {/* 통합 재정렬 모드 배지 */}
              {unifiedReorderMode && (
                <div className={`text-xs font-semibold px-2 py-0.5 rounded-full mb-2 inline-flex items-center gap-1 ${
                  unifiedReorderMode === 'push'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-orange-100 text-orange-700'
                }`}>
                  {unifiedReorderMode === 'push' ? (
                    <>
                      <span>→</span>
                      <span>밀기</span>
                    </>
                  ) : (
                    <>
                      <span>←</span>
                      <span>당기기</span>
                    </>
                  )}
                </div>
              )}
              <div className="font-medium text-sm">{activeItem.title}</div>
              {activeItem.subject && (
                <div className="text-xs text-gray-500">{activeItem.subject}</div>
              )}
              {activeItem.range && (
                <div className="text-xs text-gray-500">{activeItem.range}</div>
              )}
              {activeItem.nonStudyData && (
                <div className="text-xs text-gray-500">
                  {activeItem.nonStudyData.originalStartTime} ~ {activeItem.nonStudyData.originalEndTime}
                </div>
              )}
              {activeItem.startTime && activeItem.endTime && !activeItem.nonStudyData && (
                <div className="text-xs text-gray-500">
                  {activeItem.startTime} ~ {activeItem.endTime}
                </div>
              )}
              {/* 예상 소요 시간 */}
              {activeItem.durationMinutes && (
                <div className="text-xs text-gray-400 mt-1">
                  ⏱ {activeItem.durationMinutes}분
                </div>
              )}
            </div>
          </div>
        )}
      </DndKitContext>
    </PlanDndContext.Provider>
  );
}
