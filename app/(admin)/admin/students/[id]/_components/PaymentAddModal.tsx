"use client";

import { useState, useTransition, useMemo } from "react";
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
import type { DiscountType } from "@/lib/domains/payment/types";

type PaymentAddModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: string;
  studentId: string;
  enrollmentPrice: number | null;
  programName: string;
  onSuccess?: () => void;
};

/** 숫자를 천단위 쉼표 문자열로 */
function formatNumber(n: number): string {
  if (n === 0) return "";
  return n.toLocaleString("ko-KR");
}

/** "YYYY-MM" → "YYYY년 M월" */
function monthValueToLabel(value: string): string {
  if (!value) return "";
  const [y, m] = value.split("-");
  return `${y}년 ${parseInt(m, 10)}월`;
}

/** 현재 달의 "YYYY-MM" */
function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function PaymentAddModal({
  open,
  onOpenChange,
  enrollmentId,
  studentId,
  enrollmentPrice,
  programName,
  onSuccess,
}: PaymentAddModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onOpenChange(false);
      }}
      maxWidth="md"
    >
      {/* open 시 새로 마운트 → useState 초기값이 fresh하게 적용 */}
      {open && (
        <PaymentAddForm
          enrollmentId={enrollmentId}
          studentId={studentId}
          enrollmentPrice={enrollmentPrice}
          programName={programName}
          onSuccess={onSuccess}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

/** 실제 폼 - open 시 마운트되므로 초기값이 항상 정확 */
function PaymentAddForm({
  enrollmentId,
  studentId,
  enrollmentPrice,
  programName,
  onSuccess,
  onClose,
}: {
  enrollmentId: string;
  studentId: string;
  enrollmentPrice: number | null;
  programName: string;
  onSuccess?: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // 금액 (수강료 있으면 프리필)
  const initAmount =
    enrollmentPrice && enrollmentPrice > 0 ? enrollmentPrice : 0;
  const [rawAmount, setRawAmount] = useState(initAmount);
  const [displayAmount, setDisplayAmount] = useState(
    formatNumber(initAmount)
  );

  // 청구 월 (현재 달 기본값)
  const [billingMonth, setBillingMonth] = useState(getCurrentMonth);
  const [dueDate, setDueDate] = useState("");
  const [memo, setMemo] = useState("");

  // 할인
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("rate");
  const [discountValueStr, setDiscountValueStr] = useState("");

  // 금액 입력 핸들러 (천단위 쉼표 포맷)
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, "").replace(/[^0-9]/g, "");
    if (raw === "") {
      setRawAmount(0);
      setDisplayAmount("");
      return;
    }
    const num = parseInt(raw, 10);
    setRawAmount(num);
    setDisplayAmount(num.toLocaleString("ko-KR"));
  };

  const applyEnrollmentPrice = () => {
    if (enrollmentPrice && enrollmentPrice > 0) {
      setRawAmount(enrollmentPrice);
      setDisplayAmount(enrollmentPrice.toLocaleString("ko-KR"));
    }
  };

  const discountValue = parseFloat(discountValueStr) || 0;

  const finalAmount = useMemo(() => {
    if (!discountEnabled || discountValue <= 0 || rawAmount <= 0)
      return rawAmount;
    if (discountType === "fixed") return rawAmount - discountValue;
    return Math.round(rawAmount * (1 - discountValue / 100));
  }, [rawAmount, discountEnabled, discountType, discountValue]);

  const discountAmountCalc = rawAmount - finalAmount;
  const isDiscountValid =
    !discountEnabled || (discountValue > 0 && finalAmount > 0);
  const hasDiscount = discountEnabled && discountValue > 0 && finalAmount > 0;

  const billingPeriodFormatted = monthValueToLabel(billingMonth);

  const handleSubmit = () => {
    if (!rawAmount || rawAmount <= 0) {
      toast.showError("금액을 입력해주세요.");
      return;
    }
    if (discountEnabled && !isDiscountValid) {
      toast.showError("할인 값을 확인해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createPaymentAction({
          enrollment_id: enrollmentId,
          student_id: studentId,
          amount: rawAmount,
          due_date: dueDate || undefined,
          billing_period: billingPeriodFormatted || undefined,
          memo: memo || undefined,
          ...(discountEnabled && discountValue > 0
            ? { discount_type: discountType, discount_value: discountValue }
            : {}),
        });

        if (result.success) {
          toast.showSuccess("수납 기록이 추가되었습니다.");
          onSuccess?.();
          onClose();
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
    <div className="flex flex-col gap-5 p-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 text-gray-900 dark:text-gray-100">수납 추가</h2>
        <p className={cn("text-body-2", textSecondary)}>
          {programName} 수강에 대한 납부 건을 추가합니다.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* 청구 월 */}
        <div className="flex flex-col gap-2">
          <label className={cn("text-body-2 font-semibold", textPrimary)}>
            청구 월
          </label>
          <input
            type="month"
            value={billingMonth}
            onChange={(e) => setBillingMonth(e.target.value)}
            disabled={isPending}
            className={inputClass}
          />
        </div>

        {/* 금액 */}
        <div className="flex flex-col gap-2">
          <label className={cn("text-body-2 font-semibold", textPrimary)}>
            금액 <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={displayAmount}
              onChange={handleAmountChange}
              disabled={isPending}
              placeholder="0"
              className={cn(inputClass, "pr-10 text-right tabular-nums")}
            />
            <span
              className={cn(
                "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm",
                textSecondary
              )}
            >
              원
            </span>
          </div>
          {enrollmentPrice != null && enrollmentPrice > 0 && (
            <div className="flex items-center gap-2">
              <span className={cn("text-xs", textSecondary)}>
                수강료: {formatPrice(enrollmentPrice)}
              </span>
              {rawAmount !== enrollmentPrice && (
                <button
                  type="button"
                  onClick={applyEnrollmentPrice}
                  disabled={isPending}
                  className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                >
                  수강료 적용
                </button>
              )}
            </div>
          )}
        </div>

        {/* 할인 적용 */}
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={discountEnabled}
              onChange={(e) => {
                setDiscountEnabled(e.target.checked);
                if (!e.target.checked) setDiscountValueStr("");
              }}
              disabled={isPending}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className={cn("text-body-2 font-semibold", textPrimary)}>
              할인 적용
            </span>
          </label>

          {discountEnabled && (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-600">
              {/* 할인 유형 토글 */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType("rate");
                    setDiscountValueStr("");
                  }}
                  disabled={isPending}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    discountType === "rate"
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                  )}
                >
                  비율 (%)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType("fixed");
                    setDiscountValueStr("");
                  }}
                  disabled={isPending}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    discountType === "fixed"
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                  )}
                >
                  정액 (원)
                </button>
              </div>

              {/* 할인 값 입력 */}
              <div className="relative">
                <input
                  type="number"
                  value={discountValueStr}
                  onChange={(e) => setDiscountValueStr(e.target.value)}
                  disabled={isPending}
                  min={0}
                  max={discountType === "rate" ? 100 : undefined}
                  step={discountType === "rate" ? 1 : 10000}
                  placeholder={
                    discountType === "rate" ? "할인율 입력" : "할인 금액 입력"
                  }
                  className={cn(inputClass, "pr-10 text-right tabular-nums")}
                />
                <span
                  className={cn(
                    "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm",
                    textSecondary
                  )}
                >
                  {discountType === "rate" ? "%" : "원"}
                </span>
              </div>

              {/* 할인 인라인 미리보기 */}
              {rawAmount > 0 && discountValue > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 line-through dark:text-gray-500">
                    {rawAmount.toLocaleString()}원
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    →
                  </span>
                  {finalAmount > 0 ? (
                    <>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {finalAmount.toLocaleString()}원
                      </span>
                      <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                        {discountType === "rate"
                          ? `${discountValue}% 할인`
                          : `${discountAmountCalc.toLocaleString()}원 할인`}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-red-500">
                      할인 후 금액이 0원 이하입니다
                    </span>
                  )}
                </div>
              )}
            </div>
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

      {/* 청구 요약 카드 */}
      {rawAmount > 0 && (
        <div
          className={cn(
            "rounded-xl border p-4",
            "bg-gray-50 dark:bg-gray-800/50",
            "border-gray-200 dark:border-gray-700"
          )}
        >
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              textSecondary
            )}
          >
            청구 요약
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {/* 원가 행 */}
            <div className="flex items-center justify-between text-sm">
              <span className={textSecondary}>
                {hasDiscount ? "원가" : "청구액"}
              </span>
              <span className={cn("tabular-nums", textPrimary)}>
                {rawAmount.toLocaleString()}원
              </span>
            </div>
            {/* 할인 행 */}
            {hasDiscount && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-orange-600 dark:text-orange-400">
                  할인{" "}
                  <span className="text-xs">
                    ({discountType === "rate" ? `${discountValue}%` : "정액"})
                  </span>
                </span>
                <span className="tabular-nums text-orange-600 dark:text-orange-400">
                  -{discountAmountCalc.toLocaleString()}원
                </span>
              </div>
            )}
            {/* 구분선 + 최종 */}
            {hasDiscount && (
              <>
                <div className="my-1 border-t border-gray-200 dark:border-gray-600" />
                <div className="flex items-center justify-between">
                  <span className={cn("text-sm font-semibold", textPrimary)}>
                    최종 청구액
                  </span>
                  <span className="text-base font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                    {finalAmount.toLocaleString()}원
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          취소
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmit}
          disabled={
            isPending ||
            rawAmount <= 0 ||
            (discountEnabled && !isDiscountValid)
          }
          isLoading={isPending}
        >
          {isPending
            ? "추가 중..."
            : finalAmount > 0
              ? `${finalAmount.toLocaleString()}원 청구하기`
              : "청구하기"}
        </Button>
      </div>
    </div>
  );
}
