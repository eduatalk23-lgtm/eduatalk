"use client";

import { useState, useTransition, useCallback } from "react";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
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
  const [showOverpayConfirm, setShowOverpayConfirm] = useState(false);

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

  const remaining = payment ? payment.amount - payment.paid_amount : 0;

  const executeConfirm = useCallback(() => {
    if (!payment) return;

    const paidAmount = parseInt(paidAmountStr, 10);
    const newPaidAmount = payment.paid_amount + paidAmount;

    startTransition(async () => {
      try {
        const result = await confirmPaymentAction({
          payment_id: payment.id,
          paid_amount: newPaidAmount,
          payment_method: paymentMethod as PaymentMethod,
          paid_date: paidDate,
          memo: memo || undefined,
        });

        if (result.success) {
          toast.showSuccess("수납이 처리되었습니다.");
          onSuccess?.();
          onOpenChange(false);
          resetForm();
        } else {
          toast.showError(result.error ?? "수납 처리에 실패했습니다.");
        }
      } catch (error) {
        toast.showError(
          error instanceof Error
            ? error.message
            : "수납 처리에 실패했습니다."
        );
      }
    });
  }, [payment, paidAmountStr, paymentMethod, paidDate, memo, toast, onSuccess, onOpenChange]);

  const handleSubmit = () => {
    if (!payment) return;

    const paidAmount = parseInt(paidAmountStr, 10);
    if (!paidAmount || paidAmount <= 0) {
      toast.showError("수납 금액을 입력해주세요.");
      return;
    }
    if (!paymentMethod) {
      toast.showError("수납 방법을 선택해주세요.");
      return;
    }
    if (paidAmount > remaining) {
      setShowOverpayConfirm(true);
      return;
    }

    executeConfirm();
  };

  const inputClass = cn(
    "w-full rounded-lg border px-4 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800",
    isPending && "opacity-50 cursor-not-allowed"
  );

  const paidAmountNum = parseInt(paidAmountStr, 10) || 0;
  const isFullPayment = remaining > 0 && paidAmountNum >= remaining;
  const isPartialPayment = paidAmountNum > 0 && paidAmountNum < remaining;

  return (
    <Dialog open={open} onOpenChange={handleOpen} maxWidth="md">
      <div className="flex flex-col gap-6 p-6">
        {/* 헤더 */}
        <div className="flex flex-col gap-2">
          <h2 className="text-h2 text-gray-900 dark:text-gray-100">
            수납 처리
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

        {/* 안내 문구 */}
        <div className="flex items-start gap-2.5 rounded-lg bg-blue-50 px-4 py-3 dark:bg-blue-950/30">
          <span className="mt-0.5 text-sm text-blue-500">i</span>
          <p className="text-xs leading-relaxed text-blue-700 dark:text-blue-300">
            현금, 계좌이체 등 오프라인으로 수납한 금액을 기록합니다.
            <br />
            Toss 온라인 결제 건은 자동으로 처리되므로 별도 입력이 필요 없습니다.
          </p>
        </div>

        {/* 기납부 / 잔액 요약 (부분납 상태일 때) */}
        {payment && payment.paid_amount > 0 && (
          <div className="flex items-center gap-4 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-800/50">
            <div className="flex flex-col">
              <span className={cn("text-[11px]", textSecondary)}>기납부</span>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                {formatPrice(payment.paid_amount)}
              </span>
            </div>
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
            <div className="flex flex-col">
              <span className={cn("text-[11px]", textSecondary)}>잔액</span>
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                {formatPrice(remaining)}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {/* 이번 수납 금액 */}
          <div className="flex flex-col gap-2">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              이번 수납 금액 (원) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={paidAmountStr}
              onChange={(e) => setPaidAmountStr(e.target.value)}
              disabled={isPending}
              min={0}
              step={10000}
              placeholder="이번에 수납한 금액"
              className={inputClass}
            />
            {remaining > 0 && (
              <p className={cn("text-xs", textSecondary)}>
                {isFullPayment && "잔액 전액으로 완납 처리됩니다."}
                {isPartialPayment &&
                  `잔액 ${formatPrice(remaining)} 중 일부만 입력하면 부분 수납으로 처리됩니다.`}
                {!isFullPayment &&
                  !isPartialPayment &&
                  `잔액: ${formatPrice(remaining)}`}
              </p>
            )}
          </div>

          {/* 수납 방법 */}
          <div className="flex flex-col gap-2">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              수납 방법 <span className="text-red-500">*</span>
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

          {/* 수납일 */}
          <div className="flex flex-col gap-2">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              수납일 <span className="text-red-500">*</span>
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
            {isPending ? "처리 중..." : "수납 처리"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showOverpayConfirm}
        onOpenChange={setShowOverpayConfirm}
        title="초과 수납 확인"
        description={`잔액(${formatPrice(remaining)})보다 큰 금액입니다. 계속하시겠습니까?`}
        confirmLabel="계속"
        onConfirm={() => {
          setShowOverpayConfirm(false);
          executeConfirm();
        }}
      />
    </Dialog>
  );
}
