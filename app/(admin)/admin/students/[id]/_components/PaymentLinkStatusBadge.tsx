"use client";

import { cn } from "@/lib/cn";
import type { PaymentLinkStatus, DeliveryStatus } from "@/lib/domains/payment/paymentLink/types";

const STATUS_CONFIG: Record<PaymentLinkStatus, { label: string; className: string }> = {
  active: {
    label: "활성",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  completed: {
    label: "결제완료",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  expired: {
    label: "만료",
    className: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
  },
  cancelled: {
    label: "취소",
    className: "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500",
  },
};

const DELIVERY_LABEL: Record<string, string> = {
  pending: "대기",
  sent: "발송됨",
  failed: "발송실패",
  skipped: "",
};

type PaymentLinkStatusBadgeProps = {
  status: PaymentLinkStatus;
  deliveryStatus?: DeliveryStatus;
};

export function PaymentLinkStatusBadge({
  status,
  deliveryStatus,
}: PaymentLinkStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  // active 상태일 때 delivery_status에 따라 라벨 구분
  let label = config.label;
  if (status === "active" && deliveryStatus) {
    const deliveryLabel = DELIVERY_LABEL[deliveryStatus];
    if (deliveryLabel) label = deliveryLabel;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        config.className,
        status === "active" && deliveryStatus === "failed" &&
          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      )}
    >
      {label}
    </span>
  );
}
