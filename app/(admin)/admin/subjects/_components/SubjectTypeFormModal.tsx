"use client";

import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import BaseSubjectTypeForm from "./base/BaseSubjectTypeForm";
import { useSubjectTypeFormLogic } from "./hooks/useSubjectTypeFormLogic";
import type { SubjectType } from "@/lib/data/subjects";

type SubjectTypeFormModalProps = {
  subjectType?: SubjectType;
  curriculumRevisionId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export default function SubjectTypeFormModal({
  subjectType,
  curriculumRevisionId,
  onSuccess,
  onCancel,
}: SubjectTypeFormModalProps) {
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
    <Dialog
      open={true}
      onOpenChange={() => onCancel()}
      title={subjectType ? "과목구분 수정" : "과목구분 추가"}
    >
      <DialogContent>
        <BaseSubjectTypeForm
          name={name}
          isActive={isActive}
          isPending={isPending}
          onNameChange={setName}
          onIsActiveChange={setIsActive}
          onSubmit={handleSubmit}
          onCancel={onCancel}
          variant="modal"
        />
      </DialogContent>
    </Dialog>
  );
}
