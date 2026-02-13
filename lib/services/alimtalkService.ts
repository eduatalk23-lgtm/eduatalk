/**
 * 카카오 알림톡 발송 서비스
 * 뿌리오 /v1/kakao API를 사용하여 알림톡 발송 + SMS 대체 발송(fallback)
 * API 문서: https://www.ppurio.com
 */

import { env } from "@/lib/env";
import { getAccessToken, validateAndNormalizePhoneNumber } from "@/lib/services/smsService";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { proxyFetch } from "@/lib/services/proxyFetch";
import { buildChangeWord, type AlimtalkButton } from "./alimtalkTemplates";

// ── 타입 정의 ──

export interface SendAlimtalkOptions {
  recipientPhone: string;
  message: string; // 알림톡 메시지 (1000자)
  smsFallbackMessage?: string; // SMS 대체 메시지 (없으면 message 사용)
  recipientId?: string;
  tenantId: string;
  templateCode: string; // 카카오 템플릿 코드
  buttons?: AlimtalkButton[];
  refKey?: string;
  sendTime?: string;
  consultationScheduleId?: string; // 상담 일정 FK (발송 이력 추적용)
  templateVariables?: Record<string, string>; // 템플릿 변수 (changeWord 생성용)
  variableOrder?: string[]; // 변수 순서 (changeWord var1, var2, ... 매핑)
  smsFallbackSubject?: string; // LMS 대체 발송 시 제목 (30자)
  notificationTarget?: string; // 알림 대상 (학생/부/모) — 발송 시점 기록
}

export interface SendAlimtalkResult {
  success: boolean;
  messageKey?: string;
  smsLogId?: string;
  channel: "alimtalk" | "sms"; // 실제 발송된 채널
  error?: string;
}

interface PpurioKakaoResponse {
  code: number | string;
  description: string;
  refKey?: string;
  messageKey?: string;
}

/**
 * 알림톡 발송 (SMS fallback 포함)
 * 뿌리오 /v1/kakao API의 isResend 기능으로 알림톡 실패 시 SMS 자동 대체 발송
 */
