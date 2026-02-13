"use client";

import { cn } from "@/lib/cn";
import { textPrimary, textSecondary } from "@/lib/utils/darkMode";
import { formatPrice } from "@/app/(admin)/admin/programs/_components/priceUtils";

type PaymentSummaryBarProps = {
  total: number;
  paid: number;
  unpaidCount: number;
};

export function PaymentSummaryBar({
  total,
  paid,
  unpaidCount,
}: PaymentSummaryBarProps) {
  const balance = total - paid;

  return (
    <div
      className={cn(
        "mt-4 flex items-center gap-4 rounded-lg px-4 py-3",
        "bg-gray-50 dark:bg-gray-700/50"
      )}
    >
      <SummaryItem label="총 청구" value={formatPrice(total)} />
      <SummaryItem
        label="납부"
        value={formatPrice(paid)}
        accent={paid > 0 ? "green" : undefined}
      />
      <SummaryItem
        label="잔액"
        value={formatPrice(balance)}
        accent={balance > 0 ? "red" : undefined}
      />
      {unpaidCount > 0 && (
        <span className="text-xs font-medium text-red-500">
          미납 {unpaidCount}건
        </span>
      )}
    </div>
  );
}

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
