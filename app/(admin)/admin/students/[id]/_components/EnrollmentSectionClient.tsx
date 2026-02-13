"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { deleteEnrollmentAction } from "@/lib/domains/enrollment/actions";
import type { EnrollmentWithProgram } from "@/lib/domains/enrollment/types";
import { deletePaymentAction } from "@/lib/domains/payment/actions";
import { syncTossPaymentStatusAction } from "@/lib/domains/payment/actions/tossPayment";
import type { PaymentRecordWithEnrollment } from "@/lib/domains/payment/types";
import type { Program } from "@/lib/domains/crm/types";
import { cancelCashReceiptAction } from "@/lib/domains/payment/actions/cashReceipt";
import { ProgramListPanel } from "./ProgramListPanel";
import {
  PaymentTablePanel,
  DEFAULT_SORT_DIRECTION,
  STATUS_ORDER,
  type SortKey,
  type SortState,
} from "./PaymentTablePanel";
import { EnrollmentAddModal } from "./EnrollmentAddModal";
import { PaymentAddModal } from "./PaymentAddModal";
import { PaymentConfirmModal } from "./PaymentConfirmModal";
import { PaymentRefundModal } from "./PaymentRefundModal";
import { CashReceiptModal } from "./CashReceiptModal";

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

  // null = 선택 안 됨 (전체 보기), string = 개별 enrollment id
  const [selectedEnrollmentId, setSelectedEnrollmentId] =
    useState<string | null>(null);
  const [sortState, setSortState] = useState<SortState>({
    key: "billing_period",
    direction: "desc",
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
  const [isSyncing, setIsSyncing] = useState(false);

  const isAllView = selectedEnrollmentId === null;

  const selectedEnrollment = isAllView
    ? null
    : enrollments.find((e) => e.id === selectedEnrollmentId);

  /** 컬럼 헤더 클릭 정렬 (2-state toggle) */
  const handleSort = useCallback((key: SortKey) => {
    setSortState((prev) => {
      if (prev.key !== key) {
        // 다른 컬럼 → 해당 컬럼의 기본 방향으로
        return { key, direction: DEFAULT_SORT_DIRECTION[key] };
      }
      // 같은 컬럼 → 방향 반전
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  }, []);

  // 필터링 + 정렬된 수납 목록
  const filteredPayments = useMemo(() => {
    const filtered = isAllView
      ? [...payments]
      : payments.filter((p) => p.enrollment_id === selectedEnrollmentId);

    const { key, direction } = sortState;
    const mul = direction === "asc" ? 1 : -1;

    filtered.sort((a, b) => {
      switch (key) {
        case "billing_period": {
          const va = a.billing_period ?? a.due_date ?? a.created_at;
          const vb = b.billing_period ?? b.due_date ?? b.created_at;
          return mul * va.localeCompare(vb);
        }
        case "status": {
          const va = STATUS_ORDER[a.status] ?? 99;
          const vb = STATUS_ORDER[b.status] ?? 99;
          return mul * (va - vb);
        }
        case "amount":
          return mul * (a.amount - b.amount);
        case "paid_date": {
          const va = a.paid_date ?? a.due_date ?? "";
          const vb = b.paid_date ?? b.due_date ?? "";
          return mul * va.localeCompare(vb);
        }
        case "program_name":
          return mul * a.program_name.localeCompare(b.program_name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [payments, selectedEnrollmentId, isAllView, sortState]);

  // 요약
  const paymentSummary = useMemo(() => {
    const list = isAllView
      ? payments
      : payments.filter((p) => p.enrollment_id === selectedEnrollmentId);
    const total = list.reduce((s, p) => s + p.amount, 0);
    const paid = list.reduce((s, p) => s + p.paid_amount, 0);
    const unpaid = list.filter(
      (p) => p.status === "unpaid" || p.status === "partial"
    ).length;
    return { total, paid, unpaid };
  }, [payments, selectedEnrollmentId, isAllView]);

  const activeEnrollments = enrollments.filter((e) => e.status === "active");
  const historyEnrollments = enrollments.filter((e) => e.status !== "active");

  /** 수강 삭제 시도 - 수납 기록이 있으면 차단 */
  const handleTryDeleteEnrollment = (enrollmentId: string) => {
    const hasPayments = payments.some(
      (p) => p.enrollment_id === enrollmentId
    );
    if (hasPayments) {
      toast.showError(
        "수납 기록이 있는 수강은 삭제할 수 없습니다. 상태를 변경해 주세요."
      );
      return;
    }
    setDeleteTarget({ type: "enrollment", id: enrollmentId });
  };

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
            setSelectedEnrollmentId(null);
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

  /** 수납 추가 - 전체 보기일 때는 첫 번째 active enrollment 사용 */
  const handleAddPayment = () => {
    if (isAllView) {
      const target = activeEnrollments[0] ?? enrollments[0];
      if (target) setPaymentAddTarget(target);
    } else if (selectedEnrollment) {
      setPaymentAddTarget(selectedEnrollment);
    }
  };

  /** 현금영수증 취소 */
  const handleCancelCashReceipt = async (paymentId: string) => {
    const result = await cancelCashReceiptAction(paymentId);
    if (result.success) {
      toast.showSuccess("현금영수증이 취소되었습니다.");
      router.refresh();
    } else {
      toast.showError(result.error ?? "취소에 실패했습니다.");
    }
  };

  /** 토스페이먼츠 상태 동기화 */
  const handleSyncTossStatus = async () => {
    setIsSyncing(true);
    try {
      const result = await syncTossPaymentStatusAction(studentId);
      if (result.success && result.data) {
        const { synced, checked, failed } = result.data;
        if (synced > 0) {
          toast.showSuccess(
            `${synced}건 환불 동기화 완료` +
              (failed > 0 ? ` (${failed}건 조회 실패 건너뜀)` : "")
          );
          router.refresh();
        } else if (failed === checked) {
          toast.showError("토스 API 조회에 모두 실패했습니다.");
        } else {
          toast.showSuccess(
            `${checked - failed}건 확인 완료. 동기화할 환불 건이 없습니다.` +
              (failed > 0 ? ` (${failed}건 조회 실패)` : "")
          );
        }
      } else {
        toast.showError(result.error ?? "동기화에 실패했습니다.");
      }
    } catch {
      toast.showError("동기화 중 오류가 발생했습니다.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1-Row-1-Section Layout */}
      <div className="flex flex-col gap-6">
        <ProgramListPanel
          activeEnrollments={activeEnrollments}
          historyEnrollments={historyEnrollments}
          selectedEnrollmentId={selectedEnrollmentId}
          onSelectEnrollment={setSelectedEnrollmentId}
          onDeleteEnrollment={handleTryDeleteEnrollment}
          onAddEnrollment={() => setShowAddModal(true)}
        />

        <PaymentTablePanel
          payments={payments}
          filteredPayments={filteredPayments}
          paymentSummary={paymentSummary}
          isAllView={isAllView}
          selectedEnrollment={selectedEnrollment ?? null}
          sortState={sortState}
          onSort={handleSort}
          onSelectAll={() => setSelectedEnrollmentId(null)}
          onAddPayment={handleAddPayment}
          onConfirmPayment={setPaymentConfirmTarget}
          onDeletePayment={(id) =>
            setDeleteTarget({ type: "payment", id })
          }
          onRefundPayment={setRefundTarget}
          onCashReceipt={setCashReceiptTarget}
          onCancelCashReceipt={handleCancelCashReceipt}
          onSyncTossStatus={handleSyncTossStatus}
          isSyncing={isSyncing}
        />
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
            : "이 수강 등록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        }
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isPending}
      />
    </div>
  );
}
