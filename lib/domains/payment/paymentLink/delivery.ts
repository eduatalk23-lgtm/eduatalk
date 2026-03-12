import { sendAlimtalk } from "@/lib/services/alimtalkService";
import { sendSMS } from "@/lib/services/smsService";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { SITE_URL } from "@/lib/constants/routes";
import type { DeliveryMethod, DeliveryStatus } from "./types";

type SendNotificationParams = {
  linkId: string;
  token: string;
  recipientPhone: string;
  academyName: string;
  studentName: string;
  programName: string;
  amount: number;
  tenantId: string;
  deliveryMethod: DeliveryMethod;
};

type SendResult = {
  success: boolean;
  error?: string;
};

/** 결제 링크 알림 발송 (알림톡 primary, SMS fallback) */
export async function sendPaymentLinkNotification(
  params: SendNotificationParams
): Promise<SendResult> {
  const {
    linkId,
    token,
    recipientPhone,
    academyName,
    studentName,
    programName,
    amount,
    tenantId,
    deliveryMethod,
  } = params;

  const paymentUrl = `${SITE_URL}/pay/${token}`;
  const formattedAmount = amount.toLocaleString("ko-KR");

  const message = [
    `[${academyName}] 수강료 결제 안내`,
    "",
    `학생: ${studentName}`,
    `프로그램: ${programName}`,
    `결제금액: ${formattedAmount}원`,
    "",
    `아래 링크에서 결제해 주세요.`,
    paymentUrl,
  ].join("\n");

  const adminClient = createSupabaseAdminClient();

  let result: SendResult;

  if (deliveryMethod === "alimtalk") {
    // 알림톡 발송 (SMS 자동 fallback 포함)
    const alimtalkResult = await sendAlimtalk({
      recipientPhone,
      message,
      smsFallbackMessage: message,
      tenantId,
      templateCode: "payment_link", // 카카오 템플릿 코드 (등록 필요)
      notificationTarget: "학부모",
    });

    result = {
      success: alimtalkResult.success,
      error: alimtalkResult.error,
    };
  } else {
    // SMS 직접 발송
    const smsResult = await sendSMS({
      recipientPhone,
      message,
      tenantId,
      notificationTarget: "학부모",
    });

    result = {
      success: smsResult.success,
      error: smsResult.error,
    };
  }

  // 발송 상태 업데이트
  if (adminClient) {
    const deliveryStatus: DeliveryStatus = result.success ? "sent" : "failed";
    await adminClient
      .from("payment_links")
      .update({
        delivery_status: deliveryStatus,
        delivered_at: result.success ? new Date().toISOString() : null,
      })
      .eq("id", linkId);
  }

  if (result.success) {
    logActionDebug(
      { domain: "payment", action: "sendPaymentLinkNotification" },
      "결제 링크 발송 성공",
      { linkId, deliveryMethod, recipientPhone }
    );
  } else {
    logActionError(
      { domain: "payment", action: "sendPaymentLinkNotification" },
      new Error(result.error ?? "발송 실패"),
      { linkId, deliveryMethod, recipientPhone }
    );
  }

  return result;
}

// ---------- 결제 완료 영수증 알림 ----------

type SendReceiptParams = {
  recipientPhone: string;
  academyName: string;
  studentName: string;
  programName: string;
  amount: number;
  tenantId: string;
  receiptUrl: string | null;
  deliveryMethod: DeliveryMethod;
};

/** 결제 완료 영수증 알림 발송 */
export async function sendPaymentReceiptNotification(
  params: SendReceiptParams
): Promise<SendResult> {
  const {
    recipientPhone,
    academyName,
    studentName,
    programName,
    amount,
    tenantId,
    receiptUrl,
    deliveryMethod,
  } = params;

  const formattedAmount = amount.toLocaleString("ko-KR");

  const lines = [
    `[${academyName}] 결제 완료 안내`,
    "",
    `학생: ${studentName}`,
    `프로그램: ${programName}`,
    `결제금액: ${formattedAmount}원`,
    "",
    `결제가 정상적으로 완료되었습니다.`,
  ];

  if (receiptUrl) {
    lines.push("", `영수증 확인: ${receiptUrl}`);
  }

  const message = lines.join("\n");

  let result: SendResult;

  if (deliveryMethod === "alimtalk") {
    const alimtalkResult = await sendAlimtalk({
      recipientPhone,
      message,
      smsFallbackMessage: message,
      tenantId,
      templateCode: "payment_receipt",
      notificationTarget: "학부모",
    });
    result = { success: alimtalkResult.success, error: alimtalkResult.error };
  } else {
    const smsResult = await sendSMS({
      recipientPhone,
      message,
      tenantId,
      notificationTarget: "학부모",
    });
    result = { success: smsResult.success, error: smsResult.error };
  }

  if (result.success) {
    logActionDebug(
      { domain: "payment", action: "sendPaymentReceiptNotification" },
      "결제 영수증 알림 발송 성공",
      { recipientPhone }
    );
  } else {
    logActionError(
      { domain: "payment", action: "sendPaymentReceiptNotification" },
      new Error(result.error ?? "발송 실패"),
      { recipientPhone }
    );
  }

  return result;
}

// ---------- 만료 임박 리마인더 ----------

type SendExpiryReminderParams = {
  recipientPhone: string;
  academyName: string;
  studentName: string;
  programName: string;
  amount: number;
  tenantId: string;
  token: string;
  deliveryMethod: DeliveryMethod;
};

/** 결제 링크 만료 임박 리마인더 발송 */
export async function sendPaymentLinkExpiryReminder(
  params: SendExpiryReminderParams
): Promise<SendResult> {
  const {
    recipientPhone,
    academyName,
    studentName,
    programName,
    amount,
    tenantId,
    token,
    deliveryMethod,
  } = params;

  const paymentUrl = `${SITE_URL}/pay/${token}`;
  const formattedAmount = amount.toLocaleString("ko-KR");

  const message = [
    `[${academyName}] 결제 링크 만료 안내`,
    "",
    `학생: ${studentName}`,
    `프로그램: ${programName}`,
    `결제금액: ${formattedAmount}원`,
    "",
    `결제 링크가 오늘 만료됩니다.`,
    `아래 링크에서 결제해 주세요.`,
    paymentUrl,
  ].join("\n");

  let result: SendResult;

  if (deliveryMethod === "alimtalk") {
    const alimtalkResult = await sendAlimtalk({
      recipientPhone,
      message,
      smsFallbackMessage: message,
      tenantId,
      templateCode: "payment_link_expiry",
      notificationTarget: "학부모",
    });
    result = { success: alimtalkResult.success, error: alimtalkResult.error };
  } else {
    const smsResult = await sendSMS({
      recipientPhone,
      message,
      tenantId,
      notificationTarget: "학부모",
    });
    result = { success: smsResult.success, error: smsResult.error };
  }

  if (result.success) {
    logActionDebug(
      { domain: "payment", action: "sendPaymentLinkExpiryReminder" },
      "만료 임박 리마인더 발송 성공",
      { recipientPhone }
    );
  } else {
    logActionError(
      { domain: "payment", action: "sendPaymentLinkExpiryReminder" },
      new Error(result.error ?? "발송 실패"),
      { recipientPhone }
    );
  }

  return result;
}
