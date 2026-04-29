"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { X } from "lucide-react";
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
import {
  createPaymentAction,
  createInstallmentPaymentsAction,
} from "@/lib/domains/payment/actions";
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

/** startMonth에서 offset만큼 더한 날짜 계산 */
function getOffsetMonth(startMonth: string, offset: number): { year: number; month: number } {
  const [y, m] = startMonth.split("-").map(Number);
  const date = new Date(y, m - 1 + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** 해당 월의 마지막 일자 */
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 분납 행 key용 모듈 레벨 카운터 (컴포넌트 언마운트 후에도 안전) */
let rowIdSeq = 0;
function nextRowId(): string {
  return `row-${++rowIdSeq}`;
}

type PaymentMode = "single" | "installment";

type InstallmentRowData = {
  id: string;
  amount: number;
  dueDate: string;
  billingPeriod: string;
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
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onOpenChange(false);
      }}
      maxWidth="md"
    >
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

  // 납부 유형
  const [mode, setMode] = useState<PaymentMode>("single");

  // 금액
  const initAmount =
    enrollmentPrice && enrollmentPrice > 0 ? enrollmentPrice : 0;
  const [rawAmount, setRawAmount] = useState(initAmount);
  const [displayAmount, setDisplayAmount] = useState(
    formatNumber(initAmount)
  );

  // 청구 월 (일반 모드용)
  const [billingMonth, setBillingMonth] = useState(getCurrentMonth);
  const [dueDate, setDueDate] = useState("");
  const [memo, setMemo] = useState("");

  // 할인
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("rate");
  const [discountValueStr, setDiscountValueStr] = useState("");

  // 분납 설정
  const [installmentCount, setInstallmentCount] = useState(2);
  const [startMonth, setStartMonth] = useState(getCurrentMonth);
  const [dueDay, setDueDay] = useState(10);
  // 행별 안정적 ID (삭제 시에도 key가 밀리지 않도록)
  const [rowIds, setRowIds] = useState<string[]>(() =>
    Array.from({ length: 2 }, () => nextRowId())
  );
  // 수동 수정된 행만 추적 (idx → override)
  const [rowOverrides, setRowOverrides] = useState<
    Map<number, Partial<InstallmentRowData>>
  >(() => new Map());

  // 금액 입력 핸들러
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

  // 분납 행 자동 생성 (useMemo로 파생 — setState 대신)
  const installmentRows = useMemo<InstallmentRowData[]>(() => {
    if (mode !== "installment" || finalAmount <= 0 || installmentCount < 2)
      return [];

    const baseAmount = Math.floor(finalAmount / installmentCount);
    const remainder = finalAmount - baseAmount * installmentCount;

    return Array.from({ length: installmentCount }, (_, i) => {
      const override = rowOverrides.get(i);
      const { year, month } = getOffsetMonth(startMonth, i);
      const lastDay = getLastDayOfMonth(year, month);
      const clampedDay = Math.min(dueDay, lastDay);

      const defaultRow: InstallmentRowData = {
        id: rowIds[i] ?? `row-fallback-${i}`,
        amount:
          i === installmentCount - 1
            ? baseAmount + remainder
            : baseAmount,
        dueDate: `${year}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`,
        billingPeriod: `${year}년 ${month}월`,
      };

      if (!override) return defaultRow;

      return {
        ...defaultRow,
        amount: override.amount ?? defaultRow.amount,
        dueDate: override.dueDate ?? defaultRow.dueDate,
        billingPeriod: override.billingPeriod ?? defaultRow.billingPeriod,
      };
    });
  }, [mode, installmentCount, startMonth, dueDay, finalAmount, rowOverrides, rowIds]);

  // 분납 행 금액 수정
  const handleInstallmentAmountChange = useCallback(
    (idx: number, value: number) => {
      setRowOverrides((prev) => {
        const next = new Map(prev);
        next.set(idx, { ...next.get(idx), amount: value });
        return next;
      });
    },
    []
  );

  // 분납 행 납부기한 수정
  const handleInstallmentDateChange = useCallback(
    (idx: number, value: string) => {
      setRowOverrides((prev) => {
        const next = new Map(prev);
        next.set(idx, {
          ...next.get(idx),
          dueDate: value,
          billingPeriod: value
            ? monthValueToLabel(value.slice(0, 7))
            : next.get(idx)?.billingPeriod,
        });
        return next;
      });
    },
    []
  );

  // 분납 행 추가
  const addInstallmentRow = useCallback(() => {
    setInstallmentCount((c) => Math.min(24, c + 1));
    setRowIds((prev) => [...prev, nextRowId()]);
  }, []);

  // 분납 행 삭제
  const removeInstallmentRow = useCallback((idx: number) => {
    setInstallmentCount((c) => Math.max(2, c - 1));
    setRowIds((prev) => prev.filter((_, i) => i !== idx));
    // 오버라이드 재정렬: idx 이후 항목의 인덱스를 하나씩 당김
    setRowOverrides((prev) => {
      const next = new Map<number, Partial<InstallmentRowData>>();
      for (const [k, v] of prev) {
        if (k < idx) next.set(k, v);
        else if (k > idx) next.set(k - 1, v);
        // k === idx는 삭제
      }
      return next;
    });
  }, []);

  // 분납 합계 검증
  const installmentSum = useMemo(
    () => installmentRows.reduce((s, r) => s + r.amount, 0),
    [installmentRows]
  );
  const installmentSumDiff = finalAmount - installmentSum;
  const isInstallmentValid =
    installmentRows.length >= 2 &&
    installmentSumDiff === 0 &&
    installmentRows.every((r) => r.amount > 0);

  // 제출
  const handleSubmit = () => {
    if (!rawAmount || rawAmount <= 0) {
      toast.showError("금액을 입력해주세요.");
      return;
    }
    if (discountEnabled && !isDiscountValid) {
      toast.showError("할인 값을 확인해주세요.");
      return;
    }

    if (mode === "installment") {
      if (!isInstallmentValid) {
        if (installmentSumDiff !== 0) {
          toast.showError(
            `분납 합계(${installmentSum.toLocaleString()}원)가 총액(${finalAmount.toLocaleString()}원)과 일치하지 않습니다.`
          );
        } else {
          toast.showError("각 회차 금액은 0원보다 커야 합니다.");
        }
        return;
      }

      startTransition(async () => {
        try {
          const result = await createInstallmentPaymentsAction({
            enrollment_id: enrollmentId,
            student_id: studentId,
            total_amount: rawAmount,
            installments: installmentRows.map((r, idx) => ({
              amount: r.amount,
              due_date: r.dueDate,
              billing_period: r.billingPeriod,
              memo: memo
                ? `${memo} (${idx + 1}/${installmentRows.length}회)`
                : undefined,
            })),
            ...(discountEnabled && discountValue > 0
              ? { discount_type: discountType, discount_value: discountValue }
              : {}),
          });

          if (result.success) {
            toast.showSuccess(
              `분납 ${installmentRows.length}건이 추가되었습니다.`
            );
            onSuccess?.();
            onClose();
          } else {
            toast.showError(result.error ?? "분납 기록 추가에 실패했습니다.");
          }
        } catch (error) {
          toast.showError(
            error instanceof Error
              ? error.message
              : "분납 기록 추가에 실패했습니다."
          );
        }
      });
      return;
    }

    // 일반 모드
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

  const isSubmitDisabled =
    isPending ||
    rawAmount <= 0 ||
    (discountEnabled && !isDiscountValid) ||
    (mode === "installment" && !isInstallmentValid);

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 text-text-primary dark:text-gray-100">수납 추가</h2>
        <p className={cn("text-body-2", textSecondary)}>
          {programName} 수강에 대한 납부 건을 추가합니다.
        </p>
      </div>

      {/* 납부 유형 선택 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("single")}
          disabled={isPending}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            mode === "single"
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
              : "bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary dark:bg-gray-700 dark:text-text-tertiary dark:hover:bg-gray-600"
          )}
        >
          일반 (1건)
        </button>
        <button
          type="button"
          onClick={() => setMode("installment")}
          disabled={isPending}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            mode === "installment"
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
              : "bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary dark:bg-gray-700 dark:text-text-tertiary dark:hover:bg-gray-600"
          )}
        >
          분납 (N건)
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {/* 청구 월 (일반 모드) */}
        {mode === "single" && (
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
        )}

        {/* 금액 */}
        <div className="flex flex-col gap-2">
          <label className={cn("text-body-2 font-semibold", textPrimary)}>
            {mode === "installment" ? "총 금액" : "금액"}{" "}
            <span className="text-red-500">*</span>
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
              className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
            />
            <span className={cn("text-body-2 font-semibold", textPrimary)}>
              할인 적용
            </span>
          </label>

          {discountEnabled && (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3 dark:border-gray-600">
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
                      : "bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary dark:bg-gray-700 dark:text-text-tertiary dark:hover:bg-gray-600"
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
                      : "bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary dark:bg-gray-700 dark:text-text-tertiary dark:hover:bg-gray-600"
                  )}
                >
                  정액 (원)
                </button>
              </div>

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

              {rawAmount > 0 && discountValue > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-text-tertiary line-through dark:text-text-tertiary">
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

        {/* 분납 설정 (분납 모드) */}
        {mode === "installment" && finalAmount > 0 && (
          <div className="flex flex-col gap-3">
            {/* 빠른 설정 버튼 */}
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              분할 수
            </label>
            <div className="flex flex-wrap gap-2">
              {[2, 3, 4, 6, 12].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setInstallmentCount(n);
                    setRowOverrides(new Map());
                    setRowIds(
                      Array.from({ length: n }, () => nextRowId())
                    );
                  }}
                  disabled={isPending}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    installmentCount === n
                      ? "bg-indigo-600 text-white"
                      : "bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary dark:bg-gray-700 dark:text-text-tertiary"
                  )}
                >
                  {n <= 4 ? `${n}등분` : `${n}개월`}
                </button>
              ))}
            </div>

            {/* 시작월 + 납부일 */}
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <label className={cn("text-xs font-medium", textSecondary)}>
                  시작월
                </label>
                <input
                  type="month"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  disabled={isPending}
                  className={inputClass}
                />
              </div>
              <div className="flex w-24 flex-col gap-1">
                <label className={cn("text-xs font-medium", textSecondary)}>
                  납부일
                </label>
                <input
                  type="number"
                  value={dueDay}
                  onChange={(e) =>
                    setDueDay(
                      Math.max(1, Math.min(31, parseInt(e.target.value) || 1))
                    )
                  }
                  disabled={isPending}
                  min={1}
                  max={31}
                  className={cn(inputClass, "text-center")}
                />
              </div>
            </div>

            {/* 분납 내역 (수정 가능) */}
            {installmentRows.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label
                    className={cn("text-body-2 font-semibold", textPrimary)}
                  >
                    분납 내역 ({installmentRows.length}회)
                  </label>
                  <button
                    type="button"
                    onClick={addInstallmentRow}
                    disabled={isPending || installmentRows.length >= 24}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40 dark:text-indigo-400"
                  >
                    + 회차 추가
                  </button>
                </div>

                <div className="flex max-h-60 flex-col gap-2 overflow-y-auto rounded-lg border border-dashed border-border p-3 dark:border-gray-600">
                  {installmentRows.map((row, idx) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-8 shrink-0 text-center text-xs font-medium",
                          textSecondary
                        )}
                      >
                        {idx + 1}회
                      </span>
                      <div className="relative w-28 shrink-0">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            row.amount > 0
                              ? row.amount.toLocaleString("ko-KR")
                              : ""
                          }
                          onChange={(e) => {
                            const raw = e.target.value
                              .replace(/,/g, "")
                              .replace(/[^0-9]/g, "");
                            handleInstallmentAmountChange(
                              idx,
                              raw === "" ? 0 : parseInt(raw, 10)
                            );
                          }}
                          disabled={isPending}
                          placeholder="금액"
                          className={cn(
                            "w-full rounded border px-2 py-1 pr-6 text-right text-xs tabular-nums",
                            borderInput,
                            bgSurface,
                            textPrimary
                          )}
                        />
                        <span
                          className={cn(
                            "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px]",
                            textSecondary
                          )}
                        >
                          원
                        </span>
                      </div>
                      <input
                        type="date"
                        value={row.dueDate}
                        onChange={(e) =>
                          handleInstallmentDateChange(idx, e.target.value)
                        }
                        disabled={isPending}
                        className={cn(
                          "min-w-0 flex-1 rounded border px-2 py-1 text-xs",
                          borderInput,
                          bgSurface,
                          textPrimary
                        )}
                      />
                      {installmentRows.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeInstallmentRow(idx)}
                          disabled={isPending}
                          className="shrink-0 rounded p-1 text-text-tertiary hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                          aria-label={`${idx + 1}회차 삭제`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* 합계 검증 표시 */}
                {installmentSumDiff !== 0 ? (
                  <p className="text-xs text-red-500">
                    합계가{" "}
                    {installmentSumDiff > 0
                      ? `${installmentSumDiff.toLocaleString()}원 부족`
                      : `${Math.abs(installmentSumDiff).toLocaleString()}원 초과`}
                    합니다
                  </p>
                ) : (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    합계 {installmentSum.toLocaleString()}원 = 총액 일치
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 납부 기한 (일반 모드) */}
        {mode === "single" && (
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
        )}

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
            "bg-bg-secondary dark:bg-gray-800/50",
            "border-border dark:border-gray-700"
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
            <div className="flex items-center justify-between text-sm">
              <span className={textSecondary}>
                {hasDiscount ? "원가" : "청구액"}
              </span>
              <span className={cn("tabular-nums", textPrimary)}>
                {rawAmount.toLocaleString()}원
              </span>
            </div>
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
            {hasDiscount && (
              <>
                <div className="my-1 border-t border-border dark:border-gray-600" />
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
            {mode === "installment" && installmentRows.length > 0 && (
              <>
                <div className="my-1 border-t border-border dark:border-gray-600" />
                <div className="flex items-center justify-between text-sm">
                  <span className={textSecondary}>분할 수</span>
                  <span className={cn("tabular-nums", textPrimary)}>
                    {installmentRows.length}건
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={textSecondary}>건당 평균</span>
                  <span className={cn("tabular-nums", textPrimary)}>
                    {Math.round(
                      finalAmount / installmentRows.length
                    ).toLocaleString()}
                    원
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
          disabled={isSubmitDisabled}
          isLoading={isPending}
        >
          {isPending
            ? "추가 중..."
            : mode === "installment"
              ? `${installmentRows.length}건 분납 청구하기`
              : finalAmount > 0
                ? `${finalAmount.toLocaleString()}원 청구하기`
                : "청구하기"}
        </Button>
      </div>
    </div>
  );
}
