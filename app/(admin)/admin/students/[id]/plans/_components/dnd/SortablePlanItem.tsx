'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';
import type { DragItem, ContainerType } from './DndContext';

interface SortablePlanItemProps {
  id: string;
  disabled?: boolean;
  children: ReactNode;
  /** 드래그 데이터 (빈 슬롯 드롭 등에서 필요) */
  dragData?: {
    type: 'plan' | 'adhoc';
    containerId: ContainerType;
    title: string;
    subject?: string;
    range?: string;
    planDate?: string;
  };
}

/**
 * SortablePlanItem - @dnd-kit/sortable을 사용한 정렬 가능한 플랜 아이템 래퍼
 *
 * DraggablePlanItem과 달리 같은 컨테이너 내에서 순서 변경이 가능합니다.
 */
export function SortablePlanItem({
  id,
  disabled = false,
  children,
  dragData,
}: SortablePlanItemProps) {
  // DragItem 형식으로 data 구성
  const data: DragItem | undefined = dragData ? {
    id,
    type: dragData.type,
    containerId: dragData.containerId,
    title: dragData.title,
    subject: dragData.subject,
    range: dragData.range,
    planDate: dragData.planDate,
  } : undefined;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
    data,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-shadow',
        isDragging && 'opacity-50 shadow-lg z-50',
        !disabled && 'cursor-grab active:cursor-grabbing'
      )}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
