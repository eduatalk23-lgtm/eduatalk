"use client";

import BaseGroupForm from "./base/BaseGroupForm";
import { useGroupFormLogic } from "./hooks/useGroupFormLogic";
import type { SubjectGroup } from "@/lib/data/subjects";

type GroupFormProps = {
  group?: SubjectGroup;
  curriculumRevisionId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export default function GroupForm({
  group,
  curriculumRevisionId,
  onSuccess,
  onCancel,
}: GroupFormProps) {
  const { name, isPending, setName, handleSubmit } = useGroupFormLogic({
    group,
    curriculumRevisionId,
    onSuccess,
  });

  return (
    <BaseGroupForm
      name={name}
      isPending={isPending}
      onNameChange={setName}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      variant="inline"
    />
  );
}
