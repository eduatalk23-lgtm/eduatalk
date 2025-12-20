/**
 * 신규 학생 등록 폼 훅
 * React Hook Form을 사용하여 폼 상태 관리
 * Zod 스키마를 통한 검증 통합
 */

import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import type { CreateStudentFormData } from "../_types/createStudentTypes";
import {
  createStudentFormSchema,
  type CreateStudentFormSchema,
} from "@/lib/validation/createStudentFormSchema";

type UseCreateStudentFormProps = {
  defaultValues?: Partial<CreateStudentFormData>;
};

export function useCreateStudentForm({
  defaultValues: initialDefaultValues,
}: UseCreateStudentFormProps = {}) {
  // 기본값 설정 (Zod 스키마에서 추론한 타입 사용)
  const defaultValues = useMemo<CreateStudentFormSchema>(
    () => ({
      // 기본 정보
      name: "",
      grade: "",
      class: "",
      birth_date: "",
      school_id: "",
      school_type: undefined,
      division: undefined,
      student_number: "",
      enrolled_at: "",
      status: "enrolled",
      // 프로필 정보
      gender: undefined,
      phone: "",
      mother_phone: "",
      father_phone: "",
      address: "",
      address_detail: "",
      postal_code: "",
      emergency_contact: "",
      emergency_contact_phone: "",
      medical_info: "",
      bio: "",
      interests: [],
      // 진로 정보
      exam_year: undefined,
      curriculum_revision: undefined,
      desired_university_ids: [],
      desired_career_field: "",
      target_major: "",
      target_major_2: "",
      target_score: undefined,
      target_university_type: "",
      notes: "",
      ...initialDefaultValues,
    }),
    [initialDefaultValues]
  );

  // React Hook Form 설정 (Zod 스키마 통합)
  const form = useForm<CreateStudentFormSchema>({
    resolver: zodResolver(createStudentFormSchema),
    defaultValues,
    mode: "onChange",
    shouldUnregister: false,
  });

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
    isValid: form.formState.isValid,
    isSubmitting: form.formState.isSubmitting,
    handleSubmit: form.handleSubmit,
    reset,
  };
}

