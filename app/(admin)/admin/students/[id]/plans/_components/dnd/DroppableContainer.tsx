'use client';

import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/cn';
import type { ContainerType } from './DndContext';
import { usePlanDnd } from './DndContext';
import { ReactNode } from 'react';

interface DroppableContainerProps {
  id: ContainerType;
  children: ReactNode;
  className?: string;
}

export function DroppableContainer({
  id,
  children,
  className,
}: DroppableContainerProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  const { activeItem } = usePlanDnd();

  // 드래그 중이고 다른 컨테이너에서 온 경우에만 하이라이트
  const isValidDrop = activeItem && activeItem.containerId !== id;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-all duration-200',
        isValidDrop && 'ring-2 ring-offset-2',
        isValidDrop && isOver && 'ring-blue-500 bg-blue-50/50',
        isValidDrop && !isOver && 'ring-gray-300',
        className
      )}
    >
      {children}
    </div>
  );
}
