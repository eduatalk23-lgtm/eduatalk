"use client";

import { useState } from "react";
import { createSubjectGroup, updateSubjectGroup } from "@/lib/domains/subject";
import { useAdminFormSubmit } from "@/lib/hooks/useAdminFormSubmit";
import { subjectGroupSchema } from "@/lib/validation/schemas";
import type { SubjectGroup } from "@/lib/data/subjects";

type UseGroupFormLogicProps = {
  group?: SubjectGroup;
  curriculumRevisionId: string;
  onSuccess: () => void;
};

export function useGroupFormLogic({
  group,
  curriculumRevisionId,
  onSuccess,
}: UseGroupFormLogicProps) {
  const [name, setName] = useState(group?.name || "");

  const { handleSubmitWithFormData, isPending } = useAdminFormSubmit({
    action: async (formData: FormData) => {
      if (group) {
        await updateSubjectGroup(group.id, formData);
      } else {
        await createSubjectGroup(formData);
      }
    },
    schema: subjectGroupSchema,
    onSuccess: () => {
      onSuccess();
    },
    successMessage: group ? "교과가 수정되었습니다." : "교과가 생성되었습니다.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("curriculum_revision_id", curriculumRevisionId);
    handleSubmitWithFormData(formData);
  }

  return {
    name,
    isPending,
    setName,
    handleSubmit,
  };
}

