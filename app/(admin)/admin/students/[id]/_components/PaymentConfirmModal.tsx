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
import { confirmPaymentAction } from "@/lib/domains/payment/actions";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type PaymentRecordWithEnrollment,
} from "@/lib/domains/payment/types";
import { formatPrice } from "@/app/(admin)/admin/programs/_components/priceUtils";

type PaymentConfirmModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: PaymentRecordWithEnrollment | null;
  onSuccess?: () => void;
};

export function PaymentConfirmModal({
  open,
  onOpenChange,
  payment,
  onSuccess,
}: PaymentConfirmModalProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [paidAmountStr, setPaidAmountStr] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [paidDate, setPaidDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [memo, setMemo] = useState("");

  const resetForm = () => {
    setPaidAmountStr("");
    setPaymentMethod("");
    setPaidDate(new Date().toISOString().slice(0, 10));
    setMemo("");
  };

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && payment) {
      const remaining = payment.amount - payment.paid_amount;
      setPaidAmountStr(String(remaining > 0 ? remaining : payment.amount));
    }
    onOpenChange(isOpen);
    if (!isOpen) resetForm();
  };

  const handleSubmit = () => {
    if (!payment) return;

    const paidAmount = parseInt(paidAmountStr, 10);
    if (!paidAmount || paidAmount <= 0) {
      toast.showError("납부 금액을 입력해주세요.");
      return;
    }
    if (!paymentMethod) {
      toast.showError("결제 방법을 선택해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await confirmPaymentAction({
          payment_id: payment.id,
          paid_amount: payment.paid_amount + paidAmount,
          payment_method: paymentMethod,
          paid_date: paidDate,
          memo: memo || undefined,
        });

        if (result.success) {
          toast.showSuccess("납부가 확인되었습니다.");
          onSuccess?.();
          onOpenChange(false);
          resetForm();
        } else {
          toast.showError(result.error ?? "납부 확인에 실패했습니다.");
        }
      } catch (error) {
        toast.showError(
          error instanceof Error
            ? error.message
            : "납부 확인에 실패했습니다."
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

  const remaining = payment ? payment.amount - payment.paid_amount : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpen} maxWidth="md">
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-h2 text-gray-900 dark:text-gray-100">
            납부 확인
          </h2>
          {payment && (
            <p className={cn("text-body-2", textSecondary)}>
              {payment.billing_period
                ? `${payment.billing_period} · `
                : ""}
              청구 {formatPrice(payment.amount)}
              {payment.paid_amount > 0 && (
                <> · 기납부 {formatPrice(payment.paid_amount)}</>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* 납부 금액 */}
          <div className="flex flex-col gap-2">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              납부 금액 (원) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={paidAmountStr}
              onChange={(e) => setPaidAmountStr(e.target.value)}
              disabled={isPending}
              min={0}
              step={10000}
              placeholder="실제 납부 금액"
              className={inputClass}
            />
            {remaining > 0 && (
              <p className={cn("text-xs", textSecondary)}>
                잔액: {formatPrice(remaining)}
              </p>
            )}
          </div>

          {/* 결제 방법 */}
          <div className="flex flex-col gap-2">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              결제 방법 <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod | "")
              }
              disabled={isPending}
              className={inputClass}
            >
              <option value="">선택하세요</option>
              {(
                Object.entries(PAYMENT_METHOD_LABELS) as [
                  PaymentMethod,
                  string,
                ][]
              ).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 납부일 */}
          <div className="flex flex-col gap-2">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              납부일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              disabled={isPending}
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
            disabled={isPending || !paidAmountStr || !paymentMethod}
            isLoading={isPending}
          >
            {isPending ? "확인 중..." : "납부 확인"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
