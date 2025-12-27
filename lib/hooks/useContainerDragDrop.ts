'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { handlePlanDrop, moveAdHocPlan, type ContainerType, type DropTarget } from '@/lib/domains/plan/actions/move';

export type DragItemType = 'student_plan' | 'ad_hoc_plan';

export type ContainerDragItem = {
  id: string;
  type: DragItemType;
  sourceContainer: ContainerType;
  title: string;
};

export type ContainerDropZone = {
  container: ContainerType;
};

interface UseContainerDragDropOptions {
  onMoveSuccess?: () => void;
  onMoveError?: (error: string) => void;
}

/**
 * 컨테이너 간 드래그앤드롭을 위한 커스텀 훅
 *
 * HTML5 Drag and Drop API를 사용하여 플랜을 다른 컨테이너로 이동합니다.
 *
 * 컨테이너:
 * - unfinished: 미완료 (이월된 플랜)
 * - daily: 오늘 할 일
 * - weekly: 이번 주 유동
 */
export function useContainerDragDrop(options?: UseContainerDragDropOptions) {
  const router = useRouter();
  const { showToast } = useToast();

  const [draggedItem, setDraggedItem] = useState<ContainerDragItem | null>(null);
  const [dropTargetContainer, setDropTargetContainer] = useState<ContainerType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const dragImageRef = useRef<HTMLDivElement | null>(null);
  const draggedElementRef = useRef<HTMLElement | null>(null);

  // 드래그 이미지 요소 생성 (화면 밖에 위치)
  useEffect(() => {
    if (!dragImageRef.current) {
      const div = document.createElement('div');
      div.style.cssText = `
        position: fixed;
        left: -1000px;
        top: -1000px;
        padding: 8px 12px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        font-size: 14px;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        z-index: 9999;
      `;
      document.body.appendChild(div);
      dragImageRef.current = div;
    }

    return () => {
      if (dragImageRef.current && document.body.contains(dragImageRef.current)) {
        document.body.removeChild(dragImageRef.current);
        dragImageRef.current = null;
      }
    };
  }, []);

  // 드래그 시작 핸들러
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, item: ContainerDragItem) => {
      if (isProcessing) {
        e.preventDefault();
        return;
      }

      setDraggedItem(item);
      draggedElementRef.current = e.currentTarget;

      // 드래그 이미지 설정
      if (dragImageRef.current) {
        dragImageRef.current.textContent = `📦 ${item.title}`;
        e.dataTransfer.setDragImage(dragImageRef.current, 0, 0);
      }

      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/json', JSON.stringify(item));

      // 드래그 시작 시 시각적 피드백
      requestAnimationFrame(() => {
        if (draggedElementRef.current) {
          draggedElementRef.current.style.opacity = '0.5';
          draggedElementRef.current.style.transform = 'scale(0.98)';
        }
      });
    },
    [isProcessing]
  );

  // 드래그 종료 핸들러
  const handleDragEnd = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    setDraggedItem(null);
    setDropTargetContainer(null);

    // 시각적 피드백 복원
    if (draggedElementRef.current) {
      draggedElementRef.current.style.opacity = '1';
      draggedElementRef.current.style.transform = 'scale(1)';
    }
    draggedElementRef.current = null;
  }, []);

  // 드롭 영역 진입 핸들러
  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>, container: ContainerType) => {
      e.preventDefault();
      e.stopPropagation();

      // 같은 컨테이너로는 드롭 불가
      if (draggedItem && draggedItem.sourceContainer === container) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }

      setDropTargetContainer(container);
      e.dataTransfer.dropEffect = 'move';
    },
    [draggedItem]
  );

  // 드롭 영역 위 핸들러
  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, container: ContainerType) => {
      e.preventDefault();
      e.stopPropagation();

      // 같은 컨테이너로는 드롭 불가
      if (draggedItem && draggedItem.sourceContainer === container) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }

      e.dataTransfer.dropEffect = 'move';
    },
    [draggedItem]
  );

  // 드롭 영역 이탈 핸들러
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // 자식 요소로 이동할 때는 무시
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;
    if (relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }

    setDropTargetContainer(null);
  }, []);

  // 드롭 처리 핸들러
  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>, targetContainer: ContainerType) => {
      e.preventDefault();
      e.stopPropagation();

      setDropTargetContainer(null);

      const data = e.dataTransfer.getData('application/json');
      if (!data) return;

      try {
        const item: ContainerDragItem = JSON.parse(data);

        // 같은 컨테이너로는 이동하지 않음
        if (item.sourceContainer === targetContainer) {
          return;
        }

        setIsProcessing(true);

        const dropTarget: DropTarget = {
          container: targetContainer,
        };

        let result;
        if (item.type === 'ad_hoc_plan') {
          // Ad-hoc 플랜은 별도 함수 사용
          const today = new Date().toISOString().split('T')[0];
          result = await moveAdHocPlan(item.id, today, targetContainer);
        } else {
          result = await handlePlanDrop(item.id, dropTarget);
        }

        if (result.success) {
          const containerName = getContainerDisplayName(targetContainer);
          showToast(`"${item.title}"을(를) ${containerName}(으)로 이동했습니다.`, 'success');
          options?.onMoveSuccess?.();
          router.refresh();
        } else {
          showToast(result.error || '플랜 이동에 실패했습니다.', 'error');
          options?.onMoveError?.(result.error || 'Unknown error');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        showToast('플랜 이동 중 오류가 발생했습니다.', 'error');
        options?.onMoveError?.(errorMessage);
      } finally {
        setIsProcessing(false);
        setDraggedItem(null);
      }
    },
    [router, showToast, options]
  );

  // 드래그 가능 요소 속성 생성
  const getDraggableProps = useCallback(
    (item: ContainerDragItem) => ({
      draggable: !isProcessing,
      onDragStart: (e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, item),
      onDragEnd: handleDragEnd,
    }),
    [isProcessing, handleDragStart, handleDragEnd]
  );

  // 드롭 영역 속성 생성
  const getDropZoneProps = useCallback(
    (container: ContainerType) => ({
      onDragEnter: (e: React.DragEvent<HTMLDivElement>) => handleDragEnter(e, container),
      onDragOver: (e: React.DragEvent<HTMLDivElement>) => handleDragOver(e, container),
      onDragLeave: handleDragLeave,
      onDrop: (e: React.DragEvent<HTMLDivElement>) => handleDrop(e, container),
    }),
    [handleDragEnter, handleDragOver, handleDragLeave, handleDrop]
  );

  // 드롭 가능 여부 확인
  const canDropOnContainer = useCallback(
    (container: ContainerType) => {
      if (!draggedItem) return false;
      return draggedItem.sourceContainer !== container;
    },
    [draggedItem]
  );

  // 특정 컨테이너가 현재 드롭 타겟인지 확인
  const isDropTarget = useCallback(
    (container: ContainerType) => {
      return dropTargetContainer === container && canDropOnContainer(container);
    },
    [dropTargetContainer, canDropOnContainer]
  );

  return {
    // 상태
    draggedItem,
    dropTargetContainer,
    isProcessing,
    isDragging: draggedItem !== null,

    // 헬퍼 함수
    getDraggableProps,
    getDropZoneProps,
    canDropOnContainer,
    isDropTarget,
  };
}

// 컨테이너 표시명
function getContainerDisplayName(container: ContainerType): string {
  switch (container) {
    case 'unfinished':
      return '미완료';
    case 'daily':
      return '오늘 할 일';
    case 'weekly':
      return '주간 유동';
    default:
      return container;
  }
}
