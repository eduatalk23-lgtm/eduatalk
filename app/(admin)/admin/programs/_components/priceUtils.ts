export type PriceUnit = "monthly" | "total" | "per_session";

export const PRICE_UNIT_LABELS: Record<string, string> = {
  monthly: "월",
  total: "총액",
  per_session: "회",
};

export const PRICE_UNIT_OPTIONS: { value: PriceUnit; label: string }[] = [
  { value: "monthly", label: "월납" },
  { value: "total", label: "총액" },
  { value: "per_session", label: "회당" },
];

export type BillingType = "recurring" | "one_time" | "manual";

export const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  recurring: "매월 자동",
  one_time: "1회",
  manual: "수동",
};

export const BILLING_TYPE_OPTIONS: {
  value: BillingType;
  label: string;
  description: string;
}[] = [
  { value: "recurring", label: "매월 자동", description: "매월 청구일에 자동 생성" },
  { value: "one_time", label: "1회", description: "수강 등록 시 1회만 생성" },
  { value: "manual", label: "수동", description: "관리자가 직접 생성" },
];

export function getDefaultBillingType(priceUnit: PriceUnit): BillingType {
  switch (priceUnit) {
    case "monthly":
      return "recurring";
    case "total":
      return "one_time";
    case "per_session":
      return "one_time";
  }
}

export function formatPrice(price: number): string {
  if (price === 0) return "무료";
  if (price >= 10000) {
    const man = Math.floor(price / 10000);
    const remainder = price % 10000;
    if (remainder === 0) return `${man}만원`;
    return `${man}만${remainder.toLocaleString()}원`;
  }
  return `${price.toLocaleString()}원`;
}
