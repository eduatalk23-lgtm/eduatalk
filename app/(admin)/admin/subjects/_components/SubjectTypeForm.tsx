"use client";

import BaseSubjectTypeForm from "./base/BaseSubjectTypeForm";
import { useSubjectTypeFormLogic } from "./hooks/useSubjectTypeFormLogic";
import type { SubjectType } from "@/lib/data/subjects";

type SubjectTypeFormProps = {
  subjectType?: SubjectType;
  curriculumRevisionId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export default function SubjectTypeForm({
  subjectType,
  curriculumRevisionId,
  onSuccess,
  onCancel,
}: SubjectTypeFormProps) {
  const {
    name,
    isActive,
    isPending,
    setName,
    setIsActive,
    handleSubmit,
  } = useSubjectTypeFormLogic({
    subjectType,
    curriculumRevisionId,
    onSuccess,
  });

  return (
    <BaseSubjectTypeForm
      name={name}
      isActive={isActive}
      isPending={isPending}
      onNameChange={setName}
      onIsActiveChange={setIsActive}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      variant="inline"
    />
  );
}
