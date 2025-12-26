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

export type ContainerType = 'unfinished' | 'daily' | 'weekly';

export interface DragItem {
  id: string;
  type: 'plan' | 'adhoc';
  containerId: ContainerType;
  title: string;
  subject?: string;
  range?: string;
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
    toContainer: ContainerType
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

      const toContainer = over.id as ContainerType;

      // 같은 컨테이너면 무시
      if (activeItem.containerId === toContainer) {
        setActiveItem(null);
        setOverId(null);
        return;
      }

      // 유효한 컨테이너인지 확인
      if (!['unfinished', 'daily', 'weekly'].includes(toContainer)) {
        setActiveItem(null);
        setOverId(null);
        return;
      }

      await onMoveItem(
        activeItem.id,
        activeItem.type,
        activeItem.containerId,
        toContainer
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
