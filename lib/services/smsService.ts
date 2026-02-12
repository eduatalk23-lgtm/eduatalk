/**
 * SMS 발송 서비스
 * 뿌리오 API를 활용한 문자 발송 기능
 * API 문서: https://www.ppurio.com/send-api/develop
 */

import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { proxyFetch } from "@/lib/services/proxyFetch";

export interface SendSMSOptions {
  recipientPhone: string;
  message: string;
  recipientId?: string;
  tenantId: string;
  templateId?: string;
  refKey?: string; // 고객사에서 부여한 키
  sendTime?: string; // 예약 발송 시간 (yyyy-MM-ddTHH:mm:ss)
}

interface TokenResponse {
  token: string;
  type: string;
  expired: number; // Unix timestamp
}

interface MessageResponse {
  code: number | string; // 뿌리오 API는 문자열로 반환할 수 있음
  description: string;
  refKey?: string;
  messageKey?: string;
}

interface ErrorResponse {
  code: number | string; // 뿌리오 API는 문자열로 반환할 수 있음
  description: string;
}

// 토큰 캐시 (메모리)
let tokenCache: {
  token: string;
  expiresAt: number;
} | null = null;

/**
 * Base64 인코딩
 */
export function base64Encode(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str).toString("base64");
  }
  // 브라우저 환경 (일반적으로 서버에서만 사용)
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * 뿌리오 API 엑세스 토큰 발급
 * Basic Authentication 사용 (계정:뿌리오 개발 인증키)
 */
