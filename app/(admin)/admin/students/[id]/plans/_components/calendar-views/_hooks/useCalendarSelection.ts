"use client";

/**
 * 캘린더 플랜 선택 상태 관리 훅
 *
 * 다중 선택, Shift 클릭 범위 선택, 전체 선택/해제 기능 제공
 */

import { useState, useCallback, useMemo } from "react";
import type { CalendarPlan } from "../_types/adminCalendar";

export interface UseCalendarSelectionOptions {
  /** 전체 플랜 목록 (선택 가능한 대상) */
  plans: CalendarPlan[];
}

export interface UseCalendarSelectionReturn {
  /** 선택된 플랜 ID Set */
  selectedIds: Set<string>;
  /** 선택된 플랜 개수 */
  selectedCount: number;
  /** 선택된 플랜 목록 */
  selectedPlans: CalendarPlan[];
  /** 선택 모드 활성화 여부 */
  isSelectionMode: boolean;
  /** 플랜 선택 여부 확인 */
  isSelected: (planId: string) => boolean;
  /** 플랜 선택 토글 */
  toggleSelection: (planId: string) => void;
  /** 범위 선택 (Shift 클릭) */
  selectRange: (planId: string) => void;
  /** 전체 선택 */
  selectAll: () => void;
  /** 전체 선택 해제 */
  clearSelection: () => void;
  /** 선택 모드 토글 */
  toggleSelectionMode: () => void;
  /** 선택 모드 활성화 */
  enableSelectionMode: () => void;
  /** 마지막 선택된 플랜 ID (범위 선택용) */
  lastSelectedId: string | null;
}

export function useCalendarSelection({
  plans,
}: UseCalendarSelectionOptions): UseCalendarSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // 선택된 플랜 목록
  const selectedPlans = useMemo(() => {
    return plans.filter((plan) => selectedIds.has(plan.id));
  }, [plans, selectedIds]);

  // 선택 여부 확인
  const isSelected = useCallback(
    (planId: string) => selectedIds.has(planId),
    [selectedIds]
  );

  // 단일 선택 토글
  const toggleSelection = useCallback((planId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) {
        next.delete(planId);
      } else {
        next.add(planId);
      }
      return next;
    });
    setLastSelectedId(planId);
  }, []);

  // 범위 선택 (Shift 클릭)
  const selectRange = useCallback(
    (planId: string) => {
      if (!lastSelectedId) {
        toggleSelection(planId);
        return;
      }

      // 날짜순 정렬된 플랜 목록에서 인덱스 찾기
      const sortedPlans = [...plans].sort((a, b) => {
        const dateCompare = (a.plan_date || "").localeCompare(b.plan_date || "");
        if (dateCompare !== 0) return dateCompare;
        return a.id.localeCompare(b.id);
      });

      const lastIndex = sortedPlans.findIndex((p) => p.id === lastSelectedId);
      const currentIndex = sortedPlans.findIndex((p) => p.id === planId);

      if (lastIndex === -1 || currentIndex === -1) {
        toggleSelection(planId);
        return;
      }

      // 범위 내 모든 플랜 선택
      const startIndex = Math.min(lastIndex, currentIndex);
      const endIndex = Math.max(lastIndex, currentIndex);

      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = startIndex; i <= endIndex; i++) {
          next.add(sortedPlans[i].id);
        }
        return next;
      });
      setLastSelectedId(planId);
    },
    [lastSelectedId, plans, toggleSelection]
  );

  // 전체 선택
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(plans.map((p) => p.id)));
  }, [plans]);

  // 전체 선택 해제
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  // 선택 모드 토글
  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      if (prev) {
        // 모드 비활성화 시 선택 초기화
        setSelectedIds(new Set());
        setLastSelectedId(null);
      }
      return !prev;
    });
  }, []);

  // 선택 모드 활성화
  const enableSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    selectedPlans,
    isSelectionMode,
    isSelected,
    toggleSelection,
    selectRange,
    selectAll,
    clearSelection,
    toggleSelectionMode,
    enableSelectionMode,
    lastSelectedId,
  };
}
