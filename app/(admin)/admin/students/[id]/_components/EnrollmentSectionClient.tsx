"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  bgSurface,
  borderDefault,
} from "@/lib/utils/darkMode";
import { deleteEnrollmentAction } from "@/lib/domains/enrollment/actions";
import {
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_STATUS_COLORS,
  type EnrollmentWithProgram,
} from "@/lib/domains/enrollment/types";
import { deletePaymentAction } from "@/lib/domains/payment/actions";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
  type PaymentRecordWithEnrollment,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/domains/payment/types";
import type { Program } from "@/lib/domains/crm/types";
import { formatPrice } from "@/app/(admin)/admin/programs/_components/priceUtils";
import { EnrollmentAddModal } from "./EnrollmentAddModal";
import { EnrollmentStatusSelect } from "./EnrollmentStatusSelect";
import { PaymentAddModal } from "./PaymentAddModal";
import { PaymentConfirmModal } from "./PaymentConfirmModal";
import { PaymentRefundModal } from "./PaymentRefundModal";
import { CashReceiptModal } from "./CashReceiptModal";
import { cancelCashReceiptAction } from "@/lib/domains/payment/actions/cashReceipt";

type ConsultantOption = { id: string; name: string; role: string };

type EnrollmentSectionClientProps = {
  studentId: string;
  enrollments: EnrollmentWithProgram[];
  programs: Program[];
  payments: PaymentRecordWithEnrollment[];
  consultants?: ConsultantOption[];
};

