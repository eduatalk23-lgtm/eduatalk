/**
 * SMS 발송 서비스
 * 뿌리오 API를 활용한 문자 발송 기능
 */

import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode } from "@/lib/errors";

export interface SendSMSOptions {
  recipientPhone: string;
  message: string;
  recipientId?: string;
  tenantId: string;
  templateId?: string;
}

interface PPurioResponse {
  result_code: number;
  message: string;
  msg_id?: string;
}

/**
 * 단일 SMS 발송
 */
export async function sendSMS(
  options: SendSMSOptions
): Promise<{
  success: boolean;
  msgId?: string;
  smsLogId?: string;
  error?: string;
}> {
  const { recipientPhone, message, recipientId, tenantId, templateId } = options;

  // 환경 변수 확인
  if (!env.PPURIO_USER_ID || !env.PPURIO_API_KEY || !env.PPURIO_SENDER_NUMBER) {
    return {
      success: false,
      error: "SMS 발송 설정이 완료되지 않았습니다. 관리자에게 문의하세요.",
    };
  }

  // 1. SMS 로그 생성 (pending 상태)
  const supabase = await createSupabaseServerClient();
  const { data: smsLog, error: logError } = await supabase
    .from("sms_logs")
    .insert({
      tenant_id: tenantId,
      recipient_id: recipientId,
      recipient_phone: recipientPhone,
      message_content: message,
      template_id: templateId,
      status: "pending",
    })
    .select()
    .single();

  if (logError || !smsLog) {
    console.error("[SMS] 로그 생성 실패:", logError);
    return {
      success: false,
      error: "SMS 로그 생성에 실패했습니다.",
    };
  }

  try {
    // 2. 뿌리오 API 호출
    // 참고: 실제 API 엔드포인트는 뿌리오 문서 확인 필요
    const response = await fetch("https://message.ppurio.com/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PPURIO-USER-ID": env.PPURIO_USER_ID,
        "X-PPURIO-API-KEY": env.PPURIO_API_KEY,
      },
      body: JSON.stringify({
        phone: recipientPhone,
        message: message,
        sender: env.PPURIO_SENDER_NUMBER,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 요청 실패: ${response.status} - ${errorText}`);
    }

    const result: PPurioResponse = await response.json();

    // 3. 발송 결과 업데이트
    if (result.result_code === 200 && result.msg_id) {
      await supabase
        .from("sms_logs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", smsLog.id);

      return {
        success: true,
        msgId: result.msg_id,
        smsLogId: smsLog.id,
      };
    } else {
      await supabase
        .from("sms_logs")
        .update({
          status: "failed",
          error_message: result.message || "알 수 없는 오류",
        })
        .eq("id", smsLog.id);

      return {
        success: false,
        error: result.message || "SMS 발송에 실패했습니다.",
      };
    }
  } catch (error: any) {
    // 4. 에러 처리
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";

    await supabase
      .from("sms_logs")
      .update({
        status: "failed",
        error_message: errorMessage,
      })
      .eq("id", smsLog.id);

    console.error("[SMS] 발송 실패:", error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 대량 SMS 발송
 * Rate Limit을 고려하여 순차 발송
 */
export async function sendBulkSMS(
  recipients: Array<{
    phone: string;
    message: string;
    recipientId?: string;
  }>,
  tenantId: string,
  templateId?: string
): Promise<{
  success: number;
  failed: number;
  errors: Array<{ phone: string; error: string }>;
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ phone: string; error: string }>,
  };

  // 순차 발송 (API Rate Limit 고려)
  for (const recipient of recipients) {
    const result = await sendSMS({
      recipientPhone: recipient.phone,
      message: recipient.message,
      recipientId: recipient.recipientId,
      tenantId,
      templateId,
    });

    if (result.success) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push({
        phone: recipient.phone,
        error: result.error || "알 수 없는 오류",
      });
    }

    // Rate Limit 방지를 위한 딜레이 (100ms)
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

