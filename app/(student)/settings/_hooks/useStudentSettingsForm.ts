/**
 * 학생 설정 폼 훅 (react-hook-form 기반)
 * 관리자 useStudentInfoForm과 동일한 패턴
 */

import { useForm } from "react-hook-form";
import { useMemo, useEffect } from "react";
import type { StudentFormData } from "../types";
import { validateFormField } from "@/lib/utils/studentFormUtils";

type UseStudentSettingsFormProps = {
  initialData: StudentFormData | null;
};

export function useStudentSettingsForm({
  initialData,
}: UseStudentSettingsFormProps) {
  const defaultValues = useMemo<StudentFormData>(
    () =>
      initialData ?? {
        name: "",
        school_id: "",
        grade: "",
        class: "",
        birth_date: "",
        gender: "",
        phone: "",
        mother_phone: "",
        father_phone: "",
        address: "",
        exam_year: "",
        curriculum_revision: "",
        desired_university_ids: [],
        desired_career_field: "",
      },
    [initialData]
  );

  const form = useForm<StudentFormData>({
    defaultValues,
    mode: "onChange",
    shouldUnregister: false,
  });

  // 초기 데이터가 변경되면 폼 리셋
  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  // 필드별 유효성 검증
  const validateField = (
    field: keyof StudentFormData,
    value: string
  ) => {
    if (field === "name" || field === "phone") {
      return validateFormField(field, value);
    }
    if (
      field === "mother_phone" ||
      field === "father_phone"
    ) {
      if (value) {
        return validateFormField("phone", value);
      }
    }
    return undefined;
  };

  return {
    form,
    control: form.control,
    watch: form.watch,
    setValue: form.setValue,
    getValues: form.getValues,
    errors: form.formState.errors,
    isDirty: form.formState.isDirty,
    isSubmitting: form.formState.isSubmitting,
    handleSubmit: form.handleSubmit,
    reset: form.reset,
    validateField,
  };
}
