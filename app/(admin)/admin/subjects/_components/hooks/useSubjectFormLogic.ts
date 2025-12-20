"use client";

import { useState } from "react";
import { createSubject, updateSubject } from "@/app/(admin)/actions/subjectActions";
import { useAdminFormSubmit } from "@/lib/hooks/useAdminFormSubmit";
import { subjectSchema } from "@/lib/validation/schemas";
import type { Subject, SubjectType } from "@/lib/data/subjects";

type UseSubjectFormLogicProps = {
  subject?: Subject;
  subjectGroupId: string;
  subjectTypes: SubjectType[];
  onSuccess: () => void;
};

export function useSubjectFormLogic({
  subject,
  subjectGroupId,
  subjectTypes,
  onSuccess,
}: UseSubjectFormLogicProps) {
  const [name, setName] = useState(subject?.name || "");
  const [subjectTypeId, setSubjectTypeId] = useState(
    subject?.subject_type_id || ""
  );

  const { handleSubmitWithFormData, isPending } = useAdminFormSubmit({
    action: async (formData: FormData) => {
      if (subject) {
        await updateSubject(subject.id, formData);
      } else {
        await createSubject(formData);
      }
    },
    schema: subjectSchema,
    onSuccess: () => {
      onSuccess();
    },
    successMessage: subject ? "과목이 수정되었습니다." : "과목이 생성되었습니다.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("subject_group_id", subjectGroupId);
    formData.set("name", name.trim());
    if (subjectTypeId) {
      formData.set("subject_type_id", subjectTypeId);
    } else {
      formData.delete("subject_type_id");
    }
    handleSubmitWithFormData(formData);
  }

  return {
    name,
    subjectTypeId,
    isSubmitting: isPending,
    setName,
    setSubjectTypeId,
    handleSubmit,
  };
}

