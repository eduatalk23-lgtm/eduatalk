/** 결제 링크 상태 */
export type PaymentLinkStatus = "active" | "completed" | "expired" | "cancelled";

/** 발송 방법 */
export type DeliveryMethod = "alimtalk" | "sms" | "manual";

/** 발송 상태 */
export type DeliveryStatus = "pending" | "sent" | "failed" | "skipped";

/** DB 레코드 */
export type PaymentLink = {
  id: string;
  token: string;
  tenant_id: string;
  payment_record_id: string;
  student_id: string;
  academy_name: string;
  student_name: string;
  program_name: string;
  amount: number;
  due_date: string | null;
  memo: string | null;
  status: PaymentLinkStatus;
  expires_at: string;
  delivery_method: DeliveryMethod | null;
  delivery_status: DeliveryStatus;
  delivered_at: string | null;
  recipient_phone: string | null;
  paid_at: string | null;
  toss_payment_key: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** 결제 링크 생성 입력 */
export type CreatePaymentLinkInput = {
  paymentRecordId: string;
  recipientPhone?: string;
  deliveryMethod: DeliveryMethod;
  expiresInHours?: number; // 기본 72시간
  memo?: string;
};

/** 게스트 결제 페이지용 데이터 */
export type GuestPaymentData = {
  token: string;
  academyName: string;
  studentName: string;
  programName: string;
  amount: number;
  dueDate: string | null;
  memo: string | null;
  orderId: string;
  expiresAt: string;
};
