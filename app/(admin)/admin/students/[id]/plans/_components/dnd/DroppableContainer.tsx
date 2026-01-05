'use client';

import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/cn';
import type { ContainerType } from './DndContext';
import { usePlanDnd, getBaseContainerType, extractDateFromContainerId } from './DndContext';
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

interface DroppableDateCellProps {
  date: string; // YYYY-MM-DD 형식
  children: ReactNode;
  className?: string;
}

/**
 * 날짜별 드롭 가능 영역
 * 캘린더에서 특정 날짜로 플랜을 직접 드롭할 수 있게 합니다.
 */
export function DroppableDateCell({
  date,
  children,
  className,
}: DroppableDateCellProps) {
  const containerId = `daily-${date}` as ContainerType;

  const { setNodeRef, isOver } = useDroppable({
    id: containerId,
  });

  const { activeItem } = usePlanDnd();

  // 드래그 중이고 다른 컨테이너/날짜에서 온 경우에만 하이라이트
  const isValidDrop = activeItem && activeItem.containerId !== containerId;

  // 같은 날짜로 이동하는 경우도 체크 (날짜 추출해서 비교)
  const activeItemDate = activeItem
    ? extractDateFromContainerId(activeItem.containerId) || activeItem.planDate
    : null;
  const isSameDate = activeItemDate === date;

  const showHighlight = isValidDrop && !isSameDate;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-all duration-200',
        showHighlight && 'ring-2 ring-offset-1',
        showHighlight && isOver && 'ring-blue-500 bg-blue-100',
        showHighlight && !isOver && 'ring-gray-200',
        className
      )}
    >
      {children}
    </div>
  );
}
