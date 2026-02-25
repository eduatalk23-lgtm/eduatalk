/**
 * 신규 학생 등록 폼 훅
 * React Hook Form + Zod 스키마 통합
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import {
  createStudentFormSchema,
  type CreateStudentFormSchema,
} from "@/lib/validation/createStudentFormSchema";

type UseCreateStudentFormProps = {
  defaultValues?: Partial<CreateStudentFormSchema>;
};

export function useCreateStudentForm({
  defaultValues: initialDefaultValues,
}: UseCreateStudentFormProps = {}) {
  const defaultValues = useMemo(
    () =>
      ({
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
        status: "enrolled" as const,
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
      }) satisfies Partial<CreateStudentFormSchema>,
    [initialDefaultValues]
  );

  // zodResolver 타입은 .default() 필드 때문에 input/output 차이가 남
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<CreateStudentFormSchema>({
    resolver: zodResolver(createStudentFormSchema) as any,
    defaultValues: defaultValues as Partial<CreateStudentFormSchema>,
    mode: "onChange",
    shouldUnregister: false,
  });

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
