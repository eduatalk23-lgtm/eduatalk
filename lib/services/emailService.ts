/**
 * 이메일 발송 서비스 (Resend)
 */

import { Resend } from "resend";
import { env } from "@/lib/env";
import { render } from "@react-email/render";
import type { ReactElement } from "react";

// Resend 클라이언트 초기화 (API 키가 있을 때만)
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[emailService] RESEND_API_KEY가 설정되지 않았습니다. 이메일 발송 기능이 비활성화됩니다."
      );
    }
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }

  return resendClient;
}

export type EmailOptions = {
  to: string | string[];
  subject: string;
  from?: string;
  replyTo?: string;
  html?: string;
  react?: ReactElement;
  text?: string;
};

export type EmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

/**
 * 단일 이메일 발송
 */
export async function sendEmail(
  options: EmailOptions
): Promise<EmailResult> {
  const client = getResendClient();
  if (!client) {
    return {
      success: false,
      error: "이메일 서비스가 설정되지 않았습니다.",
    };
  }

  try {
    // React 컴포넌트가 있으면 HTML로 렌더링
    let html = options.html;
    if (options.react && !html) {
      html = await render(options.react);
    }

    // 발신 주소 설정 (기본값: 환경 변수 또는 noreply)
    const from = options.from || env.EMAIL_FROM || "noreply@example.com";
    const replyTo = options.replyTo || env.EMAIL_REPLY_TO;

    const { data, error } = await client.emails.send({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: html || options.text || "",
      text: options.text,
      reply_to: replyTo,
    });

    if (error) {
      console.error("[emailService] 이메일 발송 실패:", error);
      return {
        success: false,
        error: error.message || "이메일 발송에 실패했습니다.",
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[emailService] 이메일 발송 중 예외 발생:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 일괄 이메일 발송
 */
export async function sendBulkEmail(
  recipients: string[],
  options: Omit<EmailOptions, "to">
): Promise<{
  success: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ email: string; error: string }>,
  };

  // Resend는 일괄 발송을 지원하므로, 한 번에 여러 수신자에게 발송
  const client = getResendClient();
  if (!client) {
    return {
      success: 0,
      failed: recipients.length,
      errors: recipients.map((email) => ({
        email,
        error: "이메일 서비스가 설정되지 않았습니다.",
      })),
    };
  }

  try {
    // React 컴포넌트가 있으면 HTML로 렌더링
    let html = options.html;
    if (options.react && !html) {
      html = await render(options.react);
    }

    const from = options.from || env.EMAIL_FROM || "noreply@example.com";
    const replyTo = options.replyTo || env.EMAIL_REPLY_TO;

    // Resend는 최대 50명까지 일괄 발송 가능
    const batchSize = 50;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const { data, error } = await client.emails.send({
        from,
        to: batch,
        subject: options.subject,
        html: html || options.text || "",
        text: options.text,
        reply_to: replyTo,
      });

      if (error) {
        results.failed += batch.length;
        batch.forEach((email) => {
          results.errors.push({
            email,
            error: error.message || "이메일 발송에 실패했습니다.",
          });
        });
      } else {
        results.success += batch.length;
      }
    }

    return results;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[emailService] 일괄 이메일 발송 중 예외 발생:", errorMessage);

    return {
      success: 0,
      failed: recipients.length,
      errors: recipients.map((email) => ({
        email,
        error: errorMessage,
      })),
    };
  }
}

