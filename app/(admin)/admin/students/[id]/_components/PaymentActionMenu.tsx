"use client";

import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { MoreHorizontal } from "lucide-react";
import type { PaymentRecordWithEnrollment } from "@/lib/domains/payment/types";

type PaymentActionMenuProps = {
  payment: PaymentRecordWithEnrollment;
  onConfirm: () => void;
  onDelete: () => void;
  onRefund?: () => void;
  onCashReceipt: () => void;
  onCancelCashReceipt: (paymentId: string) => void;
};

export function PaymentActionMenu({
  payment,
  onConfirm,
  onDelete,
  onRefund,
  onCashReceipt,
  onCancelCashReceipt,
}: PaymentActionMenuProps) {
  const canConfirm =
    payment.status === "unpaid" || payment.status === "partial";
  const isOnlinePayment = !!payment.toss_payment_key;
  const canRefund =
    isOnlinePayment &&
    (payment.status === "paid" || payment.status === "partial");
  const canIssueCashReceipt =
    payment.status === "paid" &&
    (payment.payment_method === "cash" ||
      payment.payment_method === "transfer") &&
    !payment.cash_receipt_key;
  const canCancelCashReceipt = !!payment.cash_receipt_key;

  const hasReceiptLinks =
    !!payment.toss_receipt_url || !!payment.cash_receipt_url;
  const hasMiddleActions =
    canRefund || canIssueCashReceipt || canCancelCashReceipt;

  return (
    <div className="flex items-center justify-end gap-1">
      {/* Primary action: 수납 버튼 (메뉴 밖) */}
      {canConfirm && (
        <button
          type="button"
          onClick={onConfirm}
          className="rounded px-2 py-0.5 text-xs font-medium text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
        >
          수납
        </button>
      )}

      {/* 케밥 메뉴 */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Content align="end" className="min-w-[160px]">
          {/* 영수증 링크 */}
          {payment.toss_receipt_url && (
            <DropdownMenu.Item
              href={payment.toss_receipt_url}
              className="text-blue-600 dark:text-blue-400"
            >
              영수증 보기
            </DropdownMenu.Item>
          )}
          {payment.cash_receipt_url && (
            <DropdownMenu.Item
              href={payment.cash_receipt_url}
              className="text-purple-600 dark:text-purple-400"
            >
              현금영수증 보기
            </DropdownMenu.Item>
          )}

          {/* 구분선 */}
          {hasReceiptLinks && hasMiddleActions && <DropdownMenu.Separator />}

          {/* 환불 / 현금영수증 발급·취소 */}
          {canRefund && onRefund && (
            <DropdownMenu.Item onClick={onRefund}>환불</DropdownMenu.Item>
          )}
          {canIssueCashReceipt && (
            <DropdownMenu.Item onClick={onCashReceipt}>
              현금영수증 발급
            </DropdownMenu.Item>
          )}
          {canCancelCashReceipt && (
            <DropdownMenu.Item
              onClick={() => onCancelCashReceipt(payment.id)}
            >
              현금영수증 취소
            </DropdownMenu.Item>
          )}

          {/* 구분선 + 삭제 */}
          {(hasReceiptLinks || hasMiddleActions) && (
            <DropdownMenu.Separator />
          )}
          <DropdownMenu.Item
            onClick={onDelete}
            className="text-red-600 dark:text-red-400"
          >
            삭제
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}
