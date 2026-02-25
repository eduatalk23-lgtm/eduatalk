"use client";

import { useState, useMemo } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  RefreshCw,
} from "lucide-react";
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
  billing_period: "desc",
  status: "asc",
  amount: "desc",
  paid_date: "desc",
  program_name: "asc",
};

/** 상태 긴급도 가중치 */
export const STATUS_ORDER: Record<string, number> = {
  unpaid: 0,
  partial: 1,
  paid: 2,
  refunded: 3,
};

/* ── Installment Group ── */

type InstallmentGroup = {
  enrollmentId: string;
  programName: string;
  payments: PaymentRecordWithEnrollment[];
  totalAmount: number;
  paidAmount: number;
  paidCount: number;
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set()
  );

  // 분납 그룹 계산 (전체 뷰 + 특정 수강 뷰 모두)
  const installmentGroups = useMemo(() => {
    const byEnrollment = new Map<string, PaymentRecordWithEnrollment[]>();
    for (const p of filteredPayments) {
      const key = p.enrollment_id;
      if (!byEnrollment.has(key)) byEnrollment.set(key, []);
      byEnrollment.get(key)!.push(p);
    }

    // 2건 이상인 그룹만 분납으로 표시
    const groups: InstallmentGroup[] = [];
    const ungrouped: PaymentRecordWithEnrollment[] = [];

    for (const [enrollmentId, items] of byEnrollment) {
      if (items.length >= 2) {
        groups.push({
          enrollmentId,
          programName: items[0].program_name,
          payments: items,
          totalAmount: items.reduce((s, p) => s + p.amount, 0),
          paidAmount: items.reduce((s, p) => s + p.paid_amount, 0),
          paidCount: items.filter((p) => p.status === "paid").length,
        });
      } else {
        ungrouped.push(...items);
      }
    }

    return groups.length > 0 ? { groups, ungrouped } : null;
  }, [filteredPayments]);

  // ungrouped 행의 시작 인덱스 (그룹 내 결제 건수 합산)
  const ungroupedStartIndex = useMemo(
    () =>
      installmentGroups
        ? installmentGroups.groups.reduce((s, g) => s + g.payments.length, 0)
        : 0,
    [installmentGroups]
  );

  const toggleGroup = (enrollmentId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(enrollmentId)) {
        next.delete(enrollmentId);
      } else {
        next.add(enrollmentId);
      }
      return next;
    });
  };

  // 테이블 헤더의 열 수 계산
  const colCount = isAllView ? 9 : 8;

  return (
    <div className={cn("rounded-lg border p-5", borderDefault, bgSurface)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className={cn("text-base font-semibold", textPrimary)}>
            수납 내역
          </h2>
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
              {installmentGroups ? (
                <>
                  {/* 분납 그룹 렌더 */}
                  {installmentGroups.groups.map((group) => {
                    const isExpanded = expandedGroups.has(group.enrollmentId);
                    return (
                      <InstallmentGroupRows
                        key={group.enrollmentId}
                        group={group}
                        isExpanded={isExpanded}
                        onToggle={() => toggleGroup(group.enrollmentId)}
                        colCount={colCount}
                        showProgram={isAllView}
                        onConfirmPayment={onConfirmPayment}
                        onDeletePayment={onDeletePayment}
                        onRefundPayment={onRefundPayment}
                        onCashReceipt={onCashReceipt}
                        onCancelCashReceipt={onCancelCashReceipt}
                      />
                    );
                  })}
                  {/* 단일 건 렌더 */}
                  {installmentGroups.ungrouped.map((payment, idx) => (
                    <PaymentRow
                      key={payment.id}
                      payment={payment}
                      index={ungroupedStartIndex + idx + 1}
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
                </>
              ) : (
                filteredPayments.map((payment, idx) => (
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
                ))
              )}
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

/* ── Installment Group Rows ── */

function InstallmentGroupRows({
  group,
  isExpanded,
  onToggle,
  colCount,
  showProgram,
  onConfirmPayment,
  onDeletePayment,
  onRefundPayment,
  onCashReceipt,
  onCancelCashReceipt,
}: {
  group: InstallmentGroup;
  isExpanded: boolean;
  onToggle: () => void;
  colCount: number;
  showProgram: boolean;
  onConfirmPayment: (payment: PaymentRecordWithEnrollment) => void;
  onDeletePayment: (paymentId: string) => void;
  onRefundPayment: (payment: PaymentRecordWithEnrollment) => void;
  onCashReceipt: (payment: PaymentRecordWithEnrollment) => void;
  onCancelCashReceipt: (paymentId: string) => void;
}) {
  const progress =
    group.payments.length > 0
      ? group.paidCount / group.payments.length
      : 0;

  return (
    <>
      {/* 그룹 헤더 */}
      <tr
        className="cursor-pointer border-b border-gray-200 bg-gray-50 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/30 dark:hover:bg-gray-800/50"
        onClick={onToggle}
      >
        <td colSpan={colCount} className="px-3 py-2.5">
          <div className="flex items-center gap-3">
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 text-gray-400 transition-transform",
                isExpanded && "rotate-90"
              )}
            />
            <span className={cn("text-sm font-medium", textPrimary)}>
              {group.programName} — {group.payments.length}회 분납
              <span className={cn("ml-2 text-xs font-normal", textSecondary)}>
                ({group.paidCount}/{group.payments.length} 완납)
              </span>
            </span>
            <div className="ml-auto flex items-center gap-3">
              {/* 진행 바 */}
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <span className={cn("text-xs tabular-nums", textSecondary)}>
                {group.paidAmount.toLocaleString()} /{" "}
                {group.totalAmount.toLocaleString()}원
              </span>
            </div>
          </div>
        </td>
      </tr>
      {/* 그룹 내 개별 행 */}
      {isExpanded &&
        group.payments.map((payment, idx) => (
          <PaymentRow
            key={payment.id}
            payment={payment}
            index={idx + 1}
            showProgram={showProgram}
            onConfirm={() => onConfirmPayment(payment)}
            onDelete={() => onDeletePayment(payment.id)}
            onRefund={
              payment.toss_payment_key
                ? () => onRefundPayment(payment)
                : undefined
            }
            onCashReceipt={() => onCashReceipt(payment)}
            onCancelCashReceipt={onCancelCashReceipt}
            isGroupChild
          />
        ))}
    </>
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
