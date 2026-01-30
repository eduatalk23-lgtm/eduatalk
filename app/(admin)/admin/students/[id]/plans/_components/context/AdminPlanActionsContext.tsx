"use client";

import { createContext, useContext, useCallback, useMemo, type ReactNode } from "react";
import type { PlanStatus } from "@/lib/types/plan";
import { useAdminPlanModal } from "./AdminPlanModalContext";
import { useAdminPlanModalData } from "./AdminPlanModalDataContext";

/**
 * Actions Context - 모달 열기 헬퍼 함수들
 *
 * 포함: handleOpenEdit, handleOpenRedistribute 등 복합 액션
 * 변경 빈도: 없음 (함수 참조는 stable)
 *
 * 분리 이유: 핸들러 함수들이 다른 Context에 의존하므로 별도 관리
 */
export interface AdminPlanActionsContextValue {
  handleOpenRedistribute: (planId: string) => void;
  handleOpenEdit: (planId: string) => void;
  handleOpenReorder: (containerType: "daily" | "weekly" | "unfinished") => void;
  handleOpenTemplateWithPlans: (planIds: string[]) => void;
  handleOpenMoveToGroup: (planIds: string[], currentGroupId?: string | null) => void;
  handleOpenCopy: (planIds: string[]) => void;
  handleOpenStatusChange: (planId: string, currentStatus: PlanStatus, title: string) => void;
  handleOpenBulkEdit: (planIds: string[]) => void;
  handleOpenContentDependency: (content: {
    contentId: string;
    contentType: "book" | "lecture" | "custom";
    contentName: string;
  }) => void;
  handleOpenBatchOperations: (planIds: string[], mode: "date" | "status") => void;
  /** 빈 시간 슬롯에 새 플랜 생성 (UnifiedAddModal 열기) */
  handleCreatePlanAtSlot: (startTime: string, endTime: string) => void;
}

const AdminPlanActionsContext = createContext<AdminPlanActionsContextValue | null>(null);

interface AdminPlanActionsProviderProps {
  children: ReactNode;
}

export function AdminPlanActionsProvider({ children }: AdminPlanActionsProviderProps) {
  const modal = useAdminPlanModal();
  const modalData = useAdminPlanModalData();

  const handleOpenRedistribute = useCallback(
    (planId: string) => {
      modalData.setSelectedPlanForRedistribute(planId);
      modal.setShowRedistributeModal(true);
    },
    [modal, modalData]
  );

  const handleOpenEdit = useCallback(
    (planId: string) => {
      modalData.setSelectedPlanForEdit(planId);
      modal.setShowEditModal(true);
    },
    [modal, modalData]
  );

  const handleOpenReorder = useCallback(
    (containerType: "daily" | "weekly" | "unfinished") => {
      modalData.setReorderContainerType(containerType);
      modal.setShowReorderModal(true);
    },
    [modal, modalData]
  );

  const handleOpenTemplateWithPlans = useCallback(
    (planIds: string[]) => {
      modalData.setTemplatePlanIds(planIds);
      modal.setShowTemplateModal(true);
    },
    [modal, modalData]
  );

  const handleOpenMoveToGroup = useCallback(
    (planIds: string[], currentGroupId?: string | null) => {
      modalData.setSelectedPlansForMove(planIds);
      modalData.setCurrentGroupIdForMove(currentGroupId ?? null);
      modal.setShowMoveToGroupModal(true);
    },
    [modal, modalData]
  );

  const handleOpenCopy = useCallback(
    (planIds: string[]) => {
      modalData.setSelectedPlansForCopy(planIds);
      modal.setShowCopyModal(true);
    },
    [modal, modalData]
  );

  const handleOpenStatusChange = useCallback(
    (planId: string, currentStatus: PlanStatus, title: string) => {
      modalData.setSelectedPlanForStatus({ id: planId, status: currentStatus, title });
      modal.setShowStatusModal(true);
    },
    [modal, modalData]
  );

  const handleOpenBulkEdit = useCallback(
    (planIds: string[]) => {
      modalData.setSelectedPlansForBulkEdit(planIds);
      modal.setShowBulkEditModal(true);
    },
    [modal, modalData]
  );

  const handleOpenContentDependency = useCallback(
    (content: {
      contentId: string;
      contentType: "book" | "lecture" | "custom";
      contentName: string;
    }) => {
      modalData.setSelectedContentForDependency(content);
      modal.setShowContentDependencyModal(true);
    },
    [modal, modalData]
  );

  const handleOpenBatchOperations = useCallback(
    (planIds: string[], mode: "date" | "status") => {
      modalData.setSelectedPlansForBatch(planIds);
      modalData.setBatchOperationMode(mode);
      modal.setShowBatchOperationsModal(true);
    },
    [modal, modalData]
  );

  const handleCreatePlanAtSlot = useCallback(
    (startTime: string, endTime: string) => {
      modalData.setSlotTimeForNewPlan({ startTime, endTime });
      modal.openUnifiedModal("quick");
    },
    [modal, modalData]
  );

  const value = useMemo<AdminPlanActionsContextValue>(
    () => ({
      handleOpenRedistribute,
      handleOpenEdit,
      handleOpenReorder,
      handleOpenTemplateWithPlans,
      handleOpenMoveToGroup,
      handleOpenCopy,
      handleOpenStatusChange,
      handleOpenBulkEdit,
      handleOpenContentDependency,
      handleOpenBatchOperations,
      handleCreatePlanAtSlot,
    }),
    [
      handleOpenRedistribute,
      handleOpenEdit,
      handleOpenReorder,
      handleOpenTemplateWithPlans,
      handleOpenMoveToGroup,
      handleOpenCopy,
      handleOpenStatusChange,
      handleOpenBulkEdit,
      handleOpenContentDependency,
      handleOpenBatchOperations,
      handleCreatePlanAtSlot,
    ]
  );

  return (
    <AdminPlanActionsContext.Provider value={value}>
      {children}
    </AdminPlanActionsContext.Provider>
  );
}

export function useAdminPlanActions() {
  const context = useContext(AdminPlanActionsContext);
  if (!context) {
    throw new Error("useAdminPlanActions must be used within AdminPlanActionsProvider");
  }
  return context;
}
