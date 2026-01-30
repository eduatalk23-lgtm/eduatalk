"use client";

import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import type { PlanStatus } from "@/lib/types/plan";

/**
 * Modal Data Context - 모달에 전달할 데이터
 *
 * 포함: 선택된 플랜 ID, 상태 등 모달 작업에 필요한 데이터
 * 변경 빈도: 중간 (모달 열기 전 데이터 설정 시)
 *
 * 분리 이유: 모달 데이터 변경이 다른 컴포넌트에 영향을 주지 않도록
 */
export interface AdminPlanModalDataContextValue {
  // 재분배 모달
  selectedPlanForRedistribute: string | null;
  setSelectedPlanForRedistribute: (id: string | null) => void;

  // 수정 모달
  selectedPlanForEdit: string | null;
  setSelectedPlanForEdit: (id: string | null) => void;

  // 순서 변경 모달
  reorderContainerType: "daily" | "weekly" | "unfinished";
  setReorderContainerType: (type: "daily" | "weekly" | "unfinished") => void;

  // 템플릿 모달
  templatePlanIds: string[];
  setTemplatePlanIds: (ids: string[]) => void;

  // 그룹 이동 모달
  selectedPlansForMove: string[];
  setSelectedPlansForMove: (ids: string[]) => void;
  currentGroupIdForMove: string | null;
  setCurrentGroupIdForMove: (id: string | null) => void;

  // 복사 모달
  selectedPlansForCopy: string[];
  setSelectedPlansForCopy: (ids: string[]) => void;

  // 상태 변경 모달
  selectedPlanForStatus: { id: string; status: PlanStatus; title: string } | null;
  setSelectedPlanForStatus: (
    data: { id: string; status: PlanStatus; title: string } | null
  ) => void;

  // 일괄 수정 모달
  selectedPlansForBulkEdit: string[];
  setSelectedPlansForBulkEdit: (ids: string[]) => void;

  // AI 플랜 모달
  newGroupIdForAI: string | null;
  setNewGroupIdForAI: (id: string | null) => void;

  // 콘텐츠 의존성 모달
  selectedContentForDependency: {
    contentId: string;
    contentType: "book" | "lecture" | "custom";
    contentName: string;
  } | null;
  setSelectedContentForDependency: (
    content: {
      contentId: string;
      contentType: "book" | "lecture" | "custom";
      contentName: string;
    } | null
  ) => void;

  // 배치 작업 모달
  selectedPlansForBatch: string[];
  setSelectedPlansForBatch: (planIds: string[]) => void;
  batchOperationMode: "date" | "status" | null;
  setBatchOperationMode: (mode: "date" | "status" | null) => void;

  // 타임라인 모달
  dayTimelineModalDate: string | null;
  setDayTimelineModalDate: (date: string | null) => void;

  // 빈 시간 슬롯에 플랜 추가
  slotTimeForNewPlan: { startTime: string; endTime: string } | null;
  setSlotTimeForNewPlan: (data: { startTime: string; endTime: string } | null) => void;
}

const AdminPlanModalDataContext = createContext<AdminPlanModalDataContextValue | null>(null);

interface AdminPlanModalDataProviderProps {
  children: ReactNode;
}

export function AdminPlanModalDataProvider({ children }: AdminPlanModalDataProviderProps) {
  // 재분배 모달
  const [selectedPlanForRedistribute, setSelectedPlanForRedistribute] = useState<string | null>(null);

  // 수정 모달
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<string | null>(null);

  // 순서 변경 모달
  const [reorderContainerType, setReorderContainerType] = useState<"daily" | "weekly" | "unfinished">("daily");

  // 템플릿 모달
  const [templatePlanIds, setTemplatePlanIds] = useState<string[]>([]);

  // 그룹 이동 모달
  const [selectedPlansForMove, setSelectedPlansForMove] = useState<string[]>([]);
  const [currentGroupIdForMove, setCurrentGroupIdForMove] = useState<string | null>(null);

  // 복사 모달
  const [selectedPlansForCopy, setSelectedPlansForCopy] = useState<string[]>([]);

  // 상태 변경 모달
  const [selectedPlanForStatus, setSelectedPlanForStatus] = useState<{
    id: string;
    status: PlanStatus;
    title: string;
  } | null>(null);

  // 일괄 수정 모달
  const [selectedPlansForBulkEdit, setSelectedPlansForBulkEdit] = useState<string[]>([]);

  // AI 플랜 모달
  const [newGroupIdForAI, setNewGroupIdForAI] = useState<string | null>(null);

  // 콘텐츠 의존성 모달
  const [selectedContentForDependency, setSelectedContentForDependency] = useState<{
    contentId: string;
    contentType: "book" | "lecture" | "custom";
    contentName: string;
  } | null>(null);

  // 배치 작업 모달
  const [selectedPlansForBatch, setSelectedPlansForBatch] = useState<string[]>([]);
  const [batchOperationMode, setBatchOperationMode] = useState<"date" | "status" | null>(null);

  // 타임라인 모달
  const [dayTimelineModalDate, setDayTimelineModalDate] = useState<string | null>(null);

  // 빈 시간 슬롯에 플랜 추가
  const [slotTimeForNewPlan, setSlotTimeForNewPlan] = useState<{
    startTime: string;
    endTime: string;
  } | null>(null);

  const value = useMemo<AdminPlanModalDataContextValue>(
    () => ({
      selectedPlanForRedistribute,
      setSelectedPlanForRedistribute,
      selectedPlanForEdit,
      setSelectedPlanForEdit,
      reorderContainerType,
      setReorderContainerType,
      templatePlanIds,
      setTemplatePlanIds,
      selectedPlansForMove,
      setSelectedPlansForMove,
      currentGroupIdForMove,
      setCurrentGroupIdForMove,
      selectedPlansForCopy,
      setSelectedPlansForCopy,
      selectedPlanForStatus,
      setSelectedPlanForStatus,
      selectedPlansForBulkEdit,
      setSelectedPlansForBulkEdit,
      newGroupIdForAI,
      setNewGroupIdForAI,
      selectedContentForDependency,
      setSelectedContentForDependency,
      selectedPlansForBatch,
      setSelectedPlansForBatch,
      batchOperationMode,
      setBatchOperationMode,
      dayTimelineModalDate,
      setDayTimelineModalDate,
      slotTimeForNewPlan,
      setSlotTimeForNewPlan,
    }),
    [
      selectedPlanForRedistribute,
      selectedPlanForEdit,
      reorderContainerType,
      templatePlanIds,
      selectedPlansForMove,
      currentGroupIdForMove,
      selectedPlansForCopy,
      selectedPlanForStatus,
      selectedPlansForBulkEdit,
      newGroupIdForAI,
      selectedContentForDependency,
      selectedPlansForBatch,
      batchOperationMode,
      dayTimelineModalDate,
      slotTimeForNewPlan,
    ]
  );

  return (
    <AdminPlanModalDataContext.Provider value={value}>
      {children}
    </AdminPlanModalDataContext.Provider>
  );
}

export function useAdminPlanModalData() {
  const context = useContext(AdminPlanModalDataContext);
  if (!context) {
    throw new Error("useAdminPlanModalData must be used within AdminPlanModalDataProvider");
  }
  return context;
}
