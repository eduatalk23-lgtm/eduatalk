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
  msgId?: string;
  smsLogId?: string;
  error?: string;
}> {
  const { recipientPhone, message, recipientId, tenantId, templateId } =
    options;

  // 환경 변수 확인
  if (!env.PPURIO_USER_ID || !env.PPURIO_API_KEY || !env.PPURIO_SENDER_NUMBER) {
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
  const supabase = await createSupabaseServerClient();
  let smsLog;
  
  // API 엔드포인트 설정 (에러 로깅을 위해 try 블록 밖에서 선언)
  const apiEndpoint =
    env.PPURIO_API_ENDPOINT || "https://message.ppurio.com/v1/send";
  
  if (retryCount === 0) {
    const { data: logData, error: logError } = await supabase
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
      console.error("[SMS] 로그 생성 실패:", logError);
      return {
        success: false,
        error: "SMS 로그 생성에 실패했습니다.",
      };
    }
    smsLog = logData;
  } else {
    // 재시도인 경우 기존 로그 조회
    const { data: logData } = await supabase
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
    // 2. 뿌리오 API 호출
    // API 엔드포인트: 환경 변수로 설정 가능, 기본값은 https://message.ppurio.com/v1/send
    // 헤더: X-PPURIO-USER-ID, X-PPURIO-API-KEY

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PPURIO-USER-ID": env.PPURIO_USER_ID,
        "X-PPURIO-API-KEY": env.PPURIO_API_KEY,
      },
      body: JSON.stringify({
        phone: normalizedPhone,
        message: message,
        sender: env.PPURIO_SENDER_NUMBER,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API 요청 실패: ${response.status}`;

      // HTTP 상태 코드별 에러 메시지
      const statusMessages: Record<number, string> = {
        400: "잘못된 요청입니다. 요청 형식을 확인해주세요.",
        401: "인증에 실패했습니다. API 키를 확인해주세요.",
        403: "접근이 거부되었습니다. 권한을 확인해주세요.",
        404: `API 엔드포인트를 찾을 수 없습니다. (${apiEndpoint}) 엔드포인트 URL을 확인해주세요.`,
        429: "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
        500: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        503: "서비스를 일시적으로 사용할 수 없습니다.",
      };

      if (statusMessages[response.status]) {
        errorMessage = statusMessages[response.status];
      } else if (errorText) {
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          errorMessage = `${errorMessage} - ${errorText}`;
        }
      }

      // 404 에러인 경우 상세 로그 출력
      if (response.status === 404) {
        console.error("[SMS] API 엔드포인트 404 에러:", {
          endpoint: apiEndpoint,
          status: response.status,
          errorText,
          hint: "PPURIO_API_ENDPOINT 환경 변수를 확인하거나 뿌리오 API 문서를 참조하세요.",
        });
      }

      throw new Error(errorMessage);
    }

    const result: PPurioResponse = await response.json();

    // 3. 발송 결과 업데이트
    // 뿌리오 API 응답 코드: 200 (성공), 그 외 (실패)
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
      // API 에러 코드별 처리
      const errorMessages: Record<number, string> = {
        400: "잘못된 요청입니다.",
        401: "인증에 실패했습니다.",
        403: "접근이 거부되었습니다.",
        404: "리소스를 찾을 수 없습니다.",
        500: "서버 오류가 발생했습니다.",
      };

      const errorMessage =
        errorMessages[result.result_code] ||
        result.message ||
        "SMS 발송에 실패했습니다.";

      await supabase
        .from("sms_logs")
        .update({
          status: "failed",
          error_message: errorMessage,
        })
        .eq("id", smsLog.id);

      // 재시도 가능한 에러인지 확인 (5xx 서버 에러, 네트워크 에러)
      const isRetryable =
        result.result_code >= 500 || result.result_code === 429; // Rate limit

      if (isRetryable && retryCount < maxRetries) {
        // 지수 백오프: 1초, 2초, 4초...
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));

        console.log(
          `[SMS] 재시도 ${retryCount + 1}/${maxRetries} - ${normalizedPhone}`
        );
        return sendSMS(options, retryCount + 1, maxRetries);
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error: any) {
    // 4. 에러 처리
    let errorMessage = "알 수 없는 오류가 발생했습니다.";
    let errorDetails: Record<string, any> = {};

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        errorMessage =
          "요청 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.";
        errorDetails = {
          type: "timeout",
          timeout: 10000,
        };
      } else if (error.message.includes("fetch") || error.message === "fetch failed") {
        errorMessage =
          "네트워크 연결에 실패했습니다. 인터넷 연결 및 API 엔드포인트를 확인해주세요.";
        errorDetails = {
          type: "network_error",
          endpoint: apiEndpoint,
          cause: error.cause || "unknown",
          message: error.message,
        };
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

    await supabase
      .from("sms_logs")
      .update({
        status: "failed",
        error_message: errorMessage,
      })
      .eq("id", smsLog.id);

    // 상세 에러 로그 출력
    console.error("[SMS] 발송 실패:", {
      phone: normalizedPhone,
      error: error instanceof Error ? error.message : String(error),
      retryCount,
      endpoint: apiEndpoint,
      details: errorDetails,
      hint: errorDetails.type === "network_error" 
        ? "API 엔드포인트 URL, 네트워크 연결, 방화벽 설정을 확인하세요."
        : undefined,
    });

    // 네트워크 에러 등 재시도 가능한 에러인지 확인
    const isRetryable =
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.message.includes("fetch") ||
        error.message.includes("network"));

    if (isRetryable && retryCount < maxRetries) {
      // 지수 백오프
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));

      console.log(
        `[SMS] 재시도 ${retryCount + 1}/${maxRetries} - ${normalizedPhone}`
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