export function EnrollmentSectionClient({
  studentId,
  enrollments,
  programs,
  payments,
  consultants = [],
}: EnrollmentSectionClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // 선택된 수강 (오른쪽 패널용)
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<
    string | null
  >(() => {
    const active = enrollments.find((e) => e.status === "active");
    return active?.id ?? enrollments[0]?.id ?? null;
  });

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "enrollment" | "payment";
    id: string;
  } | null>(null);
  const [paymentAddTarget, setPaymentAddTarget] =
    useState<EnrollmentWithProgram | null>(null);
  const [paymentConfirmTarget, setPaymentConfirmTarget] =
    useState<PaymentRecordWithEnrollment | null>(null);
  const [refundTarget, setRefundTarget] =
    useState<PaymentRecordWithEnrollment | null>(null);
  const [cashReceiptTarget, setCashReceiptTarget] =
    useState<PaymentRecordWithEnrollment | null>(null);

  const selectedEnrollment = enrollments.find(
    (e) => e.id === selectedEnrollmentId
  );

  const selectedPayments = useMemo(
    () =>
      payments
        .filter((p) => p.enrollment_id === selectedEnrollmentId)
        .sort((a, b) => {
          const dateA = a.due_date ?? a.created_at;
          const dateB = b.due_date ?? b.created_at;
          return dateA.localeCompare(dateB);
        }),
    [payments, selectedEnrollmentId]
  );

  // 선택된 수강의 수납 요약
  const paymentSummary = useMemo(() => {
    const total = selectedPayments.reduce((s, p) => s + p.amount, 0);
    const paid = selectedPayments.reduce((s, p) => s + p.paid_amount, 0);
    const unpaid = selectedPayments.filter(
      (p) => p.status === "unpaid" || p.status === "partial"
    ).length;
    return { total, paid, unpaid };
  }, [selectedPayments]);

  const activeEnrollments = enrollments.filter((e) => e.status === "active");
  const historyEnrollments = enrollments.filter((e) => e.status !== "active");

  const handleDelete = () => {
    if (!deleteTarget) return;

    startTransition(async () => {
      try {
        const result =
          deleteTarget.type === "enrollment"
            ? await deleteEnrollmentAction(deleteTarget.id)
            : await deletePaymentAction(deleteTarget.id);

        if (result.success) {
          toast.showSuccess(
            deleteTarget.type === "enrollment"
              ? "수강 등록이 삭제되었습니다."
              : "수납 기록이 삭제되었습니다."
          );
          if (
            deleteTarget.type === "enrollment" &&
            deleteTarget.id === selectedEnrollmentId
          ) {
            const remaining = enrollments.filter(
              (e) => e.id !== deleteTarget.id
            );
            setSelectedEnrollmentId(remaining[0]?.id ?? null);
          }
          router.refresh();
        } else {
          toast.showError(result.error ?? "삭제에 실패했습니다.");
        }
      } catch (error) {
        toast.showError(
          error instanceof Error ? error.message : "삭제에 실패했습니다."
        );
      } finally {
        setDeleteTarget(null);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ──────── 왼쪽: 수강 프로그램 ──────── */}
        <div
          className={cn(
            "rounded-lg border p-5 lg:col-span-2",
            borderDefault,
            bgSurface
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className={cn("text-base font-semibold", textPrimary)}>
              수강 프로그램
            </h2>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddModal(true)}
            >
              + 등록
            </Button>
          </div>

          {/* Active */}
          {activeEnrollments.length > 0 && (
            <div className="mt-4">
              <h3
                className={cn(
                  "flex items-center gap-2 text-xs font-medium",
                  textSecondary
                )}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                수강중
              </h3>
              <div className="mt-2 flex flex-col gap-1.5">
                {activeEnrollments.map((e) => (
                  <ProgramItem
                    key={e.id}
                    enrollment={e}
                    isSelected={e.id === selectedEnrollmentId}
                    onClick={() => setSelectedEnrollmentId(e.id)}
                    onDelete={() =>
                      setDeleteTarget({ type: "enrollment", id: e.id })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {historyEnrollments.length > 0 && (
            <div className="mt-4">
              <h3
                className={cn(
                  "flex items-center gap-2 text-xs font-medium",
                  textSecondary
                )}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
                이력
              </h3>
              <div className="mt-2 flex flex-col gap-1.5">
                {historyEnrollments.map((e) => (
                  <ProgramItem
                    key={e.id}
                    enrollment={e}
                    isSelected={e.id === selectedEnrollmentId}
                    onClick={() => setSelectedEnrollmentId(e.id)}
                    onDelete={() =>
                      setDeleteTarget({ type: "enrollment", id: e.id })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {enrollments.length === 0 && (
            <p className={cn("mt-6 text-center text-sm", textSecondary)}>
              등록된 수강이 없습니다.
            </p>
          )}
        </div>

        {/* ──────── 오른쪽: 수납 내역 ──────── */}
        <div
          className={cn(
            "rounded-lg border p-5 lg:col-span-3",
            borderDefault,
            bgSurface
          )}
        >
          {selectedEnrollment ? (
            <>
              {/* 헤더 */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h2 className={cn("text-base font-semibold", textPrimary)}>
                    수납 내역
                  </h2>
                  <p className={cn("text-xs", textSecondary)}>
                    {selectedEnrollment.program_name}
                    {selectedEnrollment.program_code &&
                      ` (${selectedEnrollment.program_code})`}
                    {" · "}
                    {selectedEnrollment.start_date} ~
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setPaymentAddTarget(selectedEnrollment)}
                >
                  + 수납 추가
                </Button>
              </div>

              {/* 요약 */}
              {selectedPayments.length > 0 && (
                <div
                  className={cn(
                    "mt-4 flex items-center gap-4 rounded-lg px-4 py-3",
                    "bg-gray-50 dark:bg-gray-700/50"
                  )}
                >
                  <SummaryItem
                    label="총 청구"
                    value={formatPrice(paymentSummary.total)}
                  />
                  <SummaryItem
                    label="납부"
                    value={formatPrice(paymentSummary.paid)}
                    accent={paymentSummary.paid > 0 ? "green" : undefined}
                  />
                  <SummaryItem
                    label="잔액"
                    value={formatPrice(
                      paymentSummary.total - paymentSummary.paid
                    )}
                    accent={
                      paymentSummary.total - paymentSummary.paid > 0
                        ? "red"
                        : undefined
                    }
                  />
                  {paymentSummary.unpaid > 0 && (
                    <span className="text-xs font-medium text-red-500">
                      미납 {paymentSummary.unpaid}건
                    </span>
                  )}
                </div>
              )}

              {/* 수납 목록 */}
              {selectedPayments.length > 0 ? (
                <div className="mt-4 flex flex-col gap-2">
                  {selectedPayments.map((payment) => (
                    <PaymentRow
                      key={payment.id}
                      payment={payment}
                      onConfirm={() => setPaymentConfirmTarget(payment)}
                      onDelete={() =>
                        setDeleteTarget({ type: "payment", id: payment.id })
                      }
                      onRefund={
                        payment.toss_payment_key
                          ? () => setRefundTarget(payment)
                          : undefined
                      }
                      onCashReceipt={() => setCashReceiptTarget(payment)}
                      onCancelCashReceipt={async (id) => {
                        const result = await cancelCashReceiptAction(id);
                        if (result.success) {
                          toast.showSuccess("현금영수증이 취소되었습니다.");
                          router.refresh();
                        } else {
                          toast.showError(result.error ?? "취소에 실패했습니다.");
                        }
                      }}
                    />
                  ))}
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
            </>
          ) : (
            <div className="flex h-full items-center justify-center py-12">
              <p className={cn("text-sm", textSecondary)}>
                왼쪽에서 수강 프로그램을 선택하세요.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ──────── Modals ──────── */}
      <EnrollmentAddModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        studentId={studentId}
        programs={programs}
        consultants={consultants}
        onSuccess={() => router.refresh()}
      />

      <PaymentAddModal
        open={!!paymentAddTarget}
        onOpenChange={(open) => {
          if (!open) setPaymentAddTarget(null);
        }}
        enrollmentId={paymentAddTarget?.id ?? ""}
        studentId={studentId}
        enrollmentPrice={paymentAddTarget?.price ?? null}
        programName={paymentAddTarget?.program_name ?? ""}
        onSuccess={() => router.refresh()}
      />

      <PaymentConfirmModal
        open={!!paymentConfirmTarget}
        onOpenChange={(open) => {
          if (!open) setPaymentConfirmTarget(null);
        }}
        payment={paymentConfirmTarget}
        onSuccess={() => router.refresh()}
      />

      {refundTarget && (
        <PaymentRefundModal
          open={!!refundTarget}
          onOpenChange={(open) => {
            if (!open) setRefundTarget(null);
          }}
          paymentId={refundTarget.id}
          paidAmount={refundTarget.paid_amount}
          programName={refundTarget.program_name}
        />
      )}

      {cashReceiptTarget && (
        <CashReceiptModal
          open={!!cashReceiptTarget}
          onOpenChange={(open) => {
            if (!open) setCashReceiptTarget(null);
          }}
          paymentId={cashReceiptTarget.id}
          amount={cashReceiptTarget.paid_amount || cashReceiptTarget.amount}
          programName={cashReceiptTarget.program_name}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={
          deleteTarget?.type === "payment"
            ? "수납 기록 삭제"
            : "수강 등록 삭제"
        }
        description={
          deleteTarget?.type === "payment"
            ? "이 수납 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
            : "이 수강 등록을 삭제하시겠습니까? 관련 수납 기록도 함께 삭제됩니다."
        }
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isPending}
      />
    </div>
  );
}

/* ──────── Sub-components ──────── */

/** 왼쪽 패널: 수강 프로그램 항목 */
function ProgramItem({
  enrollment,
  isSelected,
  onClick,
  onDelete,
}: {
  enrollment: EnrollmentWithProgram;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors",
        isSelected
          ? "border-indigo-300 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-900/30"
          : cn(borderDefault, "hover:bg-gray-50 dark:hover:bg-gray-700/50")
      )}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              isSelected
                ? "text-indigo-700 dark:text-indigo-300"
                : textPrimary
            )}
          >
            {enrollment.program_name}
          </span>
          {enrollment.status !== "active" && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                ENROLLMENT_STATUS_COLORS[enrollment.status]
              )}
            >
              {ENROLLMENT_STATUS_LABELS[enrollment.status]}
            </span>
          )}
        </div>
        <span className={cn("text-[11px]", textSecondary)}>
          {enrollment.start_date}
          {enrollment.end_date && ` ~ ${enrollment.end_date}`}
          {enrollment.price != null &&
            enrollment.price > 0 &&
            ` · ${formatPrice(enrollment.price)}`}
        </span>
      </div>
      {enrollment.status === "active" && (
        <EnrollmentStatusSelect enrollment={enrollment} />
      )}
      <span
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="hidden cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-red-500 hover:bg-red-50 group-hover:inline-block dark:text-red-400 dark:hover:bg-red-900/20"
      >
        삭제
      </span>
    </button>
  );
}

/** 요약 수치 항목 */
function SummaryItem({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "red";
}) {
  return (
    <div className="flex flex-col">
      <span className={cn("text-[11px]", textSecondary)}>{label}</span>
      <span
        className={cn(
          "text-sm font-semibold",
          accent === "green"
            ? "text-green-600 dark:text-green-400"
            : accent === "red"
              ? "text-red-600 dark:text-red-400"
              : textPrimary
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** 오른쪽 패널: 수납 기록 행 */
function PaymentRow({
  payment,
  onConfirm,
  onDelete,
  onRefund,
  onCashReceipt,
  onCancelCashReceipt,
}: {
  payment: PaymentRecordWithEnrollment;
  onConfirm: () => void;
  onDelete: () => void;
  onRefund?: () => void;
  onCashReceipt?: () => void;
  onCancelCashReceipt?: (paymentId: string) => void;
}) {
  const canConfirm =
    payment.status === "unpaid" || payment.status === "partial";
  const statusKey = payment.status as PaymentStatus;
  const isOnlinePayment = !!payment.toss_payment_key;
  const canRefund =
    isOnlinePayment &&
    (payment.status === "paid" || payment.status === "partial");

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-4 py-3",
        borderDefault
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* 상태 배지 */}
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            PAYMENT_STATUS_COLORS[statusKey]
          )}
        >
          {PAYMENT_STATUS_LABELS[statusKey]}
        </span>

        {/* 온라인결제 배지 */}
        {isOnlinePayment && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            온라인결제
          </span>
        )}

        {/* 청구 기간 */}
        {payment.billing_period && (
          <span className={cn("text-sm font-medium", textPrimary)}>
            {payment.billing_period}
          </span>
        )}

        {/* 금액 */}
        <span className={cn("text-sm", textPrimary)}>
          {payment.status === "partial"
            ? `${formatPrice(payment.paid_amount)} / ${formatPrice(payment.amount)}`
            : formatPrice(payment.amount)}
        </span>

        {/* 결제 방법 (토스 결제수단 우선 표시) */}
        {payment.toss_method ? (
          <span className={cn("text-xs", textSecondary)}>
            {payment.toss_method}
          </span>
        ) : payment.payment_method ? (
          <span className={cn("text-xs", textSecondary)}>
            {PAYMENT_METHOD_LABELS[payment.payment_method as PaymentMethod]}
          </span>
        ) : null}

        {/* 날짜 */}
        {payment.paid_date ? (
          <span className={cn("text-xs", textSecondary)}>
            {payment.paid_date}
          </span>
        ) : payment.due_date ? (
          <span className="text-xs text-red-500">
            기한: {payment.due_date}
          </span>
        ) : null}

        {/* 영수증 링크 */}
        {payment.toss_receipt_url && (
          <a
            href={payment.toss_receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline"
          >
            영수증
          </a>
        )}

        {/* 현금영수증 링크 */}
        {payment.cash_receipt_url && (
          <a
            href={payment.cash_receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-500 hover:underline"
          >
            현금영수증
          </a>
        )}

        {/* 메모 */}
        {payment.memo && (
          <span
            className={cn(
              "max-w-[150px] truncate text-xs",
              textSecondary
            )}
            title={payment.memo}
          >
            {payment.memo}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {canConfirm && (
          <button
            onClick={onConfirm}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium",
              "text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
            )}
          >
            납부확인
          </button>
        )}
        {canRefund && onRefund && (
          <button
            onClick={onRefund}
            className="rounded px-2.5 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20"
          >
            환불
          </button>
        )}
        {/* 현금영수증: 현금/이체 결제 + paid 상태 */}
        {payment.status === "paid" &&
          (payment.payment_method === "cash" || payment.payment_method === "transfer") &&
          !payment.cash_receipt_key &&
          onCashReceipt && (
            <button
              onClick={onCashReceipt}
              className="rounded px-2.5 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
            >
              현금영수증
            </button>
          )}
        {payment.cash_receipt_key && onCancelCashReceipt && (
          <button
            onClick={() => onCancelCashReceipt(payment.id)}
            className="rounded px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/20"
          >
            영수증취소
          </button>
        )}
        <button
          onClick={onDelete}
          className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          삭제
        </button>
      </div>
    </div>
  );
}
