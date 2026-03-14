"use server";

import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionError } from "@/lib/logging/actionLogger";
import type {
  PaymentLink,
  CreatePaymentLinkInput,
  GuestPaymentData,
  PaymentLinkStatus,
} from "./types";
import { sendPaymentLinkNotification } from "./delivery";

type ActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

const DEFAULT_EXPIRES_HOURS = 72;

/** 결제 링크 생성 (admin only) */
export async function createPaymentLinkAction(
  input: CreatePaymentLinkInput
): Promise<ActionResult<{ id: string; token: string }>> {
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

    // payment_record 조회 + 소유권 + 상태 검증
    const { data: record, error: recordError } = await adminClient
      .from("payment_records")
      .select(
        "id, tenant_id, student_id, amount, paid_amount, status, due_date, memo, enrollments(programs(name))"
      )
      .eq("id", input.paymentRecordId)
      .maybeSingle();

    if (recordError || !record) {
      return { success: false, error: "결제 기록을 찾을 수 없습니다." };
    }

    if (record.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    if (record.status === "paid") {
      return { success: false, error: "이미 결제가 완료된 건입니다." };
    }

    if (record.status === "refunded" || record.status === "cancelled") {
      return { success: false, error: "환불 또는 취소된 결제 건입니다." };
    }

    // 학생 이름 조회 (user_profiles)
    const { data: student } = await adminClient
      .from("user_profiles")
      .select("name")
      .eq("id", record.student_id)
      .maybeSingle();

    // 학원(테넌트) 이름 조회
    const { data: tenant } = await adminClient
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .maybeSingle();

    const enrollment = record.enrollments as {
      programs: { name: string } | null;
    } | null;
    const programName = enrollment?.programs?.name ?? "수강료";
    const studentName = student?.name ?? "학생";
    const academyName = tenant?.name ?? "학원";

    // 잔액 계산
    const existingPaid = record.paid_amount ?? 0;
    const remainingAmount = record.amount - existingPaid;

    if (remainingAmount <= 0) {
      return { success: false, error: "이미 완납된 결제 건입니다." };
    }

    // 기존 active 링크 만료 처리
    await adminClient
      .from("payment_links")
      .update({ status: "cancelled" as PaymentLinkStatus })
      .eq("payment_record_id", input.paymentRecordId)
      .eq("status", "active");

    const token = nanoid(21);
    const expiresAt = new Date(
      Date.now() + (input.expiresInHours ?? DEFAULT_EXPIRES_HOURS) * 60 * 60 * 1000
    ).toISOString();

    const { data: link, error: insertError } = await adminClient
      .from("payment_links")
      .insert({
        token,
        tenant_id: tenantId,
        payment_record_id: input.paymentRecordId,
        student_id: record.student_id,
        academy_name: academyName,
        student_name: studentName,
        program_name: programName,
        amount: remainingAmount,
        due_date: record.due_date ?? null,
        memo: input.memo ?? record.memo ?? null,
        status: "active",
        expires_at: expiresAt,
        delivery_method: input.deliveryMethod,
        delivery_status: input.deliveryMethod === "manual" ? "skipped" : "pending",
        recipient_phone: input.recipientPhone ?? null,
        created_by: userId,
      })
      .select("id, token")
      .single();

    if (insertError || !link) {
      logActionError(
        { domain: "payment", action: "createPaymentLink", tenantId, userId },
        insertError,
        { paymentRecordId: input.paymentRecordId }
      );
      return { success: false, error: "결제 링크 생성에 실패했습니다." };
    }

    // 알림 발송 (manual이면 건너뜀)
    if (input.deliveryMethod !== "manual" && input.recipientPhone) {
      // 비동기 발송 (실패해도 링크 생성은 성공)
      sendPaymentLinkNotification({
        linkId: link.id,
        token: link.token,
        recipientPhone: input.recipientPhone,
        academyName,
        studentName,
        programName,
        amount: remainingAmount,
        tenantId,
        deliveryMethod: input.deliveryMethod,
      }).catch((err) => {
        logActionError(
          { domain: "payment", action: "sendPaymentLinkNotification", tenantId, userId },
          err,
          { linkId: link.id }
        );
      });
    }

    revalidatePath("/admin/students");
    return { success: true, data: { id: link.id, token: link.token } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "결제 링크 생성 중 오류가 발생했습니다.",
    };
  }
}