async function getAccessToken(): Promise<string> {
  // 캐시된 토큰이 있고 아직 유효한 경우 재사용
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const account = env.PPURIO_ACCOUNT;
  const authKey = env.PPURIO_AUTH_KEY;
  const baseUrl = env.PPURIO_API_BASE_URL || "https://message.ppurio.com";

  if (!account || !authKey) {
    throw new Error(
      "뿌리오 계정(PPURIO_ACCOUNT) 및 인증키(PPURIO_AUTH_KEY)가 설정되지 않았습니다."
    );
  }

  // Basic Authentication: 계정:인증키를 Base64 인코딩
  const credentials = base64Encode(`${account}:${authKey}`);
  const tokenEndpoint = `${baseUrl}/v1/token`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

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
      let errorMessage = `토큰 발급 실패: ${response.status}`;

      try {
        const errorJson: ErrorResponse = JSON.parse(errorText);
        errorMessage = errorJson.description || errorMessage;
      } catch {
        errorMessage = `${errorMessage} - ${errorText}`;
      }

      // 에러 코드별 처리
      const errorCodeMessages: Record<number, string> = {
        3001: "Authorization 헤더가 유효하지 않습니다.",
        3003: "아이피가 유효하지 않습니다.",
        3004: "계정이 유효하지 않습니다.",
        3007: "엑세스 토큰 발행 실패",
        4004: "API 접근 권한이 비활성화 상태입니다.",
        4006: "인증키가 유효하지 않습니다.",
        4007: "인증키를 발행 받지 않았습니다.",
      };

      const errorJson: ErrorResponse | null = (() => {
        try {
          return JSON.parse(errorText);
        } catch {
          return null;
        }
      })();

      if (errorJson) {
        // code를 숫자로 변환 (문자열일 수 있음)
        const parsedCode = typeof errorJson.code === "string" 
          ? parseInt(errorJson.code, 10) 
          : errorJson.code;
        if (errorCodeMessages[parsedCode]) {
          errorMessage = errorCodeMessages[parsedCode];
        }
      }

      throw new Error(errorMessage);
    }

    const result: TokenResponse = await response.json();

    if (!result.token) {
      throw new Error("토큰 발급 응답에 토큰이 없습니다.");
    }

    // 토큰 캐싱 (유효기간 1일, 여유를 두고 23시간으로 설정)
    const expiresAt = result.expired
      ? result.expired * 1000 // Unix timestamp를 밀리초로 변환
      : Date.now() + 23 * 60 * 60 * 1000; // 23시간

    tokenCache = {
      token: result.token,
      expiresAt: expiresAt,
    };

    return result.token;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("토큰 발급 요청 시간이 초과되었습니다.");
    }
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw new Error(
      `토큰 발급 실패: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 전화번호 형식 검증 및 정규화
 * 한국 휴대폰 번호 형식: 010-1234-5678 또는 01012345678
 */
export function validateAndNormalizePhoneNumber(phone: string): {
  isValid: boolean;
  normalized: string;
  error?: string;
} {
  // 하이픈, 공백 제거
  const cleaned = phone.replace(/[-\s]/g, "");

  // 숫자만 남기기
  if (!/^\d+$/.test(cleaned)) {
    return {
      isValid: false,
      normalized: cleaned,
      error: "전화번호는 숫자만 입력 가능합니다.",
    };
  }

  // 한국 휴대폰 번호 형식 검증 (010, 011, 016, 017, 018, 019로 시작, 총 10-11자리)
  const mobilePattern = /^(010|011|016|017|018|019)\d{7,8}$/;
  if (!mobilePattern.test(cleaned)) {
    return {
      isValid: false,
      normalized: cleaned,
      error: "올바른 한국 휴대폰 번호 형식이 아닙니다. (예: 010-1234-5678)",
    };
  }

  return {
    isValid: true,
    normalized: cleaned,
  };
}

/**
 * 단일 SMS 발송 (재시도 로직 포함)
 */
export async function sendSMS(
  options: SendSMSOptions,
  retryCount = 0,
  maxRetries = 2
): Promise<{
  success: boolean;
  messageKey?: string;
  smsLogId?: string;
  error?: string;
}> {
  const {
    recipientPhone,
    message,
    recipientId,
    tenantId,
    templateId,
    refKey,
    sendTime,
  } = options;

  // 환경 변수 확인
  if (
    !env.PPURIO_ACCOUNT ||
    !env.PPURIO_AUTH_KEY ||
    !env.PPURIO_SENDER_NUMBER
  ) {
    return {
      success: false,
      error: "SMS 발송 설정이 완료되지 않았습니다. 관리자에게 문의하세요.",
    };
  }

  // 전화번호 검증 및 정규화
  const phoneValidation = validateAndNormalizePhoneNumber(recipientPhone);
  if (!phoneValidation.isValid) {
    return {
      success: false,
      error: phoneValidation.error || "전화번호 형식이 올바르지 않습니다.",
    };
  }

  const normalizedPhone = phoneValidation.normalized;

  // 1. SMS 로그 생성 (pending 상태) - 재시도가 아닌 경우에만
  // RLS 우회를 위해 Admin 클라이언트 사용 (SMS 로그는 시스템이 생성)
  const logClient = await getSupabaseClientForRLSBypass({
    forceAdmin: true,
    fallbackToServer: false, // Admin 클라이언트 필수
  });
  
  if (!logClient) {
    return {
      success: false,
      error: "시스템 오류: 로깅 클라이언트를 초기화할 수 없습니다.",
    };
  }

  let smsLog;

  const baseUrl = env.PPURIO_API_BASE_URL || "https://message.ppurio.com";
  const messageEndpoint = `${baseUrl}/v1/message`;

  if (retryCount === 0) {
    const { data: logData, error: logError } = await logClient
      .from("sms_logs")
      .insert({
        tenant_id: tenantId,
        recipient_id: recipientId,
        recipient_phone: normalizedPhone,
        message_content: message,
        template_id: templateId,
        status: "pending",
      })
      .select()
      .single();

    if (logError || !logData) {
      logActionError(
        { domain: "service", action: "sendSMS" },
        logError,
        { context: "로그 생성", recipientPhone: normalizedPhone }
      );
      return {
        success: false,
        error: "SMS 로그 생성에 실패했습니다.",
      };
    }
    smsLog = logData;
  } else {
    // 재시도인 경우 기존 로그 조회 (RLS 우회 필요)
    if (!logClient) {
    return { success: false, error: "로깅 클라이언트 초기화 실패" };
  }

  const { data: logData } = await logClient
      .from("sms_logs")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("recipient_phone", normalizedPhone)
      .eq("message_content", message)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!logData) {
      return {
        success: false,
        error: "기존 SMS 로그를 찾을 수 없습니다.",
      };
    }
    smsLog = logData;
  }

  try {
    // 2. 토큰 발급
    const accessToken = await getAccessToken();

    // 3. 메시지 발송 요청
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

    // 메시지 타입 결정 (SMS: 90byte 이하, LMS: 2000byte 이하)
    const messageBytes = new TextEncoder().encode(message).length;
    const messageType = messageBytes <= 90 ? "SMS" : "LMS";

    // refKey는 최대 32자로 제한 (문서: text(32))
    const refKeyValue = (refKey || smsLog.id).toString().slice(0, 32);

    const requestBody = {
      account: env.PPURIO_ACCOUNT,
      messageType: messageType,
      content: message,
      from: env.PPURIO_SENDER_NUMBER,
      duplicateFlag: "N", // 중복 제거
      targetCount: 1,
      targets: [
        {
          to: normalizedPhone,
        },
      ],
      refKey: refKeyValue,
      ...(sendTime && { sendTime }), // 예약 발송 시간
    };

    // 디버깅: 요청 본문 로깅 (개발 환경에서만)
    logActionDebug(
      { domain: "service", action: "sendSMS" },
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

    // 디버깅: 응답 로깅
    logActionDebug(
      { domain: "service", action: "sendSMS" },
      "API 응답",
      {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        body: responseText,
      }
    );

    // 응답 파싱
    let result: MessageResponse | ErrorResponse;
    try {
      result = JSON.parse(responseText);
    } catch {
      // JSON 파싱 실패는 HTTP 에러로 처리
      if (!response.ok) {
        throw new Error(`응답 파싱 실패 (HTTP ${response.status}): ${responseText}`);
      }
      throw new Error(`응답 파싱 실패: ${responseText}`);
    }

    // 뿌리오 API는 HTTP 200이어도 응답 본문에 에러 코드를 반환할 수 있음
    // 따라서 HTTP 상태 코드와 응답 본문의 code를 모두 확인해야 함

    // HTTP 에러 (4xx, 5xx)
    if (!response.ok) {
      const errorJson = result as ErrorResponse;
      // code를 숫자로 변환 (문자열일 수 있음)
      const errorCode = typeof errorJson.code === "string" 
        ? parseInt(errorJson.code, 10) 
        : errorJson.code;
      const errorMessage = errorJson.description || `API 요청 실패: ${response.status}`;

      // 에러 코드별 처리
      const errorCodeMessages: Record<number, string> = {
        2000: "잘못된 요청입니다.",
        3001: "Authorization 헤더가 유효하지 않습니다.",
        3002: "토큰이 유효하지 않습니다.",
        3003: "아이피가 유효하지 않습니다.",
        3004: "계정이 유효하지 않습니다.",
        3005: "토큰이 유효하지 않습니다.",
        3006: "Authentication Header가 유효하지 않습니다.",
        3008: "너무 많은 요청입니다.",
        4004: "API 접근 권한이 비활성화 상태입니다.",
        4006: "인증키가 유효하지 않습니다.",
        4007: "인증키를 발행 받지 않았습니다.",
      };

      const finalErrorMessage = errorCode && errorCodeMessages[errorCode]
        ? errorCodeMessages[errorCode]
        : errorMessage;

      // 재시도 불가능한 에러 코드 (클라이언트 에러: 2xxx, 3xxx, 4xxx)
      const nonRetryableErrorCodes = [
        2000, 2001, // 잘못된 요청
        3001, 3002, 3003, 3004, 3005, 3006, // 인증/권한 에러
        4004, 4006, 4007, // 설정 에러
      ];

      const error = new Error(finalErrorMessage) as Error & { code?: number; isRetryable?: boolean };
      error.code = errorCode || undefined;
      error.isRetryable = errorCode ? !nonRetryableErrorCodes.includes(errorCode) : false;
      
      throw error;
    }

    // HTTP 200 응답 처리
    const messageResponse = result as MessageResponse;

    // code를 숫자로 변환 (문자열 "1000"도 처리)
    const responseCode = typeof messageResponse.code === "string" 
      ? parseInt(messageResponse.code, 10) 
      : messageResponse.code;

    // 성공 응답 확인: code가 1000이면 성공
    if (responseCode === 1000) {
      // messageKey가 있으면 명시적으로 성공
      // messageKey가 없어도 code가 1000이면 성공으로 간주 (일부 API는 messageKey를 반환하지 않을 수 있음)
      const messageKey = messageResponse.messageKey || `ref-${refKeyValue}`;

      await logClient
        .from("sms_logs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          message_key: messageResponse.messageKey || null,
          ref_key: refKeyValue || null,
        })
        .eq("id", smsLog.id);

      logActionDebug(
        { domain: "service", action: "sendSMS" },
        "발송 성공",
        {
          phone: normalizedPhone,
          messageKey,
          code: messageResponse.code,
          description: messageResponse.description,
        }
      );

      return {
        success: true,
        messageKey: messageKey,
        smsLogId: smsLog.id,
      };
    }

    // HTTP 200이지만 응답 본문에 에러 코드가 있는 경우
    // (뿌리오 API는 HTTP 200이어도 code: 2000 같은 에러를 반환할 수 있음)
    const errorMessage = messageResponse.description || "SMS 발송에 실패했습니다.";
    const errorCode = responseCode;

    logActionDebug(
      { domain: "service", action: "sendSMS" },
      "발송 실패 (HTTP 200이지만 에러 코드)",
      {
        phone: normalizedPhone,
        code: errorCode,
        originalCode: messageResponse.code,
        description: errorMessage,
      }
    );

    await logClient
      .from("sms_logs")
      .update({
        status: "failed",
        error_message: errorMessage,
      })
      .eq("id", smsLog.id);

    // 재시도 가능한 에러인지 확인 (5xx 서버 에러, Rate limit만 재시도)
    const isRetryable = errorCode && (errorCode >= 500 || errorCode === 3008);

    if (isRetryable && retryCount < maxRetries) {
      // 지수 백오프: 1초, 2초, 4초...
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));

      logActionDebug(
        { domain: "service", action: "sendSMS" },
        `재시도 ${retryCount + 1}/${maxRetries}`,
        { phone: normalizedPhone, errorCode }
      );
      return sendSMS(options, retryCount + 1, maxRetries);
    }

    return {
      success: false,
      error: errorMessage,
    };
  } catch (error: unknown) {
    // 5. 에러 처리
    let errorMessage = "알 수 없는 오류가 발생했습니다.";
    let errorDetails: Record<string, unknown> = {};

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        errorMessage =
          "요청 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.";
        errorDetails = {
          type: "timeout",
          timeout: 10000,
        };
      } else if (
        error.message.includes("fetch") ||
        error.message === "fetch failed"
      ) {
        // DNS 조회 실패 확인
        const isDnsError =
          error.cause &&
          typeof error.cause === "object" &&
          "code" in error.cause &&
          (error.cause.code === "ENOTFOUND" ||
            error.cause.code === "EAI_AGAIN");

        if (isDnsError) {
          const cause = error.cause as
            | { code?: string; hostname?: string }
            | undefined;
          const hostname = cause?.hostname || "unknown";
          const code = cause?.code || "ENOTFOUND";
          errorMessage = `DNS 조회 실패: '${hostname}' 도메인을 찾을 수 없습니다. API 엔드포인트 URL을 확인해주세요.`;
          errorDetails = {
            type: "dns_error",
            endpoint: messageEndpoint,
            hostname: hostname,
            code: code,
            message: error.message,
            hint: "뿌리오 API 문서에서 올바른 엔드포인트를 확인하거나, 기본값(https://message.ppurio.com)을 사용해보세요.",
          };
        } else {
          errorMessage =
            "네트워크 연결에 실패했습니다. 인터넷 연결 및 API 엔드포인트를 확인해주세요.";
          errorDetails = {
            type: "network_error",
            endpoint: messageEndpoint,
            cause: error.cause || "unknown",
            message: error.message,
          };
        }
      } else {
        errorMessage = error.message;
        errorDetails = {
          type: "unknown",
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      }
    } else {
      errorDetails = {
        type: "non_error_object",
        value: String(error),
      };
    }

    await logClient
      .from("sms_logs")
      .update({
        status: "failed",
        error_message: errorMessage,
      })
      .eq("id", smsLog.id);

    // 상세 에러 로그 출력
    const getHint = () => {
      if (errorDetails.type === "dns_error") {
        return `DNS 조회 실패: '${errorDetails.hostname}' 도메인을 찾을 수 없습니다. 뿌리오 API 문서에서 올바른 엔드포인트를 확인하거나, 기본값(https://message.ppurio.com)을 사용해보세요.`;
      } else if (errorDetails.type === "network_error") {
        return "API 엔드포인트 URL, 네트워크 연결, 방화벽 설정을 확인하세요.";
      } else if (errorDetails.type === "timeout") {
        return "요청 시간이 초과되었습니다. 네트워크 연결을 확인하거나 타임아웃 시간을 늘려보세요.";
      }
      return undefined;
    };

    logActionError(
      { domain: "service", action: "sendSMS" },
      error,
      {
        phone: normalizedPhone,
        retryCount,
        endpoint: messageEndpoint,
        details: errorDetails,
        hint: getHint(),
      }
    );

    // 재시도 가능한 에러인지 확인
    const errorWithCode = error as Error & { code?: number; isRetryable?: boolean };
    
    // 명시적으로 재시도 불가능으로 표시된 경우 제외
    if (errorWithCode.isRetryable === false) {
      return {
        success: false,
        error: errorMessage,
      };
    }

    // 재시도 불가능한 에러 코드 (클라이언트 에러)
    const nonRetryableErrorCodes = [
      2000, 2001, // 잘못된 요청
      3001, 3002, 3003, 3004, 3005, 3006, // 인증/권한 에러
      4004, 4006, 4007, // 설정 에러
    ];

    if (errorWithCode.code && nonRetryableErrorCodes.includes(errorWithCode.code)) {
      return {
        success: false,
        error: errorMessage,
      };
    }

    // 네트워크 에러, 타임아웃, 토큰 에러만 재시도
    const isRetryable =
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.message.includes("fetch") ||
        error.message.includes("network") ||
        error.message.includes("토큰") ||
        error.message.includes("시간이 초과"));

    if (isRetryable && retryCount < maxRetries) {
      // 토큰 관련 에러인 경우 토큰 캐시 초기화
      if (error.message.includes("토큰")) {
        tokenCache = null;
      }

      // 지수 백오프
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));

      logActionDebug(
        { domain: "service", action: "sendSMS" },
        `재시도 ${retryCount + 1}/${maxRetries}`,
        { phone: normalizedPhone, errorMessage: error.message }
      );
      return sendSMS(options, retryCount + 1, maxRetries);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 예약발송 취소
 */
