"use client";

import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import BaseGroupForm from "./base/BaseGroupForm";
import { useGroupFormLogic } from "./hooks/useGroupFormLogic";
import type { SubjectGroup } from "@/lib/data/subjects";

type GroupFormModalProps = {
  group?: SubjectGroup;
  curriculumRevisionId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export default function GroupFormModal({
  group,
  curriculumRevisionId,
  onSuccess,
  onCancel,
}: GroupFormModalProps) {
  const { name, isPending, setName, handleSubmit } = useGroupFormLogic({
    group,
    curriculumRevisionId,
    onSuccess,
  });

  return (
    <Dialog
      open={true}
      onOpenChange={() => onCancel()}
      title={group ? "교과 수정" : "교과 추가"}
    >
      <DialogContent>
        <BaseGroupForm
          name={name}
          isPending={isPending}
          onNameChange={setName}
          onSubmit={handleSubmit}
          onCancel={onCancel}
          variant="modal"
        />
      </DialogContent>
    </Dialog>
  );
}
