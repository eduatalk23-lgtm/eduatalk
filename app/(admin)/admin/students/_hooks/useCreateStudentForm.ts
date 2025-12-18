/**
 * 신규 학생 등록 폼 훅
 * React Hook Form을 사용하여 폼 상태 관리
 */

import { useForm, type UseFormReturn } from "react-hook-form";
import { useMemo } from "react";
import type { CreateStudentFormData } from "../_types/createStudentTypes";

type UseCreateStudentFormProps = {
  defaultValues?: Partial<CreateStudentFormData>;
};

export function useCreateStudentForm({
  defaultValues: initialDefaultValues,
}: UseCreateStudentFormProps = {}) {
  // 기본값 설정
  const defaultValues = useMemo<CreateStudentFormData>(
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

  // React Hook Form 설정
  const form = useForm<CreateStudentFormData>({
    defaultValues,
    mode: "onChange",
    shouldUnregister: false,
  });

  // 폼 제출 핸들러
  const handleSubmit = form.handleSubmit;

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
    handleSubmit,
    reset,
  };
}

