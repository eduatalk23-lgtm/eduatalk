/**
 * MonthView 모달 상태 관리 훅
 * 타임라인 모달, 빠른 추가 모달, 플랜 상세 모달의 상태를 관리합니다.
 */

import { useState, useCallback } from "react";
import type { PlanWithContent } from "../_types/plan";

export interface MonthViewModalsState {
  // 타임라인 모달
  selectedDate: Date | null;
  isModalOpen: boolean;
  // 빠른 추가 모달
  quickAddDate: string | null;
  isQuickAddOpen: boolean;
  // 플랜 상세 모달
  selectedPlan: PlanWithContent | null;
  isPlanDetailOpen: boolean;
}

export interface MonthViewModalsActions {
  handleDateClick: (date: Date) => void;
  handlePlanClick: (plan: PlanWithContent) => void;
  handleQuickAdd: (dateStr: string) => void;
  setIsModalOpen: (open: boolean) => void;
  setIsQuickAddOpen: (open: boolean) => void;
  setIsPlanDetailOpen: (open: boolean) => void;
}

export type UseMonthViewModalsResult = MonthViewModalsState & MonthViewModalsActions;

/**
 * MonthView에서 사용하는 모달 상태를 관리하는 훅
 *
 * @returns 모달 상태와 핸들러 함수들
 */
export function useMonthViewModals(): UseMonthViewModalsResult {
  // 타임라인 모달 상태
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 빠른 추가 모달 상태
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // 플랜 상세 모달 상태
  const [selectedPlan, setSelectedPlan] = useState<PlanWithContent | null>(null);
  const [isPlanDetailOpen, setIsPlanDetailOpen] = useState(false);

  // 날짜 클릭 핸들러 (타임라인 모달 열기)
  const handleDateClick = useCallback((date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  }, []);

  // 플랜 클릭 핸들러 (플랜 상세 모달 열기)
  const handlePlanClick = useCallback((plan: PlanWithContent) => {
    setSelectedPlan(plan);
    setIsPlanDetailOpen(true);
  }, []);

  // 빠른 추가 핸들러
  const handleQuickAdd = useCallback((dateStr: string) => {
    setQuickAddDate(dateStr);
    setIsQuickAddOpen(true);
  }, []);

  return {
    // 상태
    selectedDate,
    isModalOpen,
    quickAddDate,
    isQuickAddOpen,
    selectedPlan,
    isPlanDetailOpen,
    // 핸들러
    handleDateClick,
    handlePlanClick,
    handleQuickAdd,
    setIsModalOpen,
    setIsQuickAddOpen,
    setIsPlanDetailOpen,
  };
}
