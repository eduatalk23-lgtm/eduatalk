/**
 * 토스페이먼츠 API 서비스
 * 결제 승인 및 취소(환불) API 래퍼
 * API 문서: https://docs.tosspayments.com
 */

import { env } from "@/lib/env";

const TOSS_API_BASE = "https://api.tosspayments.com/v1";

// ============================================================
// 타입 정의
// ============================================================

export type TossPaymentResponse = {
  paymentKey: string;
  orderId: string;
  orderName: string;
  status: string;
  method: string;
  totalAmount: number;
  balanceAmount: number;
  requestedAt: string;
  approvedAt: string;
  receipt?: { url: string } | null;
  cancels?: TossCancelInfo[] | null;
  [key: string]: unknown;
};

type TossCancelInfo = {
  cancelReason: string;
  canceledAt: string;
  cancelAmount: number;
  cancelStatus: string;
  transactionKey: string;
};

type TossErrorResponse = {
  code: string;
  message: string;
};

export type ConfirmPaymentParams = {
  paymentKey: string;
  orderId: string;
  amount: number;
};

export type CancelPaymentParams = {
  paymentKey: string;
  cancelReason: string;
  cancelAmount?: number;
};

// ============================================================
// 인증 헤더
// ============================================================

function getTossAuthHeader(): string {
  const secretKey = env.TOSS_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "토스페이먼츠 시크릿 키(TOSS_SECRET_KEY)가 설정되지 않았습니다."
    );
  }
  // Basic auth: secretKey + ":" 를 Base64 인코딩
  const encoded = Buffer.from(`${secretKey}:`).toString("base64");
  return `Basic ${encoded}`;
}

// ============================================================
// 에러 코드 → 한국어 메시지 매핑
// ============================================================

const TOSS_ERROR_MESSAGES: Record<string, string> = {
  ALREADY_PROCESSED_PAYMENT: "이미 처리된 결제입니다.",
  PROVIDER_ERROR: "결제사에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  EXCEED_MAX_CARD_INSTALLMENT_PLAN: "최대 할부 개월 수를 초과했습니다.",
  INVALID_REQUEST: "잘못된 요청입니다.",
  NOT_ALLOWED_POINT_USE: "포인트 사용이 불가한 결제입니다.",
  INVALID_API_KEY: "유효하지 않은 API 키입니다.",
  INVALID_REJECT_CARD: "카드 사용이 거절되었습니다.",
  BELOW_MINIMUM_AMOUNT: "최소 결제 금액 미만입니다.",
  INVALID_CARD_EXPIRATION: "카드 유효기간이 만료되었습니다.",
  INVALID_STOPPED_CARD: "정지된 카드입니다.",
  EXCEED_MAX_DAILY_PAYMENT_COUNT: "일일 최대 결제 횟수를 초과했습니다.",
  NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT:
    "할부가 지원되지 않는 카드 또는 상점입니다.",
  INVALID_CARD_LOST_OR_STOLEN: "분실 또는 도난 카드입니다.",
  RESTRICTED_CARD: "사용이 제한된 카드입니다.",
  EXCEED_MAX_AMOUNT: "결제 금액 한도를 초과했습니다.",
  INVALID_ACCOUNT_INFO_RE_REGISTER: "계좌 정보가 올바르지 않습니다.",
  NOT_AVAILABLE_PAYMENT: "이용 불가능한 결제수단입니다.",
  REJECT_ACCOUNT_PAYMENT: "계좌 결제가 거절되었습니다.",
  REJECT_CARD_PAYMENT: "한도 초과 또는 잔액 부족으로 결제에 실패했습니다.",
  REJECT_CARD_COMPANY: "카드사에서 결제를 거절했습니다.",
  FORBIDDEN_REQUEST: "허용되지 않는 요청입니다.",
  REJECT_TOSSPAY_INVALID_ACCOUNT:
    "토스페이 계정 상태가 올바르지 않습니다.",
  EXCEED_MAX_AUTH_COUNT: "최대 인증 횟수를 초과했습니다.",
  EXCEED_MAX_ONE_DAY_AMOUNT: "일일 한도를 초과했습니다.",
  NOT_AVAILABLE_BANK: "은행 서비스 시간이 아닙니다.",
  INVALID_PASSWORD: "비밀번호가 올바르지 않습니다.",
  INCORRECT_BASIC_AUTH_FORMAT: "인증 형식이 올바르지 않습니다.",
  FDS_ERROR: "이상 거래가 감지되었습니다. 잠시 후 다시 시도해주세요.",
};

export function mapTossErrorToMessage(code: string): string {
  return TOSS_ERROR_MESSAGES[code] ?? "결제 처리 중 오류가 발생했습니다.";
}

// ============================================================
// API 호출
// ============================================================

/**
 * 토스페이먼츠 결제 승인
 * POST /v1/payments/confirm
 */
