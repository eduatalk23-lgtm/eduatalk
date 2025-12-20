"use client";

import BaseSubjectForm from "./base/BaseSubjectForm";
import { useSubjectFormLogic } from "./hooks/useSubjectFormLogic";
import type { Subject, SubjectType } from "@/lib/data/subjects";

type SubjectFormProps = {
  subject?: Subject;
  subjectGroupId: string;
  subjectTypes: SubjectType[];
  onSuccess: () => void;
  onCancel: () => void;
};

export default function SubjectForm({
  subject,
  subjectGroupId,
  subjectTypes,
  onSuccess,
  onCancel,
}: SubjectFormProps) {
  const {
    name,
    subjectTypeId,
    isSubmitting,
    setName,
    setSubjectTypeId,
    handleSubmit,
  } = useSubjectFormLogic({
    subject,
    subjectGroupId,
    subjectTypes,
    onSuccess,
  });

  return (
    <BaseSubjectForm
      name={name}
      subjectTypeId={subjectTypeId}
      subjectTypes={subjectTypes}
      isPending={isSubmitting}
      onNameChange={setName}
      onSubjectTypeChange={setSubjectTypeId}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      variant="inline"
    />
  );
}
