"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import Button from "@/components/atoms/Button";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  textPrimary,
  textSecondary,
} from "@/lib/utils/darkMode";
import { createPaymentAction } from "@/lib/domains/payment/actions";
import { formatPrice } from "@/app/(admin)/admin/programs/_components/priceUtils";

type PaymentAddModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: string;
  studentId: string;
  enrollmentPrice: number | null;
  programName: string;
  onSuccess?: () => void;
};

export function PaymentAddModal({
  open,
  onOpenChange,
  enrollmentId,
  studentId,
  enrollmentPrice,
  programName,
  onSuccess,
}: PaymentAddModalProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [amountStr, setAmountStr] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [billingPeriod, setBillingPeriod] = useState("");
  const [memo, setMemo] = useState("");

  const resetForm = () => {
    setAmountStr("");
    setDueDate("");
    setBillingPeriod("");
    setMemo("");
  };

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && enrollmentPrice && enrollmentPrice > 0) {
      setAmountStr(String(enrollmentPrice));
    }
    onOpenChange(isOpen);
    if (!isOpen) resetForm();
  };

  const handleSubmit = () => {
    const amount = parseInt(amountStr, 10);
    if (!amount || amount <= 0) {
      toast.showError("금액을 입력해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createPaymentAction({
          enrollment_id: enrollmentId,
          student_id: studentId,
          amount,
          due_date: dueDate || undefined,
          billing_period: billingPeriod || undefined,
          memo: memo || undefined,
        });

        if (result.success) {
          toast.showSuccess("수납 기록이 추가되었습니다.");
          onSuccess?.();
          onOpenChange(false);
          resetForm();
        } else {
          toast.showError(result.error ?? "수납 기록 추가에 실패했습니다.");
        }
      } catch (error) {
        toast.showError(
          error instanceof Error
            ? error.message
            : "수납 기록 추가에 실패했습니다."
        );
      }
    });
  };

  const inputClass = cn(
    "w-full rounded-lg border px-4 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800",
    isPending && "opacity-50 cursor-not-allowed"
  );

  return (
    <Dialog open={open} onOpenChange={handleOpen} maxWidth="md">
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-h2 text-gray-900 dark:text-gray-100">
            수납 추가
          </h2>
          <p className={cn("text-body-2", textSecondary)}>
            {programName} 수강에 대한 납부 건을 추가합니다.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {/* 금액 */}
          <div className="flex flex-col gap-2">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              금액 (원) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              disabled={isPending}
              min={0}
              step={10000}
              placeholder="납부 예정 금액"
              className={inputClass}
            />
            {enrollmentPrice != null && enrollmentPrice > 0 && (
              <p className={cn("text-xs", textSecondary)}>
                수강료: {formatPrice(enrollmentPrice)}
              </p>
            )}
          </div>

          {/* 납부 기한 */}
          <div className="flex flex-col gap-2">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              납부 기한
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isPending}
              className={inputClass}
            />
          </div>

          {/* 청구 기간 */}
          <div className="flex flex-col gap-2">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              청구 기간
            </label>
            <input
              type="text"
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value)}
              disabled={isPending}
              placeholder="예: 2026년 3월"
              className={inputClass}
            />
          </div>

          {/* 메모 */}
          <div className="flex flex-col gap-2">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              메모 (선택)
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              disabled={isPending}
              rows={2}
              placeholder="비고 사항을 입력하세요"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            disabled={isPending}
          >
            취소
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={isPending || !amountStr}
            isLoading={isPending}
          >
            {isPending ? "추가 중..." : "추가"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