export async function confirmTossPayment(
  params: ConfirmPaymentParams
): Promise<TossPaymentResponse> {
  const response = await fetch(`${TOSS_API_BASE}/payments/confirm`, {
    method: "POST",
    headers: {
      Authorization: getTossAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paymentKey: params.paymentKey,
      orderId: params.orderId,
      amount: params.amount,
    }),
  });

  const body = await response.json();

  if (!response.ok) {
    const errorBody = body as TossErrorResponse;
    const message = mapTossErrorToMessage(errorBody.code);
    const error = new Error(message) as Error & { code?: string };
    error.code = errorBody.code;
    throw error;
  }

  return body as TossPaymentResponse;
}

/**
 * 토스페이먼츠 결제 조회 (orderId 기반)
 * GET /v1/payments/orders/{orderId}
 * 웹훅 수신 후 결제 상태를 직접 검증하는 용도
 */
export async function getPaymentByOrderId(
  orderId: string
): Promise<TossPaymentResponse> {
  const response = await fetch(
    `${TOSS_API_BASE}/payments/orders/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      headers: {
        Authorization: getTossAuthHeader(),
      },
    }
  );

  const body = await response.json();

  if (!response.ok) {
    const errorBody = body as TossErrorResponse;
    const error = new Error(errorBody.message) as Error & { code?: string };
    error.code = errorBody.code;
    throw error;
  }

  return body as TossPaymentResponse;
}

/**
 * 토스페이먼츠 결제 조회 (paymentKey 기반)
 * GET /v1/payments/{paymentKey}
 */
export async function getPaymentByPaymentKey(
  paymentKey: string
): Promise<TossPaymentResponse> {
  const response = await fetch(
    `${TOSS_API_BASE}/payments/${encodeURIComponent(paymentKey)}`,
    {
      method: "GET",
      headers: {
        Authorization: getTossAuthHeader(),
      },
    }
  );

  const body = await response.json();

  if (!response.ok) {
    const errorBody = body as TossErrorResponse;
    const error = new Error(errorBody.message) as Error & { code?: string };
    error.code = errorBody.code;
    throw error;
  }

  return body as TossPaymentResponse;
}

/**
 * 토스페이먼츠 결제 취소(환불)
 * POST /v1/payments/{paymentKey}/cancel
 */
export async function cancelTossPayment(
  params: CancelPaymentParams
): Promise<TossPaymentResponse> {
  const response = await fetch(
    `${TOSS_API_BASE}/payments/${encodeURIComponent(params.paymentKey)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: getTossAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cancelReason: params.cancelReason,
        ...(params.cancelAmount != null && {
          cancelAmount: params.cancelAmount,
        }),
      }),
    }
  );

  const body = await response.json();

  if (!response.ok) {
    const errorBody = body as TossErrorResponse;
    const message = mapTossErrorToMessage(errorBody.code);
    const error = new Error(message) as Error & { code?: string };
    error.code = errorBody.code;
    throw error;
  }

  return body as TossPaymentResponse;
}

// ============================================================
// 현금영수증 API
// ============================================================

export type CashReceiptType = "소득공제" | "지출증빙";

export type IssueCashReceiptParams = {
  amount: number;
  orderId: string;
  orderName: string;
  customerIdentityNumber: string;
  type: CashReceiptType;
};

type CashReceiptResponse = {
  receiptKey: string;
  receiptUrl: string;
  [key: string]: unknown;
};

/**
 * 현금영수증 발급
 * POST /v1/cash-receipts
 */
export async function issueCashReceipt(
  params: IssueCashReceiptParams
): Promise<{ receiptKey: string; receiptUrl: string }> {
  const response = await fetch(`${TOSS_API_BASE}/cash-receipts`, {
    method: "POST",
    headers: {
      Authorization: getTossAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amount,
      orderId: params.orderId,
      orderName: params.orderName,
      customerIdentityNumber: params.customerIdentityNumber,
      type: params.type,
    }),
  });

  const receiptData = await response.json();

  if (!response.ok) {
    const errorBody = receiptData as TossErrorResponse;
    const error = new Error(
      errorBody.message ?? "현금영수증 발급에 실패했습니다."
    ) as Error & { code?: string };
    error.code = errorBody.code;
    throw error;
  }

  const receipt = receiptData as CashReceiptResponse;
  return {
    receiptKey: receipt.receiptKey,
    receiptUrl: receipt.receiptUrl,
  };
}

/**
 * 현금영수증 취소
 * POST /v1/cash-receipts/{receiptKey}/cancel
 */
export async function cancelCashReceipt(receiptKey: string): Promise<void> {
  const response = await fetch(
    `${TOSS_API_BASE}/cash-receipts/${encodeURIComponent(receiptKey)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: getTossAuthHeader(),
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const cancelBody = await response.json();
    const errorBody = cancelBody as TossErrorResponse;
    const error = new Error(
      errorBody.message ?? "현금영수증 취소에 실패했습니다."
    ) as Error & { code?: string };
    error.code = errorBody.code;
    throw error;
  }
}
