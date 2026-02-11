"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { TossPaymentModal } from "@/components/payment/TossPaymentModal";
import {
  getParentPaymentsAction,
  type ParentPaymentsData,
} from "@/lib/domains/payment/actions/parentPayment";
import { prepareBatchTossPaymentAction } from "@/lib/domains/payment/actions/tossPayment";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  type PaymentRecordWithEnrollment,
} from "@/lib/domains/payment/types";
import { cn } from "@/lib/cn";
import {
  bgSurface,
  borderDefault,
  textPrimary,
  textSecondary,
  textMuted,
} from "@/lib/utils/darkMode";

const ALL_TAB = "__all__";

type BatchData = {
  orderId: string;
  amount: number;
  orderName: string;
  itemCount: number;
};

export function ParentPaymentContent() {
  const toast = useToast();
  const [data, setData] = useState<ParentPaymentsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState(ALL_TAB);
  const [paymentTarget, setPaymentTarget] =
    useState<PaymentRecordWithEnrollment | null>(null);

  // 일괄 결제 상태
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(
    new Set()
  );
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchData, setBatchData] = useState<BatchData | null>(null);
  const [isBatchPreparing, setIsBatchPreparing] = useState(false);

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getParentPaymentsAction();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        toast.showError(result.error ?? "결제 내역을 불러올 수 없습니다.");
      }
    } catch {
      toast.showError("결제 내역 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handlePaymentSuccess = () => {
    setPaymentTarget(null);
    setSelectedPaymentIds(new Set());
    setBatchData(null);
    setShowBatchModal(false);
    fetchPayments();
  };

  const isMultiStudent = (data?.students.length ?? 0) > 1;
  const showStudentTag = isMultiStudent && selectedStudentId === ALL_TAB;

  const filteredUnpaid = useMemo(() => {
    if (!data) return [];
    if (selectedStudentId === ALL_TAB) return data.unpaid;
    return data.unpaid.filter((p) => p.student_id === selectedStudentId);
  }, [data, selectedStudentId]);

  const filteredPaid = useMemo(() => {
    if (!data) return [];
    if (selectedStudentId === ALL_TAB) return data.paid;
    return data.paid.filter((p) => p.student_id === selectedStudentId);
  }, [data, selectedStudentId]);

  const totalUnpaidAmount = useMemo(
    () => filteredUnpaid.reduce((sum, p) => sum + p.amount, 0),
    [filteredUnpaid]
  );

  const unpaidByStudent = useMemo(() => {
    if (!data) return [];
    return data.students.map((s) => {
      const studentUnpaid = data.unpaid.filter(
        (p) => p.student_id === s.id
      );
      return {
        ...s,
        count: studentUnpaid.length,
        total: studentUnpaid.reduce((sum, p) => sum + p.amount, 0),
      };
    });
  }, [data]);

  // 체크박스 토글
  const togglePaymentSelection = useCallback((paymentId: string) => {
    setSelectedPaymentIds((prev) => {
      const next = new Set(prev);
      if (next.has(paymentId)) {
        next.delete(paymentId);
      } else {
        next.add(paymentId);
      }
      return next;
    });
  }, []);

  // 탭 변경 시 선택 초기화
  const handleStudentTabChange = useCallback((id: string) => {
    setSelectedStudentId(id);
    setSelectedPaymentIds(new Set());
  }, []);

  // 선택 해제
  const clearSelection = useCallback(() => {
    setSelectedPaymentIds(new Set());
  }, []);

  // 전체 선택/해제 토글
  const isAllSelected =
    filteredUnpaid.length > 0 &&
    filteredUnpaid.every((p) => selectedPaymentIds.has(p.id));

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedPaymentIds(new Set());
    } else {
      setSelectedPaymentIds(new Set(filteredUnpaid.map((p) => p.id)));
    }
  }, [isAllSelected, filteredUnpaid]);

  // 선택된 항목 합산 금액
  const selectedAmount = useMemo(
    () =>
      filteredUnpaid
        .filter((p) => selectedPaymentIds.has(p.id))
        .reduce((sum, p) => sum + p.amount, 0),
    [filteredUnpaid, selectedPaymentIds]
  );

  // 일괄 결제 핸들러
  const handleBatchPayment = useCallback(async () => {
    const ids = Array.from(selectedPaymentIds);
    if (ids.length < 2) return;

    setIsBatchPreparing(true);
    try {
      const result = await prepareBatchTossPaymentAction(ids);
      if (result.success && result.data) {
        setBatchData(result.data);
        setShowBatchModal(true);
      } else {
        toast.showError(result.error ?? "일괄 결제 준비에 실패했습니다.");
      }
    } catch {
      toast.showError("일괄 결제 준비 중 오류가 발생했습니다.");
    } finally {
      setIsBatchPreparing(false);
    }
  }, [selectedPaymentIds, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className={cn("text-sm", textSecondary)}>불러오는 중...</p>
      </div>
    );
  }

  if (!data) return null;

  const selectedStudentName =
    selectedStudentId === ALL_TAB
      ? null
      : data.students.find((s) => s.id === selectedStudentId)?.name;

  const selectedCount = selectedPaymentIds.size;
  const showFloatingBar = selectedCount >= 2;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className={cn("text-xl font-bold", textPrimary)}>결제</h1>

      {/* 요약 대시보드 */}
      <SummaryDashboard
        totalAmount={totalUnpaidAmount}
        totalCount={filteredUnpaid.length}
        isMultiStudent={isMultiStudent}
        unpaidByStudent={unpaidByStudent}
        selectedStudentName={selectedStudentName}
      />

      {/* 학생 탭 (2명 이상일 때만) */}
      {isMultiStudent && (
        <StudentTabs
          students={data.students}
          selectedId={selectedStudentId}
          onSelect={handleStudentTabChange}
          unpaidCounts={new Map(unpaidByStudent.map((s) => [s.id, s.count]))}
        />
      )}

      {/* 미납 결제 */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className={cn("text-base font-semibold", textPrimary)}>
            미납 내역
            {filteredUnpaid.length > 0 && (
              <span className="ml-2 text-sm font-normal text-red-500">
                {filteredUnpaid.length}건
              </span>
            )}
          </h2>
          {filteredUnpaid.length >= 2 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className={cn("text-sm", isAllSelected ? "text-blue-500" : textSecondary)}
            >
              {isAllSelected ? "전체 해제" : "전체 선택"}
            </button>
          )}
        </div>

        {filteredUnpaid.length === 0 ? (
          <div
            className={cn(
              "mt-3 rounded-lg border px-4 py-8 text-center",
              borderDefault,
              bgSurface
            )}
          >
            <p className={cn("text-sm", textSecondary)}>
              미납된 결제 내역이 없습니다.
            </p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {filteredUnpaid.map((payment) => (
              <UnpaidPaymentCard
                key={payment.id}
                payment={payment}
                showStudentTag={showStudentTag}
                isSelected={selectedPaymentIds.has(payment.id)}
                onToggleSelect={() => togglePaymentSelection(payment.id)}
                onPay={() => setPaymentTarget(payment)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 결제 이력 */}
      <section className={cn("mt-10", showFloatingBar && "pb-20")}>
        <h2 className={cn("text-base font-semibold", textPrimary)}>
          결제 이력
        </h2>

        {filteredPaid.length === 0 ? (
          <div
            className={cn(
              "mt-3 rounded-lg border px-4 py-8 text-center",
              borderDefault,
              bgSurface
            )}
          >
            <p className={cn("text-sm", textSecondary)}>
              결제 이력이 없습니다.
            </p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {filteredPaid.map((payment) => (
              <PaidPaymentRow
                key={payment.id}
                payment={payment}
                showStudentTag={showStudentTag}
              />
            ))}
          </div>
        )}
      </section>

      {/* 일괄 결제 플로팅 바 */}
      {showFloatingBar && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white px-4 py-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <button
              type="button"
              onClick={clearSelection}
              className={cn("text-sm", textSecondary, "hover:underline")}
            >
              선택 해제
            </button>
            <div className="flex items-center gap-4">
              <span className={cn("text-sm font-medium", textPrimary)}>
                {selectedCount}건 선택
              </span>
              <span className={cn("text-sm font-bold", textPrimary)}>
                {selectedAmount.toLocaleString()}원
              </span>
              <button
                type="button"
                onClick={handleBatchPayment}
                disabled={isBatchPreparing}
                className="shrink-0 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
              >
                {isBatchPreparing ? "준비 중..." : "일괄 결제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스 결제 모달 (단일) */}
      {paymentTarget && (
        <TossPaymentModal
          open={!!paymentTarget}
          onOpenChange={(open) => {
            if (!open) setPaymentTarget(null);
          }}
          paymentId={paymentTarget.id}
          programName={paymentTarget.program_name}
          amount={paymentTarget.amount}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* 토스 결제 모달 (일괄) */}
      {showBatchModal && batchData && (
        <TossPaymentModal
          open={showBatchModal}
          onOpenChange={(open) => {
            if (!open) {
              setShowBatchModal(false);
              setBatchData(null);
            }
          }}
          isBatch
          batchOrderId={batchData.orderId}
          programName={batchData.orderName}
          amount={batchData.amount}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

/* ──────── Sub-components ──────── */

function SummaryDashboard({
  totalAmount,
  totalCount,
  isMultiStudent,
  unpaidByStudent,
  selectedStudentName,
}: {
  totalAmount: number;
  totalCount: number;
  isMultiStudent: boolean;
  unpaidByStudent: { id: string; name: string; count: number; total: number }[];
  selectedStudentName: string | null | undefined;
}) {
  const hasUnpaid = totalCount > 0;

  return (
    <div
      className={cn(
        "mt-4 rounded-xl border px-5 py-4",
        borderDefault,
        bgSurface
      )}
    >
      {hasUnpaid ? (
        <>
          <p className={cn("text-sm", textMuted)}>
            {selectedStudentName
              ? `${selectedStudentName} 미납금액`
              : "총 미납금액"}
          </p>
          <p className="mt-1 text-2xl font-bold text-red-500">
            {totalAmount.toLocaleString()}원
          </p>
          {isMultiStudent && !selectedStudentName && (
            <div className="mt-3 flex flex-wrap gap-2">
              {unpaidByStudent
                .filter((s) => s.count > 0)
                .map((s) => (
                  <span
                    key={s.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                      borderDefault,
                      textSecondary
                    )}
                  >
                    {s.name}
                    <span className="font-semibold text-red-500">
                      {s.total.toLocaleString()}원
                    </span>
                  </span>
                ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs text-green-600 dark:bg-green-900 dark:text-green-400">
            ✓
          </span>
          <div>
            <p className={cn("text-sm font-medium", textPrimary)}>미납 없음</p>
            <p className={cn("text-xs", textMuted)}>
              모든 결제가 완료되었습니다
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentTabs({
  students,
  selectedId,
  onSelect,
  unpaidCounts,
}: {
  students: { id: string; name: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  unpaidCounts: Map<string, number>;
}) {
  return (
    <div className="mt-5 flex gap-2 overflow-x-auto">
      <TabButton
        label="전체"
        isActive={selectedId === ALL_TAB}
        onClick={() => onSelect(ALL_TAB)}
      />
      {students.map((s) => {
        const count = unpaidCounts.get(s.id) ?? 0;
        return (
          <TabButton
            key={s.id}
            label={s.name}
            badge={count > 0 ? count : undefined}
            isActive={selectedId === s.id}
            onClick={() => onSelect(s.id)}
          />
        );
      })}
    </div>
  );
}

function TabButton({
  label,
  badge,
  isActive,
  onClick,
}: {
  label: string;
  badge?: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        isActive
          ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
          : cn(
              "hover:bg-gray-50 dark:hover:bg-gray-800",
              borderDefault,
              textSecondary
            )
      )}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function StudentTag({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
      {name}
    </span>
  );
}

function UnpaidPaymentCard({
  payment,
  showStudentTag,
  isSelected,
  onToggleSelect,
  onPay,
}: {
  payment: PaymentRecordWithEnrollment;
  showStudentTag: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onPay: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-4 transition-colors",
        isSelected
          ? "border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-950/30"
          : cn(borderDefault, bgSurface)
      )}
    >
      {/* 체크박스 */}
      <button
        type="button"
        onClick={onToggleSelect}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
          isSelected
            ? "border-blue-500 bg-blue-500 text-white"
            : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
        )}
        aria-label={isSelected ? "선택 해제" : "선택"}
      >
        {isSelected && (
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </button>

      {/* 결제 정보 */}
      <div className="flex flex-1 items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {showStudentTag && payment.student_name && (
              <StudentTag name={payment.student_name} />
            )}
            <span className={cn("text-sm font-medium", textPrimary)}>
              {payment.program_name}
            </span>
          </div>
          <span className={cn("text-lg font-bold", textPrimary)}>
            {payment.amount.toLocaleString()}원
          </span>
          <div className="flex items-center gap-2">
            {payment.billing_period && (
              <span className={cn("text-xs", textSecondary)}>
                {payment.billing_period}
              </span>
            )}
            {payment.due_date && (
              <span className="text-xs text-red-500">
                납부기한: {payment.due_date}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onPay}
          className="shrink-0 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
        >
          결제하기
        </button>
      </div>
    </div>
  );
}

function PaidPaymentRow({
  payment,
  showStudentTag,
}: {
  payment: PaymentRecordWithEnrollment;
  showStudentTag: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        borderDefault,
        bgSurface
      )}
    >
      {/* 1행: 상태 + 학생 + 프로그램 + 영수증 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              PAYMENT_STATUS_COLORS[payment.status]
            )}
          >
            {PAYMENT_STATUS_LABELS[payment.status]}
          </span>
          {showStudentTag && payment.student_name && (
            <StudentTag name={payment.student_name} />
          )}
          <span className={cn("text-sm", textPrimary)}>
            {payment.program_name}
          </span>
        </div>
        {payment.toss_receipt_url && (
          <a
            href={payment.toss_receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-blue-500 hover:underline"
          >
            영수증
          </a>
        )}
      </div>
      {/* 2행: 금액 + 결제수단 + 날짜 */}
      <div className="mt-1.5 flex items-center gap-3">
        <span className={cn("text-sm font-medium", textPrimary)}>
          {payment.paid_amount.toLocaleString()}원
        </span>
        {payment.toss_method && (
          <span className={cn("text-xs", textMuted)}>{payment.toss_method}</span>
        )}
        {payment.paid_date && (
          <span className={cn("text-xs", textMuted)}>{payment.paid_date}</span>
        )}
      </div>
    </div>
  );
}
