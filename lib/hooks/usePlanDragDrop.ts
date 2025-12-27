"use client";

import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  handlePlanDrop,
  movePlanToDate,
  reorderPlans,
  type DropTarget,
} from "@/lib/domains/plan/actions/move";

export type DragItem = {
  id: string;
  type: "plan" | "adhoc";
  sourceContainer: "daily" | "weekly" | "unfinished";
  index: number;
};

export type DropZone = {
  container: "daily" | "weekly" | "unfinished";
  date?: string;
  index?: number;
};

interface UsePlanDragDropOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function usePlanDragDrop(options?: UsePlanDragDropOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleDragStart = useCallback((item: DragItem) => {
    setIsDragging(true);
    setDragItem(item);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDragItem(null);
  }, []);

  const handleDrop = useCallback(
    async (dropZone: DropZone) => {
      if (!dragItem) return;

      setIsProcessing(true);
      try {
        const dropTarget: DropTarget = {
          container: dropZone.container,
          date: dropZone.date,
          position: dropZone.index,
        };

        const result = await handlePlanDrop(dragItem.id, dropTarget);

        if (!result.success) {
          showError(result.error || "이동 실패");
          options?.onError?.(result.error || "Unknown error");
        } else {
          showSuccess(
            `${dropZone.container === "daily" ? "Daily" : dropZone.container === "weekly" ? "Weekly" : "Unfinished"} Dock으로 이동했습니다.`
          );
          options?.onSuccess?.();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        showError(errorMessage);
        options?.onError?.(errorMessage);
      } finally {
        setIsProcessing(false);
        handleDragEnd();
      }
    },
    [dragItem, options, handleDragEnd, showSuccess, showError]
  );

  const moveToDate = useCallback(
    async (planId: string, newDate: string, keepTime?: boolean) => {
      setIsProcessing(true);
      try {
        const result = await movePlanToDate(planId, newDate, { keepTime });

        if (!result.success) {
          showError(result.error || "날짜 변경 실패");
          options?.onError?.(result.error || "Unknown error");
          return false;
        }

        showSuccess(`${newDate}로 이동했습니다.`);
        options?.onSuccess?.();
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        showError(errorMessage);
        options?.onError?.(errorMessage);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [options, showSuccess, showError]
  );

  const reorder = useCallback(
    async (planIds: string[], newOrder: number[]) => {
      setIsProcessing(true);
      try {
        const result = await reorderPlans(planIds, newOrder);

        if (!result.success) {
          showError(result.error || "순서 변경 실패");
          options?.onError?.(result.error || "Unknown error");
          return false;
        }

        options?.onSuccess?.();
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        showError(errorMessage);
        options?.onError?.(errorMessage);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [options, showError]
  );

  return {
    isDragging,
    dragItem,
    isProcessing,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    moveToDate,
    reorder,
  };
}
