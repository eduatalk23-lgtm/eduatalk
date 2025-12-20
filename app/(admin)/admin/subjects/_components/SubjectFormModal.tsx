"use client";

import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import BaseSubjectForm from "./base/BaseSubjectForm";
import { useSubjectFormLogic } from "./hooks/useSubjectFormLogic";
import type { Subject, SubjectType } from "@/lib/data/subjects";

type SubjectFormModalProps = {
  subject?: Subject;
  subjectGroupId: string;
  curriculumRevisionId: string;
  subjectTypes: SubjectType[];
  onSuccess: () => void;
  onCancel: () => void;
};

export default function SubjectFormModal({
  subject,
  subjectGroupId,
  curriculumRevisionId,
  subjectTypes,
  onSuccess,
  onCancel,
}: SubjectFormModalProps) {
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
    <Dialog
      open={true}
      onOpenChange={() => onCancel()}
      title={subject ? "과목 수정" : "과목 추가"}
    >
      <DialogContent>
        <BaseSubjectForm
          name={name}
          subjectTypeId={subjectTypeId}
          subjectTypes={subjectTypes}
          isPending={isSubmitting}
          onNameChange={setName}
          onSubjectTypeChange={setSubjectTypeId}
          onSubmit={handleSubmit}
          onCancel={onCancel}
          variant="modal"
        />
      </DialogContent>
    </Dialog>
  );
}
