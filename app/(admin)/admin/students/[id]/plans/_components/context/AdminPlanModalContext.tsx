"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useReducer,
  useMemo,
  type ReactNode,
} from "react";
import {
  modalReducer,
  initialModalState,
  type ModalType,
  type ModalState,
} from "../types/modalState";
import { useModalSetters, type ModalSettersReturn } from "../hooks/useModalSetters";

/**
 * Modal Context - 모달 표시 상태만 관리
 *
 * 포함: 22개 모달의 열림/닫힘 상태
 * 변경 빈도: 높음 (모달 열기/닫기 시)
 *
 * 분리 이유: 모달 상태 변경이 Dock/Card 컴포넌트에 영향을 주지 않도록
 */
export interface AdminPlanModalContextValue extends ModalSettersReturn {
  modals: ModalState;
  openModal: (type: ModalType) => void;
  closeModal: (type: ModalType) => void;
  closeAllModals: () => void;
  unifiedModalMode: "quick" | "content";
  openUnifiedModal: (mode: "quick" | "content") => void;
}

const AdminPlanModalContext = createContext<AdminPlanModalContextValue | null>(null);

interface AdminPlanModalProviderProps {
  children: ReactNode;
}

export function AdminPlanModalProvider({ children }: AdminPlanModalProviderProps) {
  // 모달 상태 관리 (useReducer 패턴)
  const [modals, dispatchModal] = useReducer(modalReducer, initialModalState);

  // 모달 열기/닫기 헬퍼
  const openModal = useCallback((type: ModalType) => {
    dispatchModal({ type: "OPEN_MODAL", payload: type });
  }, []);

  const closeModal = useCallback((type: ModalType) => {
    dispatchModal({ type: "CLOSE_MODAL", payload: type });
  }, []);

  const closeAllModals = useCallback(() => {
    dispatchModal({ type: "CLOSE_ALL" });
  }, []);

  // 기존 API 호환 모달 상태 및 setter
  const modalSetters = useModalSetters(modals, dispatchModal);

  // 통합 모달 모드
  const [unifiedModalMode, setUnifiedModalMode] = useState<"quick" | "content">("quick");

  const openUnifiedModal = useCallback(
    (mode: "quick" | "content") => {
      setUnifiedModalMode(mode);
      modalSetters.setShowUnifiedAddModal(true);
    },
    [modalSetters]
  );

  const value = useMemo<AdminPlanModalContextValue>(
    () => ({
      modals,
      openModal,
      closeModal,
      closeAllModals,
      ...modalSetters,
      unifiedModalMode,
      openUnifiedModal,
    }),
    [
      modals,
      openModal,
      closeModal,
      closeAllModals,
      modalSetters,
      unifiedModalMode,
      openUnifiedModal,
    ]
  );

  return (
    <AdminPlanModalContext.Provider value={value}>
      {children}
    </AdminPlanModalContext.Provider>
  );
}

export function useAdminPlanModal() {
  const context = useContext(AdminPlanModalContext);
  if (!context) {
    throw new Error("useAdminPlanModal must be used within AdminPlanModalProvider");
  }
  return context;
}
