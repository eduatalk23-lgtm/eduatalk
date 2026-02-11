/**
 * 토스페이먼츠 결제 승인 API
 * POST /api/payments/toss/confirm
 *
 * 결제위젯에서 결제 완료 후 서버 사이드에서 토스 결제 승인을 호출한다.
 * - 단일 결제: orderId로 payment_record를 조회하여 승인
 * - 일괄 결제: TLU-BATCH- 접두사로 payment_orders를 조회하여 일괄 승인
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  apiForbidden,
  handleApiError,
} from "@/lib/api";
import { confirmTossPayment, mapTossErrorToMessage } from "@/lib/services/tossPayments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLinkedStudents } from "@/lib/domains/parent/utils";
import type { PaymentStatus } from "@/lib/domains/payment/types";

type AuthContext = {
  userId: string;
  role: string;
  tenantId: string | null;
};

type ConfirmBody = {
  paymentKey: string;
  orderId: string;
  amount: number;
};

export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인 (학부모 or 관리자)
    const { userId, role, tenantId } = await getCurrentUserRole();
    if (!userId || !role) {
      return apiUnauthorized("로그인이 필요합니다.");
    }

    const allowedRoles = ["parent", "admin", "superadmin", "consultant"];
    if (!allowedRoles.includes(role)) {
      return apiUnauthorized("결제 권한이 없습니다.");
    }

    // 2. 요청 body 파싱
    const body = await request.json();
    const { paymentKey, orderId, amount } = body as {
      paymentKey?: string;
      orderId?: string;
      amount?: number;
    };

    if (!paymentKey || !orderId || amount == null) {
      return apiBadRequest(
        "paymentKey, orderId, amount는 필수입니다."
      );
    }

    const auth: AuthContext = { userId, role, tenantId: tenantId ?? null };
    const confirmBody: ConfirmBody = { paymentKey, orderId, amount };

    // 3. 배치 결제 vs 단일 결제 분기
    if (orderId.startsWith("TLU-BATCH-")) {
      return handleBatchConfirm(auth, confirmBody);
    }
    return handleSingleConfirm(auth, confirmBody);
  } catch (error) {
    return handleApiError(error, "[api/payments/toss/confirm]");
  }
}

/**
 * 단일 결제 승인 (기존 로직)
 */
async function handleSingleConfirm(
  auth: AuthContext,
  { paymentKey, orderId, amount }: ConfirmBody
): Promise<NextResponse> {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return apiBadRequest("서버 오류: DB 클라이언트 초기화 실패");
  }

  const { data: record, error: fetchError } = await adminClient
    .from("payment_records")
    .select("id, amount, status, toss_order_id, tenant_id, student_id")
    .eq("toss_order_id", orderId)
    .maybeSingle();

  if (fetchError || !record) {
    return apiBadRequest("결제 레코드를 찾을 수 없습니다.");
  }

  // 접근 권한 검증
  if (auth.role === "parent") {
    const supabase = await createSupabaseServerClient();
    const linkedStudents = await getLinkedStudents(supabase, auth.userId);
    const studentIds = linkedStudents.map((s) => s.id);
    if (!studentIds.includes(record.student_id)) {
      return apiForbidden("해당 결제에 대한 권한이 없습니다.");
    }
  } else {
    if (auth.tenantId && record.tenant_id !== auth.tenantId) {
      return apiForbidden("해당 결제에 대한 권한이 없습니다.");
    }
  }

  // 금액 일치 검증
  if (record.amount !== amount) {
    return apiBadRequest(
      "결제 금액이 일치하지 않습니다.",
      { expected: record.amount, received: amount }
    );
  }

  if (record.status === "paid") {
    return apiBadRequest("이미 결제가 완료된 건입니다.");
  }

  // 토스 API 결제 승인
  let tossResponse;
  try {
    tossResponse = await confirmTossPayment({ paymentKey, orderId, amount });
  } catch (tossError) {
    const err = tossError as Error & { code?: string };
    const message = err.code
      ? mapTossErrorToMessage(err.code)
      : err.message;
    return apiBadRequest(message);
  }

  // DB 업데이트
  const paidStatus: PaymentStatus =
    amount >= record.amount ? "paid" : "partial";

  const { error: updateError } = await adminClient
    .from("payment_records")
    .update({
      status: paidStatus,
      paid_amount: amount,
      paid_date: new Date().toISOString().split("T")[0],
      payment_method: "card",
      toss_payment_key: tossResponse.paymentKey,
      toss_method: tossResponse.method ?? null,
      toss_receipt_url: tossResponse.receipt?.url ?? null,
      toss_raw_response: JSON.parse(JSON.stringify(tossResponse)),
      toss_requested_at: tossResponse.requestedAt ?? null,
      toss_approved_at: tossResponse.approvedAt ?? null,
    })
    .eq("id", record.id);

  if (updateError) {
    console.error("[api/payments/toss/confirm] DB 업데이트 실패:", updateError);
    return apiBadRequest(
      "결제는 승인되었으나 DB 업데이트에 실패했습니다. 관리자에게 문의하세요."
    );
  }

  return apiSuccess({
    paymentKey: tossResponse.paymentKey,
    orderId: tossResponse.orderId,
    status: paidStatus,
    method: tossResponse.method,
    receiptUrl: tossResponse.receipt?.url ?? null,
  });
}

