'use client';

import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/cn';
import { type ReactNode } from 'react';

interface DroppableEmptySlotProps {
  /** 드롭 영역 ID (unified-emptySlot-{startTime}-{endTime} 형식) */
  id: string;
  /** 슬롯 시간 정보 */
  slotTime: {
    startTime: string;
    endTime: string;
    durationMinutes: number;
  };
  /** 자식 요소 */
  children: ReactNode;
}

/**
 * DroppableEmptySlot - 빈 시간 슬롯 드롭 영역
 *
 * SortableContext에 포함되지 않아 갭 애니메이션이 발생하지 않습니다.
 * 드래그 아이템이 위에 올라오면 하이라이트만 표시됩니다.
 */
export function DroppableEmptySlot({
  id,
  slotTime,
  children,
}: DroppableEmptySlotProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: {
      type: 'emptySlot',
      slot: slotTime,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-all duration-150 rounded-lg',
        isOver && 'ring-2 ring-blue-500 bg-blue-50/50 scale-[1.02]'
      )}
    >
      {children}
    </div>
  );
}
