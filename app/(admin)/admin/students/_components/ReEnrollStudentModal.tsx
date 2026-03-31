"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { useQueryClient } from "@tanstack/react-query";
import { reEnrollStudentAction } from "@/lib/domains/student/actions/management";

type ReEnrollStudentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  previousReason?: string | null;
  previousDate?: string | null;
};

export function ReEnrollStudentModal({
  open,
  onOpenChange,
  studentId,
  studentName,
  previousReason,
  previousDate,
}: ReEnrollStudentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await reEnrollStudentAction(studentId);
      if (result.success) {
        showSuccess(`${studentName} 학생이 재등록되었습니다.`);
        queryClient.invalidateQueries({ queryKey: ["studentSearch"] });
        queryClient.invalidateQueries({ queryKey: ["studentDetail", studentId] });
        onOpenChange(false);
      } else {
        showError(result.error ?? "재등록에 실패했습니다.");
      }
    } catch {
      showError("재등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = previousDate
    ? new Date(previousDate).toLocaleDateString("ko-KR")
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <h2 className="text-lg font-semibold text-gray-900">재등록</h2>

        <div className="mt-4 space-y-4">
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
            대상: <span className="font-medium">{studentName}</span>
          </div>

          {(previousReason || formattedDate) && (
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
              <div>이전 사유: {previousReason ?? "-"}</div>
              {formattedDate && <div>비재원 전환일: {formattedDate}</div>}
            </div>
          )}

          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            재등록 시 서비스 접근이 즉시 활성화됩니다.
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "처리 중..." : "재등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
