'use client';

import { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import {
  DndContext as DndKitContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

// 기본 컨테이너 타입
export type BaseContainerType = 'unfinished' | 'daily' | 'weekly';

// 확장 컨테이너 타입 (날짜 기반 드롭 지원)
// 예: 'daily', 'daily-2025-01-05', 'weekly'
export type ContainerType = BaseContainerType | `daily-${string}`;

export interface DragItem {
  id: string;
  type: 'plan' | 'adhoc' | 'non_study';
  containerId: ContainerType;
  title: string;
  subject?: string;
  range?: string;
  planDate?: string; // 원본 플랜 날짜
  // 비학습시간 전용 필드
  nonStudyData?: {
    originalStartTime: string;
    originalEndTime: string;
    itemType: string; // '점심식사', '학원' 등
    sourceIndex?: number;
  };
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
}

const PlanDndContext = createContext<DndContextValue>({
  activeItem: null,
  overId: null,
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
}

export function PlanDndProvider({ children, onMoveItem, onReorderItems, onDropOnEmptySlot, onDropNonStudyTime }: PlanDndProviderProps) {
  const [activeItem, setActiveItem] = useState<DragItem | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const item = active.data.current as DragItem | undefined;
    if (item) {
      setActiveItem(item);
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || !activeItem) {
        setActiveItem(null);
        setOverId(null);
        return;
      }

      const overId = over.id as string;

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

        setActiveItem(null);
        setOverId(null);
        return;
      }

      // 빈 시간 슬롯에 드롭하는 경우 (empty-slot-HH:mm-HH:mm 형식)
      // 참고: non_study 타입은 위에서 이미 처리하고 return 했으므로 여기서는 plan 또는 adhoc만 해당
      if (overId.startsWith('empty-slot-') && onDropOnEmptySlot && activeItem.type !== 'non_study') {
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

        setActiveItem(null);
        setOverId(null);
        return;
      }

      // over.id가 컨테이너 ID인지 아이템 ID인지 판단
      // 컨테이너 ID: 'daily', 'weekly', 'unfinished', 'daily-YYYY-MM-DD'
      const isContainerDrop =
        overId === 'daily' ||
        overId === 'weekly' ||
        overId === 'unfinished' ||
        overId.startsWith('daily-');

      // 비학습시간은 컨테이너 간 이동 불가
      if (isContainerDrop && activeItem.type !== 'non_study') {
        const toContainer = overId;

        // 같은 컨테이너면 무시 (기존 동작)
        if (activeItem.containerId === toContainer) {
          setActiveItem(null);
          setOverId(null);
          return;
        }

        // 유효한 컨테이너인지 확인
        const baseType = getBaseContainerType(toContainer);
        const isValidContainer =
          baseType === 'unfinished' ||
          baseType === 'daily' ||
          baseType === 'weekly';

        if (!isValidContainer) {
          setActiveItem(null);
          setOverId(null);
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
      } else {
        // over.id가 아이템 ID인 경우 → 같은 컨테이너 내 재정렬
        // overId에서 실제 planId 추출 (형식: containerId-planId)
        const overPlanId = overId.includes('-')
          ? overId.substring(overId.lastIndexOf('-') + 1)
          : overId;

        // 같은 아이템이면 무시
        if (activeItem.id === overPlanId) {
          setActiveItem(null);
          setOverId(null);
          return;
        }

        // onReorderItems 콜백이 있고 containerId가 유효하면 재정렬 실행
        // 비학습시간은 재정렬 대상이 아님 (시간 조정은 별도 처리)
        if (onReorderItems && activeItem.containerId && activeItem.type !== 'non_study') {
          await onReorderItems(
            activeItem.containerId,
            activeItem.id,
            overPlanId
          );
        }
      }

      setActiveItem(null);
      setOverId(null);
    },
    [activeItem, onMoveItem, onReorderItems, onDropOnEmptySlot, onDropNonStudyTime]
  );

  const handleDragCancel = useCallback(() => {
    setActiveItem(null);
    setOverId(null);
  }, []);

  return (
    <PlanDndContext.Provider value={{ activeItem, overId }}>
      <DndKitContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay>
          {activeItem && (
            <div className={`rounded-lg p-3 shadow-lg border-2 opacity-90 ${
              activeItem.type === 'non_study'
                ? 'bg-amber-50 border-amber-400'
                : 'bg-white border-blue-500'
            }`}>
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
            </div>
          )}
        </DragOverlay>
      </DndKitContext>
    </PlanDndContext.Provider>
  );
}
