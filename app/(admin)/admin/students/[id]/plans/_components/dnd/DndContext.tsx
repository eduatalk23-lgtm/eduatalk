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
  type: 'plan' | 'adhoc';
  containerId: ContainerType;
  title: string;
  subject?: string;
  range?: string;
  planDate?: string; // 원본 플랜 날짜
}

// 컨테이너 ID에서 날짜 추출 (없으면 null)
export function extractDateFromContainerId(containerId: string): string | null {
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

interface PlanDndProviderProps {
  children: ReactNode;
  onMoveItem: (
    itemId: string,
    itemType: 'plan' | 'adhoc',
    fromContainer: ContainerType,
    toContainer: ContainerType,
    targetDate?: string // 날짜 기반 드롭 시 대상 날짜
  ) => Promise<void>;
}

export function PlanDndProvider({ children, onMoveItem }: PlanDndProviderProps) {
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

      const toContainer = over.id as string;

      // 같은 컨테이너면 무시
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

      setActiveItem(null);
      setOverId(null);
    },
    [activeItem, onMoveItem]
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
            <div className="bg-white rounded-lg p-3 shadow-lg border-2 border-blue-500 opacity-90">
              <div className="font-medium text-sm">{activeItem.title}</div>
              {activeItem.subject && (
                <div className="text-xs text-gray-500">{activeItem.subject}</div>
              )}
              {activeItem.range && (
                <div className="text-xs text-gray-500">{activeItem.range}</div>
              )}
            </div>
          )}
        </DragOverlay>
      </DndKitContext>
    </PlanDndContext.Provider>
  );
}
