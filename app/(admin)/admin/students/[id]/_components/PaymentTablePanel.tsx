"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown, RefreshCw } from "lucide-react";
import Button from "@/components/atoms/Button";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  bgSurface,
  borderDefault,
  tableHeaderBase,
} from "@/lib/utils/darkMode";
import type { EnrollmentWithProgram } from "@/lib/domains/enrollment/types";
import type { PaymentRecordWithEnrollment } from "@/lib/domains/payment/types";
import { PaymentSummaryBar } from "./PaymentSummaryBar";
import { PaymentRow } from "./PaymentRow";

/* ── Sort Types ── */

export type SortKey =
  | "billing_period"
  | "status"
  | "amount"
  | "paid_date"
  | "program_name";

export type SortDirection = "asc" | "desc";

export type SortState = {
  key: SortKey;
  direction: SortDirection;
};

/** 데이터 타입별 첫 클릭 기본 방향 */
export const DEFAULT_SORT_DIRECTION: Record<SortKey, SortDirection> = {
  billing_period: "desc", // 최신 우선
  status: "asc", // 긴급도순 (미납 우선)
  amount: "desc", // 큰 금액 우선
  paid_date: "desc", // 최신 우선
  program_name: "asc", // 가나다순
};

/** 상태 긴급도 가중치 */
export const STATUS_ORDER: Record<string, number> = {
  unpaid: 0,
  partial: 1,
  paid: 2,
  refunded: 3,
};

/* ── Component ── */

type PaymentTablePanelProps = {
  payments: PaymentRecordWithEnrollment[];
  filteredPayments: PaymentRecordWithEnrollment[];
  paymentSummary: { total: number; paid: number; unpaid: number };
  isAllView: boolean;
  selectedEnrollment: EnrollmentWithProgram | null;
  sortState: SortState;
  onSort: (key: SortKey) => void;
  onSelectAll: () => void;
  onAddPayment: () => void;
  onConfirmPayment: (payment: PaymentRecordWithEnrollment) => void;
  onDeletePayment: (paymentId: string) => void;
  onRefundPayment: (payment: PaymentRecordWithEnrollment) => void;
  onCashReceipt: (payment: PaymentRecordWithEnrollment) => void;
  onCancelCashReceipt: (paymentId: string) => void;
  onSyncTossStatus?: () => void;
  isSyncing?: boolean;
};

