'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/cn';
import { type ReactNode, useMemo } from 'react';
import type { UnifiedDragData } from '@/lib/types/unifiedTimeline';
import {
  createUnifiedId,
  parseUnifiedId,
} from '@/lib/types/unifiedTimeline';
import { usePlanDnd } from './DndContext';

// 재사용을 위해 re-export
export { createUnifiedId, parseUnifiedId };

interface SortableUnifiedItemProps {
  /** 통합 아이템 ID (unified-plan-{id} 또는 unified-nonStudy-{index}) */
  id: string;
  /** 드래그 비활성화 여부 */
  disabled?: boolean;
  /** 자식 요소 */
  children: ReactNode;
  /** 드래그 데이터 */
  dragData: UnifiedDragData;
  /** 재정렬 예상 모드 (부모에서 계산하여 전달) */
  reorderMode?: 'push' | 'pull' | null;
}

/**
 * SortableUnifiedItem - 통합 타임라인 정렬 가능 아이템 래퍼
 *
 * 플랜과 비학습시간 모두 이 컴포넌트로 래핑하여
 * 하나의 SortableContext에서 정렬할 수 있습니다.
 *
 * 시각적 피드백:
 * - 드래그 중: opacity 감소
 * - hover 시 (isOver): 모드에 따른 테두리 색상
 *   - Push 모드: 녹색 테두리 (여유 있음)
 *   - Pull 모드: 주황색 테두리 (꽉 참)
 */
export function SortableUnifiedItem({
  id,
  disabled = false,
  children,
  dragData,
  reorderMode,
}: SortableUnifiedItemProps) {
  // DnD 컨텍스트에서 모드 가져오기 (fallback)
  const { unifiedReorderMode: contextMode } = usePlanDnd();
  // prop이 있으면 prop 사용, 없으면 context 사용
  const effectiveMode = reorderMode ?? contextMode;

  // useMemo로 data 참조 안정화
  const data = useMemo(
    () => ({
      ...dragData,
      unifiedId: id,
    }),
    [id, dragData]
  );

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id,
    // disabled 옵션을 사용하지 않음 - 드롭 타겟으로 인식되기 위해
    // 대신 dragProps에서 listeners를 조건부로 적용
    data,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // hover 시 모드에 따른 테두리 스타일
  const hoverRingClass = useMemo(() => {
    if (!isOver) return '';
    if (effectiveMode === 'push') return 'ring-2 ring-green-500 bg-green-50/50';
    if (effectiveMode === 'pull') return 'ring-2 ring-orange-500 bg-orange-50/50';
    return 'ring-2 ring-blue-400';
  }, [isOver, effectiveMode]);

  // disabled일 때는 드래그 리스너를 적용하지 않음 (클릭 이벤트 가로채기 방지)
  const dragProps = disabled ? {} : { ...attributes, ...listeners };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-all duration-150 rounded-lg',
        isDragging && 'opacity-50 shadow-lg z-50',
        hoverRingClass,
        !disabled && 'cursor-grab active:cursor-grabbing'
      )}
      {...dragProps}
    >
      {children}
    </div>
  );
}