export async function cancelScheduledMessage(
  messageKey: string,
  tenantId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!env.PPURIO_ACCOUNT || !env.PPURIO_AUTH_KEY) {
    return {
      success: false,
      error: "SMS 발송 설정이 완료되지 않았습니다.",
    };
  }

  const baseUrl = env.PPURIO_API_BASE_URL || "https://message.ppurio.com";
  const cancelEndpoint = `${baseUrl}/v1/cancel`;

  try {
    // 토큰 발급
    const accessToken = await getAccessToken();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await proxyFetch(cancelEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account: env.PPURIO_ACCOUNT,
        messageKey: messageKey,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `예약 취소 실패: ${response.status}`;

      try {
        const errorJson: ErrorResponse = JSON.parse(errorText);
        errorMessage = errorJson.description || errorMessage;

        // 에러 코드별 처리
        const errorCodeMessages: Record<number, string> = {
          2000: "잘못된 요청입니다.",
          2001: "잘못된 URL입니다.",
          3002: "토큰이 유효하지 않습니다.",
          3003: "아이피가 유효하지 않습니다.",
          3004: "계정이 유효하지 않습니다.",
          3005: "인증 정보가 유효하지 않습니다.",
          3006: "Authentication Header가 유효하지 않습니다.",
          3008: "너무 많은 요청입니다.",
          4004: "API 접근 권한이 비활성화 상태입니다.",
          4006: "인증키가 유효하지 않습니다.",
          4007: "인증키를 발행 받지 않았습니다.",
          4009: "메시지키가 유효하지 않습니다.",
          4010: "예약 취소 가능 시간이 지났습니다.",
          4011: "메시지가 이미 발송중인 상태입니다.",
          4012: "예약을 취소할 수 없습니다.",
        };

        // code를 숫자로 변환 (문자열일 수 있음)
        const parsedCode = typeof errorJson.code === "string" 
          ? parseInt(errorJson.code, 10) 
          : errorJson.code;
        if (errorCodeMessages[parsedCode]) {
          errorMessage = errorCodeMessages[parsedCode];
        }
      } catch {
        errorMessage = `${errorMessage} - ${errorText}`;
      }

      throw new Error(errorMessage);
    }

    const result: MessageResponse = await response.json();

    // code를 숫자로 변환 (문자열일 수 있음)
    const responseCode = typeof result.code === "string" 
      ? parseInt(result.code, 10) 
      : result.code;

    if (responseCode === 1000) {
      // SMS 로그 상태 업데이트 (RLS 우회 필요)
      const logClient = await getSupabaseClientForRLSBypass({
        forceAdmin: true,
        fallbackToServer: false,
      });
      if (logClient) {
        await logClient
          .from("sms_logs")
          .update({
            status: "failed",
            error_message: "예약 발송이 취소되었습니다.",
          })
          .eq("tenant_id", tenantId)
          .eq("status", "pending");
      }

      return { success: true };
    } else {
      return {
        success: false,
        error: result.description || "예약 취소에 실패했습니다.",
      };
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "예약 취소 중 오류가 발생했습니다.";
    logActionError(
      { domain: "service", action: "cancelScheduledMessage" },
      error,
      { messageKey }
    );
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


// ============================================================
// 뿌리오 POLLING - 발송 결과 조회
// ============================================================

/**
 * 뿌리오 발송 결과 보고서 항목
 */
export interface DeliveryReport {
  device: string;
  cmsgid: string;   // 고객사 메시지 ID (= ref_key)
  msgid: string;     // 뿌리오 메시지 ID (= message_key)
  phone: string;
  media: string;
  unixtime: string;
  result: string;    // "4100" = 성공
  userdata: string;
  wapinfo: string;
  refkey: string;
}

/**
 * 뿌리오 결과코드를 내부 상태로 매핑
 */
export function mapPpurioResultToStatus(resultCode: string): "delivered" | "failed" {
  return resultCode === "4100" ? "delivered" : "failed";
}

/**
 * 뿌리오 결과코드 한글 설명 매핑
 */
export const PPURIO_RESULT_DESCRIPTIONS: Record<string, string> = {
  "4100": "전달 성공",
  "4400": "음영지역",
  "4410": "전원 꺼짐",
  "4420": "수신 거부",
  "4430": "착신 정지",
  "4500": "전송 실패",
  "4510": "번호 오류",
  "4520": "서비스 불가 지역",
  "4530": "콘텐츠 에러",
  "4600": "스팸 차단",
};

/**
 * 뿌리오 POLLING - 발송 결과 요청
 * POST {baseUrl}/v1/result/request
 * 최대 1000건 배치 반환
 */
export async function fetchDeliveryResults(): Promise<DeliveryReport[]> {
  if (!env.PPURIO_ACCOUNT || !env.PPURIO_AUTH_KEY) {
    throw new Error(
      "SMS 발송 설정이 완료되지 않았습니다. (PPURIO_ACCOUNT, PPURIO_AUTH_KEY 확인)"
    );
  }

  const baseUrl = env.PPURIO_API_BASE_URL || "https://message.ppurio.com";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const accessToken = await getAccessToken();

    const response = await proxyFetch(`${baseUrl}/v1/result/request`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account: env.PPURIO_ACCOUNT,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`발송 결과 조회 실패 (HTTP ${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // 뿌리오 응답: 결과가 없으면 빈 배열 또는 빈 객체 반환 가능
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return [];
    }

    // 배열이 아닌 경우 (단일 결과를 객체로 반환할 수 있음)
    if (!Array.isArray(data)) {
      // data가 결과 목록을 포함하는 wrapper인 경우 처리
      if (data.results && Array.isArray(data.results)) {
        return data.results as DeliveryReport[];
      }
      // data 자체가 단일 결과인 경우
      if (data.msgid || data.cmsgid) {
        return [data as DeliveryReport];
      }
      return [];
    }

    return data as DeliveryReport[];
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("발송 결과 조회 요청 시간이 초과되었습니다.");
      }
      if (error.message === "fetch failed" || error.message.includes("fetch")) {
        throw new Error(
          `뿌리오 API 서버에 연결할 수 없습니다. 네트워크 연결 및 API 엔드포인트(${baseUrl})를 확인하세요.`
        );
      }
    }
    throw error;
  }
}

/**
 * 뿌리오 POLLING - 결과 수신 확인
 * POST {baseUrl}/v1/result/confirm
 * 수신 완료를 알리지 않으면 동일 결과가 재반환됨
 */
export async function confirmDeliveryResults(): Promise<void> {
  const baseUrl = env.PPURIO_API_BASE_URL || "https://message.ppurio.com";
  const accessToken = await getAccessToken();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await proxyFetch(`${baseUrl}/v1/result/confirm`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account: env.PPURIO_ACCOUNT,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      logActionError(
        { domain: "service", action: "confirmDeliveryResults" },
        new Error(`결과 확인 실패 (HTTP ${response.status}): ${errorText}`),
        {}
      );
    }
  } catch (error) {
    clearTimeout(timeoutId);
    logActionError(
      { domain: "service", action: "confirmDeliveryResults" },
      error,
      {}
    );
  }
}
