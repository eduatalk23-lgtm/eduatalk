'use client';

import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/cn';
import type { ContainerType, DragItem } from './DndContext';
import { ReactNode } from 'react';

interface DraggablePlanItemProps {
  id: string;
  type: 'plan' | 'adhoc';
  containerId: ContainerType;
  title: string;
  subject?: string;
  range?: string;
  planDate?: string;
  disabled?: boolean;
  children: ReactNode;
}

export function DraggablePlanItem({
  id,
  type,
  containerId,
  title,
  subject,
  range,
  planDate,
  disabled = false,
  children,
}: DraggablePlanItemProps) {
  const dragData: DragItem = {
    id,
    type,
    containerId,
    title,
    subject,
    range,
    planDate,
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${containerId}-${id}`,
    data: dragData,
    disabled,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex-1 transition-shadow',
        isDragging && 'opacity-50 shadow-lg z-50',
        !disabled && 'cursor-grab active:cursor-grabbing'
      )}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}