export async function sendAlimtalk(
  options: SendAlimtalkOptions
): Promise<SendAlimtalkResult> {
  const {
    recipientPhone,
    message,
    smsFallbackMessage,
    recipientId,
    tenantId,
    templateCode,
    refKey,
    consultationScheduleId,
    templateVariables,
    variableOrder,
    smsFallbackSubject,
    notificationTarget,
  } = options;

  // 환경 변수 확인
  if (
    !env.PPURIO_ACCOUNT ||
    !env.PPURIO_AUTH_KEY ||
    !env.PPURIO_SENDER_NUMBER ||
    !env.PPURIO_KAKAO_SENDER_PROFILE
  ) {
    return {
      success: false,
      channel: "alimtalk",
      error: "알림톡 발송 설정이 완료되지 않았습니다. 관리자에게 문의하세요.",
    };
  }

  // 전화번호 검증
  const phoneValidation = validateAndNormalizePhoneNumber(recipientPhone);
  if (!phoneValidation.isValid) {
    return {
      success: false,
      channel: "alimtalk",
      error: phoneValidation.error || "전화번호 형식이 올바르지 않습니다.",
    };
  }

  const normalizedPhone = phoneValidation.normalized;

  // sms_logs 생성 (channel: 'alimtalk')
  const logClient = await getSupabaseClientForRLSBypass({
    forceAdmin: true,
    fallbackToServer: false,
  });

  if (!logClient) {
    return {
      success: false,
      channel: "alimtalk",
      error: "시스템 오류: 로깅 클라이언트를 초기화할 수 없습니다.",
    };
  }

  const { data: smsLog, error: logError } = await logClient
    .from("sms_logs")
    .insert({
      tenant_id: tenantId,
      recipient_id: recipientId,
      recipient_phone: normalizedPhone,
      message_content: message,
      status: "pending",
      channel: "alimtalk",
      alimtalk_template_code: templateCode,
      consultation_schedule_id: consultationScheduleId ?? null,
      notification_target: notificationTarget ?? null,
    })
    .select()
    .single();

  if (logError || !smsLog) {
    logActionError(
      { domain: "service", action: "sendAlimtalk" },
      logError,
      { context: "로그 생성", recipientPhone: normalizedPhone }
    );
    return {
      success: false,
      channel: "alimtalk",
      error: "알림톡 로그 생성에 실패했습니다.",
    };
  }

  const baseUrl = env.PPURIO_API_BASE_URL || "https://message.ppurio.com";
  const messageEndpoint = `${baseUrl}/v1/kakao`;
  const refKeyValue = (refKey || smsLog.id).toString().slice(0, 32);

  // SMS 대체 메시지
  const smsMessage = smsFallbackMessage || message;
  // 90바이트 초과 시 LMS로 대체 발송
  const smsMessageBytes = new TextEncoder().encode(smsMessage).length;
  const resendMessageType = smsMessageBytes <= 90 ? "SMS" : "LMS";

  try {
    const accessToken = await getAccessToken();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // changeWord 생성 (variableOrder + templateVariables)
    const target: Record<string, unknown> = { to: normalizedPhone };
    if (variableOrder && templateVariables) {
      target.changeWord = buildChangeWord(variableOrder, templateVariables);
    }

    // 뿌리오 /v1/kakao 요청 바디
    const requestBody: Record<string, unknown> = {
      account: env.PPURIO_ACCOUNT,
      messageType: "alt", // 알림톡
      senderProfile: env.PPURIO_KAKAO_SENDER_PROFILE,
      templateCode: templateCode,
      duplicateFlag: "N",
      isResend: "Y", // 알림톡 실패 시 SMS/LMS 자동 대체 발송
      resend: {
        messageType: resendMessageType,
        content: smsMessage,
        from: env.PPURIO_SENDER_NUMBER,
        ...(resendMessageType === "LMS" && smsFallbackSubject
          ? { subject: smsFallbackSubject.slice(0, 30) }
          : {}),
      },
      targetCount: 1,
      targets: [target],
      refKey: refKeyValue,
    };

    logActionDebug(
      { domain: "service", action: "sendAlimtalk" },
      "요청 본문",
      { requestBody }
    );

    const response = await proxyFetch(messageEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();

    logActionDebug(
      { domain: "service", action: "sendAlimtalk" },
      "API 응답",
      {
        status: response.status,
        ok: response.ok,
        body: responseText,
      }
    );

    let result: PpurioKakaoResponse;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(
        `응답 파싱 실패 (HTTP ${response.status}): ${responseText}`
      );
    }

    if (!response.ok) {
      throw new Error(
        result.description || `API 요청 실패: ${response.status}`
      );
    }

    const responseCode = typeof result.code === "string"
      ? parseInt(result.code, 10)
      : result.code;

    if (responseCode === 1000) {
      const messageKey = result.messageKey || `ref-${refKeyValue}`;

      await logClient
        .from("sms_logs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          message_key: result.messageKey || null,
          ref_key: refKeyValue || null,
        })
        .eq("id", smsLog.id);

      logActionDebug(
        { domain: "service", action: "sendAlimtalk" },
        "발송 성공",
        {
          phone: normalizedPhone,
          messageKey,
          channel: "alimtalk",
          templateCode,
        }
      );

      return {
        success: true,
        messageKey,
        smsLogId: smsLog.id,
        channel: "alimtalk",
      };
    }

    // 실패 처리
    const errorMessage = result.description || "알림톡 발송에 실패했습니다.";

    await logClient
      .from("sms_logs")
      .update({
        status: "failed",
        error_message: errorMessage,
      })
      .eq("id", smsLog.id);

    return {
      success: false,
      channel: "alimtalk",
      error: errorMessage,
    };
  } catch (error: unknown) {
    let errorMessage = "알 수 없는 오류가 발생했습니다.";

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        errorMessage = "요청 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.";
      } else if (
        error.message.includes("fetch") ||
        error.message === "fetch failed"
      ) {
        errorMessage =
          "네트워크 연결에 실패했습니다. 인터넷 연결 및 API 엔드포인트를 확인해주세요.";
      } else {
        errorMessage = error.message;
      }
    }

    await logClient
      .from("sms_logs")
      .update({
        status: "failed",
        error_message: errorMessage,
      })
      .eq("id", smsLog.id);

    logActionError(
      { domain: "service", action: "sendAlimtalk" },
      error,
      {
        phone: normalizedPhone,
        endpoint: messageEndpoint,
        templateCode,
      }
    );

    return {
      success: false,
      channel: "alimtalk",
      error: errorMessage,
    };
  }
}

/**
 * 대량 알림톡 발송
 * 순차 발송 (100ms 딜레이, 기존 패턴)
 */
export async function sendBulkAlimtalk(
  recipients: Array<{
    phone: string;
    message: string;
    recipientId?: string;
    templateCode?: string;
    buttons?: AlimtalkButton[];
    templateVariables?: Record<string, string>;
    variableOrder?: string[];
  }>,
  tenantId: string,
  defaultTemplateCode: string,
  smsFallbackMessage?: string
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

  for (const recipient of recipients) {
    const result = await sendAlimtalk({
      recipientPhone: recipient.phone,
      message: recipient.message,
      smsFallbackMessage: smsFallbackMessage || recipient.message,
      recipientId: recipient.recipientId,
      tenantId,
      templateCode: recipient.templateCode || defaultTemplateCode,
      buttons: recipient.buttons,
      templateVariables: recipient.templateVariables,
      variableOrder: recipient.variableOrder,
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
