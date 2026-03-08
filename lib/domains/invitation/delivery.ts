"use server";

/**
 * 통합 초대 발송 서비스
 *
 * 초대 생성 시 delivery_method에 따라 적절한 채널로 발송
 * - email: Resend (기존 emailService)
 * - sms: 뿌리오 SMS (기존 smsService)
 * - kakao: 뿌리오 카카오 알림톡 (TODO: 템플릿 등록 필요)
 * - manual/qr: 발송 없음 (링크 직접 공유)
 */

import { sendEmail } from "@/lib/services/emailService";
import { sendSMS } from "@/lib/services/smsService";
import { logActionError } from "@/lib/logging/actionLogger";
import type { Invitation } from "./types";

interface DeliveryResult {
  success: boolean;
  error?: string;
}

/**
 * 초대 발송 (delivery_method에 따라 분기)
 */
export async function deliverInvitation(
  invitation: Invitation,
  joinUrl: string
): Promise<DeliveryResult> {
  switch (invitation.deliveryMethod) {
    case "email":
      return deliverByEmail(invitation, joinUrl);
    case "sms":
      return deliverBySMS(invitation, joinUrl);
    case "kakao":
      return deliverByKakao(invitation, joinUrl);
    case "manual":
    case "qr":
      return { success: true }; // 발송 없음
    default:
      return { success: false, error: `지원하지 않는 발송 방식입니다: ${invitation.deliveryMethod}` };
  }
}

// ============================================
// 이메일 발송
// ============================================

async function deliverByEmail(
  invitation: Invitation,
  joinUrl: string
): Promise<DeliveryResult> {
  if (!invitation.email) {
    return { success: false, error: "이메일 주소가 없습니다." };
  }

  const roleLabel = getRoleLabel(invitation.targetRole);
  const tenantName = invitation.tenantName || "TimeLevelUp";
  const studentName = invitation.studentName;

  // 역할에 따라 제목과 내용을 다르게
  const isTeamRole = invitation.targetRole === "admin" || invitation.targetRole === "consultant";

  const subject = isTeamRole
    ? `[TimeLevelUp] ${tenantName}에 ${roleLabel}로 초대되었습니다`
    : `[TimeLevelUp] ${studentName || "학생"}의 ${roleLabel} 초대`;

  const description = isTeamRole
    ? `<strong>${escapeHtml(tenantName)}</strong>에서 <strong>${roleLabel}</strong>로 초대했습니다.`
    : studentName
      ? `<strong>${escapeHtml(studentName)}</strong> 학생의 <strong>${roleLabel}</strong>로 초대되었습니다.`
      : `<strong>${roleLabel}</strong>로 초대되었습니다.`;

  const expiresDate = new Date(invitation.expiresAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = generateInvitationEmailHtml({
    tenantName,
    description,
    joinUrl,
    expiresDate,
    roleLabel,
  });

  const result = await sendEmail({
    to: invitation.email,
    subject,
    html,
  });

  if (!result.success) {
    logActionError(
      { domain: "invitation", action: "deliverByEmail" },
      new Error(result.error || "이메일 발송 실패"),
      { invitationId: invitation.id, email: invitation.email }
    );
  }

  return { success: result.success, error: result.error };
}

// ============================================
// SMS 발송
// ============================================

async function deliverBySMS(
  invitation: Invitation,
  joinUrl: string
): Promise<DeliveryResult> {
  if (!invitation.phone) {
    return { success: false, error: "전화번호가 없습니다." };
  }

  const tenantName = invitation.tenantName || "TimeLevelUp";
  const roleLabel = getRoleLabel(invitation.targetRole);
  const studentName = invitation.studentName;

  // SMS 메시지 구성 (90바이트 이내면 SMS, 초과하면 자동 LMS)
  let message: string;

  if (invitation.targetRole === "admin" || invitation.targetRole === "consultant") {
    message = `[${tenantName}] ${roleLabel}로 초대되었습니다.\n아래 링크를 눌러 가입해주세요.\n${joinUrl}`;
  } else if (studentName) {
    message = `[${tenantName}] ${studentName} 학생의 ${roleLabel} 초대입니다.\n아래 링크를 눌러 가입해주세요.\n${joinUrl}`;
  } else {
    message = `[${tenantName}] ${roleLabel}로 초대되었습니다.\n아래 링크를 눌러 가입해주세요.\n${joinUrl}`;
  }

  const result = await sendSMS({
    recipientPhone: invitation.phone,
    message,
    tenantId: invitation.tenantId,
  });

  if (!result.success) {
    logActionError(
      { domain: "invitation", action: "deliverBySMS" },
      new Error(result.error || "SMS 발송 실패"),
      { invitationId: invitation.id, phone: invitation.phone }
    );
  }

  return { success: result.success, error: result.error };
}

// ============================================
// 카카오 알림톡 발송 (준비 중)
// ============================================

async function deliverByKakao(
  invitation: Invitation,
  joinUrl: string
): Promise<DeliveryResult> {
  // 카카오 알림톡은 템플릿 등록이 필요 (1~2 영업일 소요)
  // 우선 SMS로 fallback
  console.warn("[deliverByKakao] 카카오 알림톡 미구현, SMS로 fallback");
  return deliverBySMS(invitation, joinUrl);
}

// ============================================
// Helpers
// ============================================

function getRoleLabel(role: string): string {
  switch (role) {
    case "admin": return "관리자";
    case "consultant": return "컨설턴트";
    case "student": return "학생";
    case "parent": return "학부모";
    default: return role;
  }
}

function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return str.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

function generateInvitationEmailHtml(params: {
  tenantName: string;
  description: string;
  joinUrl: string;
  expiresDate: string;
  roleLabel: string;
}): string {
  const { tenantName, description, joinUrl, expiresDate, roleLabel } = params;

  const safeJoinUrl = escapeHtml(joinUrl);
  const safeExpiresDate = escapeHtml(expiresDate);

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 auto;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">TimeLevelUp</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b;">
                초대 안내
              </h2>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                ${description}
              </p>
              <a href="${safeJoinUrl}" style="display: inline-block; padding: 14px 28px; background-color: #2563eb; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                초대 수락하기
              </a>
              <p style="margin: 24px 0 0; font-size: 14px; color: #71717a;">
                이 초대는 <strong>${safeExpiresDate}</strong>까지 유효합니다.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #fafafa; border-top: 1px solid #e4e4e7; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 13px; color: #71717a; text-align: center;">
                본 메일은 발신 전용입니다. 문의사항은 관리자에게 연락해주세요.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
