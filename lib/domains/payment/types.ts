export type PaymentStatus =
  | "unpaid"
  | "paid"
  | "partial"
  | "refunded"
  | "cancelled";

export type PaymentMethod = "cash" | "card" | "transfer" | "other";

export type PaymentRecord = {
  id: string;
  tenant_id: string;
  enrollment_id: string;
  student_id: string;
  amount: number;
  paid_amount: number;
  status: PaymentStatus;
  payment_method: PaymentMethod | null;
  due_date: string | null;
  paid_date: string | null;
  billing_period: string | null;
  memo: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // 토스페이먼츠 결제 정보
  toss_order_id: string | null;
  toss_payment_key: string | null;
  toss_method: string | null;
  toss_receipt_url: string | null;
  toss_approved_at: string | null;
  // 현금영수증
  cash_receipt_url: string | null;
  cash_receipt_key: string | null;
  cash_receipt_type: "소득공제" | "지출증빙" | null;
  // 일괄 결제 주문
  payment_order_id: string | null;
};

export type PaymentRecordWithEnrollment = PaymentRecord & {
  program_name: string;
  program_code: string;
  student_name?: string;
};

export type CreatePaymentInput = {
  enrollment_id: string;
  student_id: string;
  amount: number;
  due_date?: string;
  billing_period?: string;
  memo?: string;
};

export type ConfirmPaymentInput = {
  payment_id: string;
  paid_amount: number;
  payment_method: PaymentMethod;
  paid_date: string;
  memo?: string;
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "미납",
  paid: "완납",
  partial: "부분납",
  refunded: "환불",
  cancelled: "취소",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
  partial: "bg-yellow-100 text-yellow-700",
  refunded: "bg-gray-100 text-gray-600",
  cancelled: "bg-gray-100 text-gray-400",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "현금",
  card: "카드",
  transfer: "계좌이체",
  other: "기타",
};

// 일괄 결제 주문
export type PaymentOrderStatus =
  | "pending"
  | "paid"
  | "partial_refunded"
  | "refunded"
  | "cancelled";

export type PaymentOrder = {
  id: string;
  tenant_id: string;
  toss_order_id: string;
  total_amount: number;
  status: PaymentOrderStatus;
  toss_payment_key: string | null;
  toss_method: string | null;
  toss_receipt_url: string | null;
  toss_raw_response: unknown;
  toss_requested_at: string | null;
  toss_approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