export function PaymentTablePanel({
  payments,
  filteredPayments,
  paymentSummary,
  isAllView,
  selectedEnrollment,
  sortState,
  onSort,
  onSelectAll,
  onAddPayment,
  onConfirmPayment,
  onDeletePayment,
  onRefundPayment,
  onCashReceipt,
  onCancelCashReceipt,
  onSyncTossStatus,
  isSyncing,
}: PaymentTablePanelProps) {
  return (
    <div className={cn("rounded-lg border p-5", borderDefault, bgSurface)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className={cn("text-base font-semibold", textPrimary)}>
            수납 내역
          </h2>
          {/* 전체/개별 필터 토글 */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
            <button
              type="button"
              onClick={onSelectAll}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                isAllView
                  ? "bg-indigo-600 text-white"
                  : cn(
                      textSecondary,
                      "hover:bg-gray-100 dark:hover:bg-gray-700"
                    )
              )}
            >
              전체 {payments.length}건
            </button>
            {selectedEnrollment && (
              <span className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white">
                {selectedEnrollment.program_name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onSyncTossStatus && (
            <Button
              variant="secondary"
              size="xs"
              onClick={onSyncTossStatus}
              disabled={isSyncing}
              className="text-xs text-[var(--text-primary)]"
            >
              <RefreshCw
                className={cn("h-3 w-3", isSyncing && "animate-spin")}
              />
              {isSyncing ? "동기화 중..." : "토스 동기화"}
            </Button>
          )}
          {(isAllView || selectedEnrollment) && (
            <Button
              variant="primary"
              size="xs"
              onClick={onAddPayment}
              className="text-xs text-white"
            >
              + 수납 추가
            </Button>
          )}
        </div>
      </div>

      {/* 서브 텍스트 */}
      {!isAllView && selectedEnrollment && (
        <p className={cn("mt-1 text-xs", textSecondary)}>
          {selectedEnrollment.program_code
            ? `(${selectedEnrollment.program_code}) `
            : ""}
          {selectedEnrollment.start_date} ~ · {filteredPayments.length}건
        </p>
      )}

      {/* 요약 바 */}
      {filteredPayments.length > 0 && (
        <PaymentSummaryBar
          total={paymentSummary.total}
          paid={paymentSummary.paid}
          unpaidCount={paymentSummary.unpaid}
        />
      )}

      {/* 수납 테이블 */}
      {filteredPayments.length > 0 ? (
        <div className="mt-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className={cn(tableHeaderBase, "w-10 text-center")}>
                  No.
                </th>
                <SortableHeader
                  label="청구월"
                  sortKey="billing_period"
                  sortState={sortState}
                  onSort={onSort}
                  className="w-[84px]"
                />
                {isAllView && (
                  <SortableHeader
                    label="프로그램"
                    sortKey="program_name"
                    sortState={sortState}
                    onSort={onSort}
                    className="w-36"
                  />
                )}
                <SortableHeader
                  label="상태"
                  sortKey="status"
                  sortState={sortState}
                  onSort={onSort}
                  className="w-20"
                />
                <th className={cn(tableHeaderBase, "w-20")}>유형</th>
                <SortableHeader
                  label="금액"
                  sortKey="amount"
                  sortState={sortState}
                  onSort={onSort}
                  className="w-32"
                  align="right"
                />
                <th className={cn(tableHeaderBase, "w-20")}>결제방법</th>
                <SortableHeader
                  label="날짜"
                  sortKey="paid_date"
                  sortState={sortState}
                  onSort={onSort}
                  className="w-24"
                />
                <th className={cn(tableHeaderBase, "w-24 text-right")}>
                  액션
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment, idx) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  index={idx + 1}
                  showProgram={isAllView}
                  onConfirm={() => onConfirmPayment(payment)}
                  onDelete={() => onDeletePayment(payment.id)}
                  onRefund={
                    payment.toss_payment_key
                      ? () => onRefundPayment(payment)
                      : undefined
                  }
                  onCashReceipt={() => onCashReceipt(payment)}
                  onCancelCashReceipt={onCancelCashReceipt}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-8 text-center">
          <p className={cn("text-sm", textSecondary)}>
            수납 기록이 없습니다.
          </p>
          <p className={cn("mt-1 text-xs", textSecondary)}>
            &apos;+ 수납 추가&apos; 버튼으로 첫 수납을 등록하세요.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Sortable Header ── */

function SortableHeader({
  label,
  sortKey,
  sortState,
  onSort,
  className,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sortState: SortState;
  onSort: (key: SortKey) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const isActive = sortState.key === sortKey;
  const direction = isActive ? sortState.direction : null;

  return (
    <th
      className={cn(tableHeaderBase, className, align === "right" && "text-right")}
      aria-sort={
        isActive
          ? direction === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "group inline-flex items-center gap-0.5 transition-colors",
          align === "right" && "flex-row-reverse",
          isActive
            ? "text-indigo-600 dark:text-indigo-400"
            : "hover:text-gray-700 dark:hover:text-gray-300"
        )}
      >
        <span>{label}</span>
        <span
          className={cn(
            "inline-flex h-3.5 w-3.5 items-center justify-center transition-opacity",
            isActive
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-40"
          )}
        >
          {direction === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : direction === "desc" ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronsUpDown className="h-3 w-3" />
          )}
        </span>
      </button>
    </th>
  );
}
