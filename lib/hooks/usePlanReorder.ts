'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { reorderPlans } from '@/lib/domains/plan/actions/move';

export type ReorderItem = {
  id: string;
  sequence: number;
};

interface UsePlanReorderOptions {
  onReorderSuccess?: () => void;
  onReorderError?: (error: string) => void;
}

/**
 * 플랜 순서 재정렬을 위한 커스텀 훅
 *
 * HTML5 Drag and Drop API를 사용하여 같은 컨테이너 내에서 플랜 순서를 변경합니다.
 */
export function usePlanReorder(options?: UsePlanReorderOptions) {
  const router = useRouter();
  const { showToast } = useToast();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const draggedElementRef = useRef<HTMLElement | null>(null);

  // 드래그 시작
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      if (isReordering) {
        e.preventDefault();
        return;
      }

      setDraggedIndex(index);
      draggedElementRef.current = e.currentTarget;

      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));

      // 시각적 피드백
      requestAnimationFrame(() => {
        if (draggedElementRef.current) {
          draggedElementRef.current.style.opacity = '0.5';
        }
      });
    },
    [isReordering]
  );

  // 드래그 종료
  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDropTargetIndex(null);

    if (draggedElementRef.current) {
      draggedElementRef.current.style.opacity = '1';
    }
    draggedElementRef.current = null;
  }, []);

  // 드롭 영역 진입
  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.stopPropagation();

      if (draggedIndex === null || draggedIndex === index) {
        return;
      }

      setDropTargetIndex(index);
    },
    [draggedIndex]
  );

  // 드롭 영역 위
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // 드롭 영역 이탈
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;
    if (relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }

    setDropTargetIndex(null);
  }, []);

  // 순서 변경 적용
  const handleDrop = useCallback(
    async <T extends ReorderItem>(
      e: React.DragEvent<HTMLDivElement>,
      targetIndex: number,
      items: T[],
      onOptimisticUpdate?: (newItems: T[]) => void
    ) => {
      e.preventDefault();
      e.stopPropagation();

      const sourceIndex = draggedIndex;
      setDraggedIndex(null);
      setDropTargetIndex(null);

      if (sourceIndex === null || sourceIndex === targetIndex) {
        return;
      }

      // 새 순서 계산
      const newItems = [...items];
      const [movedItem] = newItems.splice(sourceIndex, 1);
      newItems.splice(targetIndex, 0, movedItem);

      // Optimistic update
      if (onOptimisticUpdate) {
        onOptimisticUpdate(newItems);
      }

      setIsReordering(true);

      try {
        // 서버에 순서 변경 요청
        const planIds = newItems.map((item) => item.id);
        const newOrder = newItems.map((_, idx) => idx);

        const result = await reorderPlans(planIds, newOrder);

        if (result.success) {
          showToast('순서가 변경되었습니다.', 'success');
          options?.onReorderSuccess?.();
          router.refresh();
        } else {
          showToast(result.error || '순서 변경에 실패했습니다.', 'error');
          options?.onReorderError?.(result.error || 'Unknown error');
          // 실패 시 원래 순서로 복원
          if (onOptimisticUpdate) {
            onOptimisticUpdate(items);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        showToast('순서 변경 중 오류가 발생했습니다.', 'error');
        options?.onReorderError?.(errorMessage);
        // 실패 시 원래 순서로 복원
        if (onOptimisticUpdate) {
          onOptimisticUpdate(items);
        }
      } finally {
        setIsReordering(false);
      }
    },
    [draggedIndex, router, showToast, options]
  );

  // 순서 재정렬 가능 아이템용 props 생성
  const getReorderableProps = useCallback(
    <T extends ReorderItem>(
      index: number,
      items: T[],
      onOptimisticUpdate?: (newItems: T[]) => void
    ) => ({
      draggable: !isReordering,
      onDragStart: (e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, index),
      onDragEnd: handleDragEnd,
      onDragEnter: (e: React.DragEvent<HTMLDivElement>) => handleDragEnter(e, index),
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: (e: React.DragEvent<HTMLDivElement>) =>
        handleDrop(e, index, items, onOptimisticUpdate),
    }),
    [
      isReordering,
      handleDragStart,
      handleDragEnd,
      handleDragEnter,
      handleDragOver,
      handleDragLeave,
      handleDrop,
    ]
  );

  // 현재 드롭 타겟인지 확인
  const isDropTargetAt = useCallback(
    (index: number) => {
      return dropTargetIndex === index && draggedIndex !== null && draggedIndex !== index;
    },
    [dropTargetIndex, draggedIndex]
  );

  // 현재 드래그 중인 아이템인지 확인
  const isDraggedAt = useCallback(
    (index: number) => {
      return draggedIndex === index;
    },
    [draggedIndex]
  );

  return {
    // 상태
    draggedIndex,
    dropTargetIndex,
    isReordering,
    isDragging: draggedIndex !== null,

    // 헬퍼 함수
    getReorderableProps,
    isDropTargetAt,
    isDraggedAt,
  };
}
