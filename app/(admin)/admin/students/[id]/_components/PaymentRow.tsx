"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, tableRowHover } from "@/lib/utils/darkMode";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
  type PaymentRecordWithEnrollment,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/domains/payment/types";
import { formatPrice } from "@/app/(admin)/admin/programs/_components/priceUtils";
import { DiscountBadge } from "@/components/payment/DiscountBadge";
import { PaymentActionMenu } from "./PaymentActionMenu";

type PaymentRowProps = {
  payment: PaymentRecordWithEnrollment;
  index: number;
  showProgram: boolean;
  onConfirm: () => void;
  onDelete: () => void;
  onRefund?: () => void;
  onCashReceipt: () => void;
  onCancelCashReceipt: (paymentId: string) => void;
};

function PaymentRowComponent({
  payment,
  index,
  showProgram,
  onConfirm,
  onDelete,
  onRefund,
  onCashReceipt,
  onCancelCashReceipt,
}: PaymentRowProps) {
  const statusKey = payment.status as PaymentStatus;
  const isOnlinePayment = !!payment.toss_payment_key;

  return (
    <tr
      className={cn(
        "border-b border-gray-100 dark:border-gray-800",
        tableRowHover
      )}
    >
      {/* No. */}
      <td className="px-3 py-2.5 text-center text-xs text-gray-400">{index}</td>

      {/* 청구월 */}
      <td className={cn("px-3 py-2.5 text-xs", textPrimary)}>
        {payment.billing_period ?? "-"}
      </td>

      {/* 프로그램 (전체보기일 때만) */}
      {showProgram && (
        <td className={cn("px-3 py-2.5 text-xs", textPrimary)}>
          <span
            className="inline-block max-w-[130px] truncate"
            title={payment.program_name}
          >
            {payment.program_name}
          </span>
        </td>
      )}

      {/* 상태 */}
      <td className="px-3 py-2.5">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            PAYMENT_STATUS_COLORS[statusKey]
          )}
        >
          {PAYMENT_STATUS_LABELS[statusKey]}
        </span>
      </td>

      {/* 유형 */}
      <td className="px-3 py-2.5">
        {isOnlinePayment ? (
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            온라인
          </span>
        ) : (
          <span className={cn("text-xs", textSecondary)}>오프라인</span>
        )}
      </td>

      {/* 금액 (우측 정렬) */}
      <td className={cn("px-3 py-2.5 text-xs text-right", textPrimary)}>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {payment.original_amount != null && (
            <span className="text-gray-400 line-through dark:text-gray-500">
              {formatPrice(payment.original_amount)}
            </span>
          )}
          <span>
            {payment.status === "partial"
              ? `${formatPrice(payment.paid_amount)} / ${formatPrice(payment.amount)}`
              : formatPrice(payment.amount)}
          </span>
          {payment.discount_type && payment.discount_value != null && (
            <DiscountBadge
              discountType={payment.discount_type}
              discountValue={payment.discount_value}
            />
          )}
        </div>
      </td>

      {/* 결제방법 */}
      <td className={cn("px-3 py-2.5 text-xs", textSecondary)}>
        {payment.toss_method
          ? payment.toss_method
          : payment.payment_method
            ? PAYMENT_METHOD_LABELS[payment.payment_method as PaymentMethod]
            : "-"}
      </td>

      {/* 날짜 */}
      <td className="px-3 py-2.5 text-xs">
        {payment.paid_date ? (
          <span className={textSecondary}>{payment.paid_date}</span>
        ) : payment.due_date ? (
          <span className="text-red-500">기한: {payment.due_date}</span>
        ) : (
          <span className={textSecondary}>-</span>
        )}
      </td>

      {/* 액션 (케밥 메뉴) */}
      <td className="px-3 py-2.5">
        <PaymentActionMenu
          payment={payment}
          onConfirm={onConfirm}
          onDelete={onDelete}
          onRefund={onRefund}
          onCashReceipt={onCashReceipt}
          onCancelCashReceipt={onCancelCashReceipt}
        />
      </td>
    </tr>
  );
}

export const PaymentRow = memo(PaymentRowComponent);