/** 결제 링크 취소 (admin only) */
export async function cancelPaymentLinkAction(
  linkId: string
): Promise<ActionResult> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    const { error } = await adminClient
      .from("payment_links")
      .update({ status: "cancelled" as PaymentLinkStatus })
      .eq("id", linkId)
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (error) {
      return { success: false, error: "링크 취소에 실패했습니다." };
    }

    revalidatePath("/admin/students");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "링크 취소 중 오류가 발생했습니다.",
    };
  }
}

/** 결제 링크 재발송 (admin only) */
export async function resendPaymentLinkAction(
  linkId: string
): Promise<ActionResult> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    const { data: link, error: fetchError } = await adminClient
      .from("payment_links")
      .select("*")
      .eq("id", linkId)
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .maybeSingle();

    if (fetchError || !link) {
      return { success: false, error: "활성 결제 링크를 찾을 수 없습니다." };
    }

    if (!link.recipient_phone) {
      return { success: false, error: "수신자 전화번호가 없습니다." };
    }

    if (new Date(link.expires_at) <= new Date()) {
      return { success: false, error: "만료된 링크입니다." };
    }

    const result = await sendPaymentLinkNotification({
      linkId: link.id,
      token: link.token,
      recipientPhone: link.recipient_phone,
      academyName: link.academy_name,
      studentName: link.student_name,
      programName: link.program_name,
      amount: link.amount,
      tenantId,
      deliveryMethod: (link.delivery_method as "alimtalk" | "sms") ?? "sms",
    });

    if (!result.success) {
      return { success: false, error: result.error ?? "발송에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "재발송 중 오류가 발생했습니다.",
    };
  }
}

/** 토큰으로 결제 링크 검증 (public — 인증 불필요) */
export async function validatePaymentLinkToken(
  token: string
): Promise<
  | { valid: true; data: GuestPaymentData }
  | { valid: false; reason: "expired" | "cancelled" | "completed" | "not_found" | "payment_completed" }
> {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return { valid: false, reason: "not_found" };
  }

  const { data: link, error } = await adminClient
    .from("payment_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error || !link) {
    return { valid: false, reason: "not_found" };
  }

  // view_count 증가 (fire-and-forget, SQL increment로 race condition 방지)
  adminClient
    .rpc("increment_payment_link_view", { link_id: link.id })
    .then(() => {});

  if (link.status === "completed") {
    return { valid: false, reason: "completed" };
  }
  if (link.status === "cancelled") {
    return { valid: false, reason: "cancelled" };
  }
  if (link.status === "expired" || new Date(link.expires_at) <= new Date()) {
    // 자동 만료 처리
    if (link.status === "active") {
      await adminClient
        .from("payment_links")
        .update({ status: "expired" as PaymentLinkStatus })
        .eq("id", link.id);
    }
    return { valid: false, reason: "expired" };
  }

  // payment_record 상태 + toss_order_id 한 번에 조회
  const { data: record } = await adminClient
    .from("payment_records")
    .select("status, toss_order_id")
    .eq("id", link.payment_record_id)
    .maybeSingle();

  if (record?.status === "paid") {
    // 링크도 completed로 업데이트
    await adminClient
      .from("payment_links")
      .update({ status: "completed" as PaymentLinkStatus })
      .eq("id", link.id);
    return { valid: false, reason: "payment_completed" };
  }

  // toss_order_id 생성 (payment_record에 아직 없으면 생성)
  let orderId: string;
  if (record?.toss_order_id) {
    orderId = record.toss_order_id;
  } else {
    orderId = `TLU-GUEST-${nanoid(12)}`;
    await adminClient
      .from("payment_records")
      .update({ toss_order_id: orderId })
      .eq("id", link.payment_record_id);
  }

  return {
    valid: true,
    data: {
      token: link.token,
      academyName: link.academy_name,
      studentName: link.student_name,
      programName: link.program_name,
      amount: link.amount,
      dueDate: link.due_date,
      memo: link.memo,
      orderId,
      expiresAt: link.expires_at,
    },
  };
}

/** 특정 payment_record의 결제 링크 목록 조회 (admin only) */
export async function getPaymentLinksForRecord(
  paymentRecordId: string
): Promise<ActionResult<PaymentLink[]>> {
  try {
    await requireAdminOrConsultant();

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    const { data, error } = await adminClient
      .from("payment_links")
      .select("*")
      .eq("payment_record_id", paymentRecordId)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as PaymentLink[] };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "조회 중 오류가 발생했습니다.",
    };
  }
}