/**
 * 일괄(배치) 결제 승인
 */
async function handleBatchConfirm(
  auth: AuthContext,
  { paymentKey, orderId, amount }: ConfirmBody
): Promise<NextResponse> {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return apiBadRequest("서버 오류: DB 클라이언트 초기화 실패");
  }

  // 1. payment_orders 조회
  const { data: order, error: orderError } = await adminClient
    .from("payment_orders")
    .select("id, tenant_id, total_amount, status, toss_order_id")
    .eq("toss_order_id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return apiBadRequest("일괄 결제 주문을 찾을 수 없습니다.");
  }

  if (order.status === "paid") {
    return apiBadRequest("이미 결제가 완료된 주문입니다.");
  }

  // 2. 권한 검증
  if (auth.role === "parent") {
    // 주문에 연결된 payment_records의 학생이 모두 연결된 학생인지 확인
    const supabase = await createSupabaseServerClient();
    const linkedStudents = await getLinkedStudents(supabase, auth.userId);
    const studentIdSet = new Set(linkedStudents.map((s) => s.id));

    const { data: records } = await adminClient
      .from("payment_records")
      .select("student_id")
      .eq("payment_order_id", order.id);

    const unauthorized = (records ?? []).some(
      (r) => !studentIdSet.has(r.student_id)
    );
    if (unauthorized) {
      return apiForbidden("해당 결제에 대한 권한이 없습니다.");
    }
  } else {
    if (auth.tenantId && order.tenant_id !== auth.tenantId) {
      return apiForbidden("해당 결제에 대한 권한이 없습니다.");
    }
  }

  // 3. 금액 검증
  if (order.total_amount !== amount) {
    return apiBadRequest(
      "결제 금액이 일치하지 않습니다.",
      { expected: order.total_amount, received: amount }
    );
  }

  // 4. 토스 API 승인
  let tossResponse;
  try {
    tossResponse = await confirmTossPayment({ paymentKey, orderId, amount });
  } catch (tossError) {
    const err = tossError as Error & { code?: string };
    const message = err.code
      ? mapTossErrorToMessage(err.code)
      : err.message;
    return apiBadRequest(message);
  }

  // 5. payment_orders 업데이트
  const { error: orderUpdateError } = await adminClient
    .from("payment_orders")
    .update({
      status: "paid",
      toss_payment_key: tossResponse.paymentKey,
      toss_method: tossResponse.method ?? null,
      toss_receipt_url: tossResponse.receipt?.url ?? null,
      toss_raw_response: JSON.parse(JSON.stringify(tossResponse)),
      toss_requested_at: tossResponse.requestedAt ?? null,
      toss_approved_at: tossResponse.approvedAt ?? null,
    })
    .eq("id", order.id);

  if (orderUpdateError) {
    console.error("[api/payments/toss/confirm] 주문 업데이트 실패:", orderUpdateError);
    return apiBadRequest(
      "결제는 승인되었으나 주문 업데이트에 실패했습니다. 관리자에게 문의하세요."
    );
  }

  // 6. confirm_batch_payment RPC 호출 — 연결된 모든 payment_records를 paid로 업데이트
  const { error: rpcError } = await adminClient.rpc("confirm_batch_payment", {
    p_order_id: order.id,
  });

  if (rpcError) {
    console.error("[api/payments/toss/confirm] 배치 결제 RPC 실패:", rpcError);
    return apiBadRequest(
      "결제는 승인되었으나 결제 내역 업데이트에 실패했습니다. 관리자에게 문의하세요."
    );
  }

  return apiSuccess({
    paymentKey: tossResponse.paymentKey,
    orderId: tossResponse.orderId,
    status: "paid" as PaymentStatus,
    method: tossResponse.method,
    receiptUrl: tossResponse.receipt?.url ?? null,
  });
}
