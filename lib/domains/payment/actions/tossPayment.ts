"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cancelTossPayment } from "@/lib/services/tossPayments";
import { getLinkedStudents } from "@/lib/domains/parent/utils";
import { logActionError } from "@/lib/logging/actionLogger";

type ActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * 결제 준비: toss_order_id를 생성하고 위젯 초기화에 필요한 데이터를 반환
 * 학부모 또는 관리자 모두 호출 가능
 */
export async function prepareTossPaymentAction(
  paymentId: string
): Promise<
  ActionResult<{
    orderId: string;
    amount: number;
    orderName: string;
  }>
> {
  try {
    const { userId, role } = await getCurrentUserRole();
    if (!userId || !role) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    // 결제 레코드 조회 (프로그램명 포함)
    const { data: record, error } = await adminClient
      .from("payment_records")
      .select("id, amount, paid_amount, status, toss_order_id, enrollment_id, enrollments(program_id, programs(name))")
      .eq("id", paymentId)
      .maybeSingle();

    if (error || !record) {
      return { success: false, error: "결제 레코드를 찾을 수 없습니다." };
    }

    if (record.status === "paid") {
      return { success: false, error: "이미 결제가 완료된 건입니다." };
    }

    // toss_order_id가 이미 있으면 재사용, 없으면 생성
    let orderId = record.toss_order_id as string | null;

    if (!orderId) {
      // TLU-{uuid} 형식으로 다른 사이트와 충돌 방지
      orderId = `TLU-${crypto.randomUUID()}`;

      const { error: updateError } = await adminClient
        .from("payment_records")
        .update({ toss_order_id: orderId })
        .eq("id", paymentId);

      if (updateError) {
        return { success: false, error: "주문 ID 생성에 실패했습니다." };
      }
    }

    // 프로그램명 추출
    const enrollment = record.enrollments as {
      program_id: string;
      programs: { name: string } | null;
    } | null;
    const programName = enrollment?.programs?.name ?? "수강료";

    // 부분납 상태면 잔액만 결제
    const remaining = (record.amount as number) - ((record.paid_amount as number) ?? 0);

    if (remaining <= 0) {
      return { success: false, error: "이미 완납된 결제 건입니다." };
    }

    return {
      success: true,
      data: {
        orderId,
        amount: remaining,
        orderName: programName,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "결제 준비 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 일괄 결제 준비: 여러 payment_records를 하나의 payment_order로 묶고 위젯 데이터 반환
 * 학부모 또는 관리자 모두 호출 가능
 */
export async function prepareBatchTossPaymentAction(
  paymentIds: string[]
): Promise<
  ActionResult<{
    orderId: string;
    amount: number;
    orderName: string;
    itemCount: number;
  }>
> {
  try {
    const { userId, role } = await getCurrentUserRole();
    if (!userId || !role) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    if (paymentIds.length < 2) {
      return { success: false, error: "일괄 결제는 2건 이상 선택해야 합니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    // 1. 결제 레코드 조회 (프로그램명 포함)
    const { data: records, error } = await adminClient
      .from("payment_records")
      .select(
        "id, amount, paid_amount, status, tenant_id, student_id, payment_order_id, enrollment_id, enrollments(program_id, programs(name))"
      )
      .in("id", paymentIds);

    if (error || !records || records.length === 0) {
      return { success: false, error: "결제 레코드를 찾을 수 없습니다." };
    }

    if (records.length !== paymentIds.length) {
      return { success: false, error: "일부 결제 레코드를 찾을 수 없습니다." };
    }

    // 2. 권한 검증
    if (role === "parent") {
      const supabase = await createSupabaseServerClient();
      const linkedStudents = await getLinkedStudents(supabase, userId);
      const studentIds = new Set(linkedStudents.map((s) => s.id));
      const unauthorized = records.some(
        (r) => !studentIds.has(r.student_id)
      );
      if (unauthorized) {
        return { success: false, error: "해당 결제에 대한 권한이 없습니다." };
      }
    }

    // 3. 상태 검증
    const invalidStatus = records.find(
      (r) => r.status !== "unpaid" && r.status !== "partial"
    );
    if (invalidStatus) {
      return { success: false, error: "이미 결제 완료된 건이 포함되어 있습니다." };
    }

    // 이미 다른 배치에 포함된 건 체크
    const alreadyBatched = records.find(
      (r) => r.payment_order_id != null
    );
    if (alreadyBatched) {
      return {
        success: false,
        error: "이미 다른 일괄 결제에 포함된 건이 있습니다.",
      };
    }

    // 4. 총 금액 계산 (부분납 상태면 잔액 기준)
    const totalAmount = records.reduce((sum, r) => {
      const remaining = (r.amount as number) - ((r.paid_amount as number) ?? 0);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);

    if (totalAmount <= 0) {
      return { success: false, error: "결제할 잔액이 없습니다." };
    }
    const tenantId = records[0].tenant_id;

    // 5. payment_orders INSERT
    const orderId = `TLU-BATCH-${crypto.randomUUID()}`;

    const { data: order, error: orderError } = await adminClient
      .from("payment_orders")
      .insert({
        tenant_id: tenantId,
        toss_order_id: orderId,
        total_amount: totalAmount,
        status: "pending",
        created_by: userId,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return { success: false, error: "일괄 결제 주문 생성에 실패했습니다." };
    }

    // 6. payment_records에 payment_order_id 연결
    const { error: linkError } = await adminClient
      .from("payment_records")
      .update({ payment_order_id: order.id })
      .in("id", paymentIds);

    if (linkError) {
      // rollback: order 삭제
      await adminClient.from("payment_orders").delete().eq("id", order.id);
      return { success: false, error: "결제 레코드 연결에 실패했습니다." };
    }

    // 7. orderName 생성: "수학 심화반 외 2건" 형식
    const firstEnrollment = records[0].enrollments as {
      program_id: string;
      programs: { name: string } | null;
    } | null;
    const firstName = firstEnrollment?.programs?.name ?? "수강료";
    const orderName =
      records.length === 1
        ? firstName
        : `${firstName} 외 ${records.length - 1}건`;

    return {
      success: true,
      data: {
        orderId,
        amount: totalAmount,
        orderName,
        itemCount: records.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "일괄 결제 준비 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 토스페이먼츠 결제 환불 (관리자 전용)
 */
export async function refundTossPaymentAction(
  paymentId: string,
  cancelReason: string,
  cancelAmount?: number
): Promise<ActionResult> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    // 결제 레코드 조회
    const { data: record } = await adminClient
      .from("payment_records")
      .select("id, tenant_id, amount, paid_amount, toss_payment_key, status")
      .eq("id", paymentId)
      .maybeSingle();

    if (!record || record.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    if (!record.toss_payment_key) {
      return {
        success: false,
        error: "토스 결제 정보가 없습니다. 온라인 결제 건만 환불할 수 있습니다.",
      };
    }

    // 환불 가능한 상태인지 확인 (paid 또는 partial만 가능)
    if (record.status !== "paid" && record.status !== "partial") {
      return {
        success: false,
        error:
          record.status === "refunded"
            ? "이미 환불된 건입니다."
            : "결제가 완료되지 않아 환불할 수 없습니다.",
      };
    }

    // 부분 환불 금액 검증 (서버 사이드)
    if (cancelAmount != null) {
      if (cancelAmount <= 0) {
        return { success: false, error: "환불 금액은 0보다 커야 합니다." };
      }
      if (cancelAmount > record.paid_amount) {
        return {
          success: false,
          error: `환불 금액(${cancelAmount.toLocaleString()}원)이 결제 잔액(${record.paid_amount.toLocaleString()}원)을 초과합니다.`,
        };
      }
    }

    // 토스 API 환불 호출
    try {
      const tossResponse = await cancelTossPayment({
        paymentKey: record.toss_payment_key,
        cancelReason,
        cancelAmount,
      });

      // DB 업데이트
      const actualRefundAmount = cancelAmount ?? record.paid_amount;
      const remainingAmount = record.paid_amount - actualRefundAmount;
      const isFullRefund = remainingAmount <= 0;

      const { error: updateError } = await adminClient
        .from("payment_records")
        .update({
          status: isFullRefund ? "refunded" : "partial",
          paid_amount: isFullRefund ? 0 : remainingAmount,
          toss_raw_response: JSON.parse(JSON.stringify(tossResponse)),
          memo: `환불: ${cancelReason} (${actualRefundAmount.toLocaleString()}원)`,
        })
        .eq("id", paymentId);

      if (updateError) {
        logActionError(
          { domain: "payment", action: "refund", tenantId, userId },
          updateError,
          { paymentId }
        );
        return {
          success: false,
          error: "환불은 처리되었으나 DB 업데이트에 실패했습니다.",
        };
      }

      revalidatePath("/admin/students");
      return { success: true };
    } catch (tossError) {
      const err = tossError as Error;
      logActionError(
        { domain: "payment", action: "refund", tenantId, userId },
        tossError,
        { paymentId, cancelReason }
      );
      return {
        success: false,
        error: err.message || "환불 처리 중 오류가 발생했습니다.",
      };
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "환불 처리 중 오류가 발생했습니다.",
    };
  }
}
