'use client';

import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';
import type { DragItem } from './DndContext';

interface DraggableNonStudyItemProps {
  id: string;
  disabled?: boolean;
  children: ReactNode;
  /** 드래그 데이터 */
  dragData: {
    title: string;
    itemType: string; // '점심식사', '학원' 등
    originalStartTime: string;
    originalEndTime: string;
    sourceIndex?: number;
  };
}

/**
 * DraggableNonStudyItem - 드래그 가능한 비학습시간 아이템 래퍼
 *
 * NonStudyTimeCard를 드래그 가능하게 만들어 시간 조정을 지원합니다.
 */
export function DraggableNonStudyItem({
  id,
  disabled = false,
  children,
  dragData,
}: DraggableNonStudyItemProps) {
  // DragItem 형식으로 data 구성
  const data: DragItem = {
    id,
    type: 'non_study',
    containerId: 'daily',
    title: dragData.title,
    nonStudyData: {
      originalStartTime: dragData.originalStartTime,
      originalEndTime: dragData.originalEndTime,
      itemType: dragData.itemType,
      sourceIndex: dragData.sourceIndex,
    },
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id,
    disabled,
    data,
  });

  return (
    <div
      ref={setNodeRef}
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
