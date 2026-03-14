"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import { CreateStudentForm } from "./CreateStudentForm";
import { useToast } from "@/components/ui/ToastProvider";

type CreateStudentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (studentId: string, joinUrl?: string) => void;
};

export function CreateStudentModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateStudentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleSuccess = (studentId: string, joinUrl?: string) => {
    if (joinUrl) {
      showSuccess("학생이 등록되었습니다. 초대 링크가 클립보드에 복사되었습니다.");
    } else {
      showSuccess("학생이 등록되었습니다.");
    }
    onSuccess?.(studentId, joinUrl);
    onOpenChange(false);
  };

  const handleError = (error: string) => {
    showError(error);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="신규 학생 등록"
      description="학생 정보를 입력하고 초대 링크를 생성합니다."
      size="4xl"
      showCloseButton
    >
      <DialogContent>
        <CreateStudentForm
          onSuccess={handleSuccess}
          onError={handleError}
          isSubmitting={isSubmitting}
          setIsSubmitting={setIsSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}
