import type { DiscountType } from "@/lib/domains/payment/types";

export function DiscountBadge({
  discountType,
  discountValue,
}: {
  discountType: DiscountType;
  discountValue: number;
}) {
  const label =
    discountType === "rate"
      ? `${discountValue}% 할인`
      : `${discountValue.toLocaleString()}원 할인`;

  return (
    <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
      {label}
    </span>
  );
}
