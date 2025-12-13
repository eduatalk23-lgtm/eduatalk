"use client";

import { createContext, useContext, ReactNode } from "react";
import type { StudentFormData } from "../types";
import type { ValidationErrors } from "@/lib/utils/studentFormUtils";

export type AutoCalculateFlags = {
  examYear: boolean;
  curriculum: boolean;
};

export type ModalStates = {
  examYear: boolean;
  curriculum: boolean;
};

export type SettingsContextType = {
  // 상태
  formData: StudentFormData;
  errors: ValidationErrors;
  loading: boolean;
  saving: boolean;
  schoolType: "중학교" | "고등학교" | undefined;
  autoCalculateFlags: AutoCalculateFlags;
  isInitialSetup: boolean;
  modalStates: ModalStates;
  initialFormData: StudentFormData | null;

  // 업데이트 함수
  updateFormData: (updates: Partial<StudentFormData>) => void;
  setFormData: (data: StudentFormData) => void;
  setErrors: (
    errors: ValidationErrors | ((prev: ValidationErrors) => ValidationErrors)
  ) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setSchoolType: (type: "중학교" | "고등학교" | undefined) => void;
  setAutoCalculateFlags: (flags: Partial<AutoCalculateFlags>) => void;
  setModalState: (modal: keyof ModalStates, open: boolean) => void;
  setInitialFormData: (data: StudentFormData | null) => void;

  // 헬퍼 함수
  hasChanges: boolean;
  resetForm: () => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

// Provider는 SettingsPageClient에서 구현됩니다.
export { SettingsContext };

