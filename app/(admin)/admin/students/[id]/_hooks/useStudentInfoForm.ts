/**
 * 관리자용 학생 정보 편집 폼 훅
 * React Hook Form을 사용하여 폼 상태 관리 및 변경사항 추적
 */

import { useForm, type UseFormReturn } from "react-hook-form";
import { useMemo, useEffect } from "react";
import type { AdminStudentFormData } from "../_types/studentFormTypes";
import { transformStudentToFormData } from "../_utils/studentFormTransform";
import type { StudentInfoData } from "../_types/studentFormTypes";
import { validateFormField } from "@/lib/utils/studentFormUtils";

type UseStudentInfoFormProps = {
  initialData: StudentInfoData | null;
};

export function useStudentInfoForm({
  initialData,
}: UseStudentInfoFormProps) {
  // 초기 폼 데이터 변환
  const defaultValues = useMemo(() => {
    return transformStudentToFormData(initialData);
  }, [initialData]);

  // React Hook Form 설정
  const form = useForm<AdminStudentFormData>({
    defaultValues,
    mode: "onChange",
    shouldUnregister: false,
  });

  // 초기 데이터가 변경되면 폼 리셋
  useEffect(() => {
    if (initialData) {
      const newDefaultValues = transformStudentToFormData(initialData);
      form.reset(newDefaultValues);
    }
  }, [initialData, form]);

  // 필드별 유효성 검증
  const validateField = (field: keyof AdminStudentFormData, value: string) => {
    // 기본 필드 검증
    if (field === "name" || field === "phone") {
      return validateFormField(field, value);
    }

    // 전화번호 필드 검증
    if (
      field === "mother_phone" ||
      field === "father_phone" ||
      field === "emergency_contact_phone"
    ) {
      if (value) {
        return validateFormField("phone", value);
      }
    }

    return undefined;
  };

  // 필수 필드 검증 (이름, 본인 연락처만)
  const validateRequired = (value: string, field: keyof AdminStudentFormData) => {
    if (field === "name" && !value.trim()) {
      return "이름을 입력해주세요";
    }
    if (field === "phone" && !value.trim()) {
      return "본인 연락처를 입력해주세요";
    }
    return undefined;
  };

  // 폼 제출 핸들러
  const handleSubmit = form.handleSubmit;

  // 변경사항 추적
  const isDirty = form.formState.isDirty;
  const dirtyFields = form.formState.dirtyFields;

  // 폼 리셋
  const reset = () => {
    form.reset(defaultValues);
  };

  return {
    form,
    register: form.register,
    control: form.control,
    watch: form.watch,
    setValue: form.setValue,
    getValues: form.getValues,
    errors: form.formState.errors,
    isDirty,
    dirtyFields,
    isValid: form.formState.isValid,
    isSubmitting: form.formState.isSubmitting,
    handleSubmit,
    reset,
    validateField,
    validateRequired,
  };
}

