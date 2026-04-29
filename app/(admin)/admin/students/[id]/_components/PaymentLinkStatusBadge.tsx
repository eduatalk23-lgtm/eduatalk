"use client";

import { cn } from "@/lib/cn";
import type { PaymentLinkStatus, DeliveryStatus } from "@/lib/domains/payment/paymentLink/types";

const STATUS_CONFIG: Record<PaymentLinkStatus, { label: string; className: string }> = {
  active: {
    label: "활성",
    className:
      "bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-300",
  },
  completed: {
    label: "결제완료",
    className:
      "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300",
  },
  expired: {
    label: "만료",
    className: "bg-bg-tertiary text-text-tertiary",
  },
  cancelled: {
    label: "취소",
    className: "bg-bg-tertiary text-text-tertiary",
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

  const isFailed = status === "active" && deliveryStatus === "failed";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-3xs font-medium",
        isFailed
          ? "bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-300"
          : config.className,
      )}
    >
      {label}
    </span>
  );
}
