/**
 * 카카오 알림톡 발송 서비스
 * 비즈뿌리오 v3 API를 사용하여 알림톡 발송 + SMS 대체 발송(fallback)
 * API 문서: https://www.bizppurio.com
 */

import { env } from "@/lib/env";
import { base64Encode, validateAndNormalizePhoneNumber } from "@/lib/services/smsService";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { proxyFetch } from "@/lib/services/proxyFetch";
import type { AlimtalkButton } from "./alimtalkTemplates";

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
}

export interface SendAlimtalkResult {
  success: boolean;
  messageKey?: string;
  smsLogId?: string;
  channel: "alimtalk" | "sms"; // 실제 발송된 채널
  error?: string;
}

interface BizPpurioTokenResponse {
  token: string;
  type: string;
  expired: string; // ISO 날짜 문자열
}

interface BizPpurioMessageResponse {
  code: string;
  description: string;
  refkey?: string;
  messagekey?: string;
}

// ── 토큰 캐시 (smsService와 별도 관리) ──

let bizTokenCache: {
  token: string;
  expiresAt: number;
} | null = null;

/**
 * 비즈뿌리오 v3 API 인증 토큰 발급
 * Basic Auth: Base64(account:password)
 */
async function getBizPpurioAccessToken(): Promise<string> {
  if (bizTokenCache && bizTokenCache.expiresAt > Date.now()) {
    return bizTokenCache.token;
  }

  const account = env.BIZPPURIO_ACCOUNT;
  const password = env.BIZPPURIO_PASSWORD;
  const baseUrl = env.BIZPPURIO_API_BASE_URL || "https://api.bizppurio.com";

  if (!account || !password) {
    throw new Error(
      "비즈뿌리오 계정(BIZPPURIO_ACCOUNT) 및 암호(BIZPPURIO_PASSWORD)가 설정되지 않았습니다."
    );
  }

  const credentials = base64Encode(`${account}:${password}`);
  const tokenEndpoint = `${baseUrl}/v1/token`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await proxyFetch(tokenEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `비즈뿌리오 토큰 발급 실패 (HTTP ${response.status}): ${errorText}`
      );
    }

    const result: BizPpurioTokenResponse = await response.json();

    if (!result.token) {
      throw new Error("비즈뿌리오 토큰 발급 응답에 토큰이 없습니다.");
    }

    // 토큰 캐싱 (만료 시간 파싱, 여유 1시간 차감)
    const expiresAt = result.expired
      ? new Date(result.expired).getTime() - 60 * 60 * 1000
      : Date.now() + 23 * 60 * 60 * 1000;

    bizTokenCache = { token: result.token, expiresAt };

    return result.token;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("비즈뿌리오 토큰 발급 요청 시간이 초과되었습니다.");
    }
    throw error;
  }
}

/**
 * 알림톡 발송 (SMS fallback 포함)
 * 비즈뿌리오 v3 API의 resend 기능으로 알림톡 실패 시 SMS 자동 대체 발송
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
    buttons,
    refKey,
    consultationScheduleId,
  } = options;

  // 환경 변수 확인
  if (
    !env.BIZPPURIO_ACCOUNT ||
    !env.BIZPPURIO_PASSWORD ||
    !env.BIZPPURIO_SENDER_KEY ||
    !env.PPURIO_SENDER_NUMBER
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

  const baseUrl = env.BIZPPURIO_API_BASE_URL || "https://api.bizppurio.com";
  const messageEndpoint = `${baseUrl}/v3/message`;
  const refKeyValue = (refKey || smsLog.id).toString().slice(0, 32);

  // SMS 대체 메시지 (90byte 이하면 SMS, 초과하면 LMS로 자동 처리)
  const smsMessage = smsFallbackMessage || message;

  try {
    const accessToken = await getBizPpurioAccessToken();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // 비즈뿌리오 v3 요청 바디
    const requestBody: Record<string, unknown> = {
      account: env.BIZPPURIO_ACCOUNT,
      type: "at", // 알림톡
      from: env.PPURIO_SENDER_NUMBER,
      to: normalizedPhone,
      refkey: refKeyValue,
      content: {
        at: {
          senderkey: env.BIZPPURIO_SENDER_KEY,
          templatecode: templateCode,
          message: message,
          ...(buttons?.length && { button: buttons }),
        },
      },
      resend: "sms", // 알림톡 실패 시 SMS 대체 발송
      recontent: {
        sms: { message: smsMessage },
      },
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

    let result: BizPpurioMessageResponse;
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

    const responseCode = parseInt(result.code, 10);

    if (responseCode === 1000) {
      const messageKey = result.messagekey || `ref-${refKeyValue}`;

      await logClient
        .from("sms_logs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          message_key: result.messagekey || null,
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
