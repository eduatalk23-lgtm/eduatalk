"use client";

import { useState } from "react";
import { createSubjectType, updateSubjectType } from "@/app/(admin)/actions/subjectActions";
import { useAdminFormSubmit } from "@/lib/hooks/useAdminFormSubmit";
import { subjectTypeSchema } from "@/lib/validation/schemas";
import type { SubjectType } from "@/lib/data/subjects";

type UseSubjectTypeFormLogicProps = {
  subjectType?: SubjectType;
  curriculumRevisionId: string;
  onSuccess: () => void;
};

export function useSubjectTypeFormLogic({
  subjectType,
  curriculumRevisionId,
  onSuccess,
}: UseSubjectTypeFormLogicProps) {
  const [name, setName] = useState(subjectType?.name || "");
  const [isActive, setIsActive] = useState(subjectType?.is_active ?? true);

  const { handleSubmitWithFormData, isPending } = useAdminFormSubmit({
    action: async (formData: FormData) => {
      if (subjectType) {
        await updateSubjectType(subjectType.id, formData);
      } else {
        await createSubjectType(formData);
      }
    },
    schema: subjectTypeSchema,
    onSuccess: () => {
      onSuccess();
    },
    successMessage: subjectType ? "과목구분이 수정되었습니다." : "과목구분이 생성되었습니다.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("curriculum_revision_id", curriculumRevisionId);
    formData.set("is_active", isActive ? "true" : "false");
    handleSubmitWithFormData(formData);
  }

  return {
    name,
    isActive,
    isPending,
    setName,
    setIsActive,
    handleSubmit,
  };
}

