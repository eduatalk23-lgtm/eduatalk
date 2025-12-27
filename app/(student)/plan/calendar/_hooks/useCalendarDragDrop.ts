"use client";

import { useState, useCallback, useRef } from "react";
import { movePlanToDate } from "@/lib/domains/plan/actions/move";
import { useToast } from "@/components/ui/ToastProvider";

export type DragItem = {
  planId: string;
  planDate: string;
  contentTitle: string;
};

export type DropTarget = {
  date: string;
  element: HTMLElement;
};

type UseCalendarDragDropOptions = {
  onMoveSuccess?: (planId: string, newDate: string) => void;
  onMoveError?: (error: string) => void;
};

/**
 * 캘린더 드래그 앤 드롭 훅
 *
 * HTML5 Drag and Drop API를 사용하여 플랜을 다른 날짜로 이동합니다.
 */
export function useCalendarDragDrop(options?: UseCalendarDragDropOptions) {
  const { showToast } = useToast();
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const dragImageRef = useRef<HTMLDivElement | null>(null);

  // 드래그 시작
  const handleDragStart = useCallback(
    (e: React.DragEvent, item: DragItem) => {
      // 이동 중에는 새 드래그 방지
      if (isMoving) {
        e.preventDefault();
        return;
      }

      setDraggedItem(item);

      // 드래그 이미지 설정
      if (dragImageRef.current) {
        dragImageRef.current.textContent = item.contentTitle;
        e.dataTransfer.setDragImage(dragImageRef.current, 0, 0);
      }

      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/json", JSON.stringify(item));

      // 드래그 시작 시 약간의 투명도
      const target = e.target as HTMLElement;
      requestAnimationFrame(() => {
        target.style.opacity = "0.5";
      });
    },
    [isMoving]
  );

  // 드래그 종료
  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedItem(null);
    setDropTarget(null);

    // 투명도 복원
    const target = e.target as HTMLElement;
    target.style.opacity = "1";
  }, []);

  // 드롭 영역 진입
  const handleDragEnter = useCallback(
    (e: React.DragEvent, date: string) => {
      e.preventDefault();
      e.stopPropagation();

      // 같은 날짜로는 드롭 불가
      if (draggedItem && draggedItem.planDate === date) {
        e.dataTransfer.dropEffect = "none";
        return;
      }

      setDropTarget(date);
      e.dataTransfer.dropEffect = "move";
    },
    [draggedItem]
  );

  // 드롭 영역 위
  const handleDragOver = useCallback(
    (e: React.DragEvent, date: string) => {
      e.preventDefault();
      e.stopPropagation();

      // 같은 날짜로는 드롭 불가
      if (draggedItem && draggedItem.planDate === date) {
        e.dataTransfer.dropEffect = "none";
        return;
      }

      e.dataTransfer.dropEffect = "move";
    },
    [draggedItem]
  );

  // 드롭 영역 이탈
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 자식 요소로 이동할 때는 무시
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (currentTarget.contains(relatedTarget)) {
      return;
    }

    setDropTarget(null);
  }, []);

  // 드롭 처리
  const handleDrop = useCallback(
    async (e: React.DragEvent, targetDate: string) => {
      e.preventDefault();
      e.stopPropagation();

      setDropTarget(null);

      const data = e.dataTransfer.getData("application/json");
      if (!data) return;

      try {
        const item: DragItem = JSON.parse(data);

        // 같은 날짜로는 이동하지 않음
        if (item.planDate === targetDate) {
          return;
        }

        setIsMoving(true);

        const result = await movePlanToDate(item.planId, targetDate, {
          keepTime: true,
        });

        if (result.success) {
          showToast(
            `"${item.contentTitle}"을(를) ${targetDate}로 이동했습니다.`,
            "success"
          );
          options?.onMoveSuccess?.(item.planId, targetDate);
        } else {
          showToast(result.error || "플랜 이동에 실패했습니다.", "error");
          options?.onMoveError?.(result.error || "Unknown error");
        }
      } catch (error) {
        showToast("플랜 이동 중 오류가 발생했습니다.", "error");
        options?.onMoveError?.(
          error instanceof Error ? error.message : "Unknown error"
        );
      } finally {
        setIsMoving(false);
        setDraggedItem(null);
      }
    },
    [showToast, options]
  );

  // 드래그 이미지 컴포넌트용 ref setter
  const setDragImageElement = useCallback((el: HTMLDivElement | null) => {
    dragImageRef.current = el;
  }, []);

  return {
    // 상태
    draggedItem,
    dropTarget,
    isMoving,
    isDragging: draggedItem !== null,

    // 드래그 핸들러 (플랜 카드에 연결)
    dragHandlers: {
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
    },

    // 드롭 핸들러 (날짜 셀에 연결)
    dropHandlers: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },

    // 드래그 이미지 ref
    setDragImageElement,
  };
}
