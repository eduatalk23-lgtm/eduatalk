"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import { CreateStudentForm } from "./CreateStudentForm";
import { useToast } from "@/components/ui/ToastProvider";

type CreateStudentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (studentId: string, connectionCode: string) => void;
};

export function CreateStudentModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateStudentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleSuccess = (studentId: string, connectionCode: string) => {
    showSuccess(
      `학생이 등록되었습니다. 초대 코드: ${connectionCode} (초대 코드를 복사하세요)`
    );
    onSuccess?.(studentId, connectionCode);
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
      description="학생 정보를 입력하고 초대 코드를 생성합니다."
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

