"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { useQueryClient } from "@tanstack/react-query";
import { WITHDRAWN_REASONS } from "@/lib/constants/students";
import { withdrawStudentAction } from "@/lib/domains/student/actions/management";

type WithdrawStudentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
};

export function WithdrawStudentModal({
  open,
  onOpenChange,
  studentId,
  studentName,
}: WithdrawStudentModalProps) {
  const [reason, setReason] = useState("");
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!reason) {
      showError("사유를 선택해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await withdrawStudentAction(studentId, reason, memo || undefined);
      if (result.success) {
        showSuccess(`${studentName} 학생이 비재원 처리되었습니다.`);
        queryClient.invalidateQueries({ queryKey: ["studentSearch"] });
        queryClient.invalidateQueries({ queryKey: ["studentDetail", studentId] });
        onOpenChange(false);
        setReason("");
        setMemo("");
      } else {
        showError(result.error ?? "비재원 처리에 실패했습니다.");
      }
    } catch {
      showError("비재원 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <h2 className="text-lg font-semibold text-gray-900">비재원 처리</h2>

        <div className="mt-4 space-y-4">
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
            대상: <span className="font-medium">{studentName}</span>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              사유 <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">선택해주세요</option>
              {WITHDRAWN_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              메모 <span className="text-gray-400">(선택)</span>
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              placeholder="상세 사유를 입력해주세요"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            비재원 처리 시 서비스 접근이 즉시 차단됩니다.
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
            variant="danger"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason}
          >
            {isSubmitting ? "처리 중..." : "비재원 처리"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
