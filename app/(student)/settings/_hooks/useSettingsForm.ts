/**
 * 설정 폼 상태 관리 훅
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { StudentFormData } from "../types";
import type { ValidationErrors } from "@/lib/utils/studentFormUtils";
import { hasFormDataChanges } from "../_utils/formComparison";

type UseSettingsFormProps = {
  initialFormData: StudentFormData;
  isInitialSetup: boolean;
};

export function useSettingsForm({
  initialFormData: initialData,
  isInitialSetup,
}: UseSettingsFormProps) {
  const [formData, setFormDataState] = useState<StudentFormData>(initialData);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const initialFormDataRef = useRef<StudentFormData | null>(initialData);

  // 초기 데이터가 변경되면 폼 데이터 업데이트
  useEffect(() => {
    if (initialData) {
      setFormDataState(initialData);
      initialFormDataRef.current = initialData;
    }
  }, [initialData]);

  // 폼 데이터 업데이트 함수
  const updateFormData = useCallback((updates: Partial<StudentFormData>) => {
    setFormDataState((prev) => ({ ...prev, ...updates }));
  }, []);

  // 폼 데이터 전체 설정 함수
  const setFormData = useCallback((data: StudentFormData) => {
    setFormDataState(data);
  }, []);

  // 초기 폼 데이터 설정 함수
  const setInitialFormData = useCallback((data: StudentFormData | null) => {
    initialFormDataRef.current = data;
  }, []);

  // 변경사항 추적
  const hasChanges = useMemo(() => {
    return hasFormDataChanges(initialFormDataRef.current, formData);
  }, [formData]);

  // 폼 리셋 함수
  const resetForm = useCallback(() => {
    if (initialFormDataRef.current) {
      setFormDataState(initialFormDataRef.current);
      setErrors({});
    }
  }, []);

  return {
    formData,
    errors,
    setFormData,
    updateFormData,
    setErrors,
    hasChanges,
    initialFormData: initialFormDataRef.current,
    setInitialFormData,
    resetForm,
  };
}


