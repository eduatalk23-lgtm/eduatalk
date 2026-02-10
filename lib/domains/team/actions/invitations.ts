"use server";

/**
 * 팀 초대 Server Actions
 *
 * - createTeamInvitation: 초대 생성 및 이메일 발송 (Resend 사용)
 * - cancelInvitation: 초대 취소
 * - resendInvitation: 초대 이메일 재발송
 * - acceptInvitation: 초대 수락 (역할 부여)
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { sendEmail } from "@/lib/services/emailService";
import { env } from "@/lib/env";
import type {
  CreateInvitationInput,
  CreateInvitationResult,
  AcceptInvitationInput,
  AcceptInvitationResult,
  SignUpAndAcceptInput,
  SignUpAndAcceptResult,
  InvitationRole,
} from "../types";

/**
 * 팀 초대 생성 및 이메일 발송
 */
export const createTeamInvitation = withErrorHandling(
  async (input: CreateInvitationInput): Promise<CreateInvitationResult> => {
    // 1. 권한 검증: admin 또는 superadmin만 가능
    const { userId, role: currentRole, tenantId } = await requireAdmin();

    // 일반 Admin은 tenant 필요
    if (currentRole === "admin" && !tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const { email, role } = input;

    // 2. 입력 검증
    if (!email || !role) {
      throw new AppError(
        "이메일과 역할을 입력해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (!["admin", "consultant"].includes(role)) {
      throw new AppError(
        "올바른 역할을 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // Non-owner admin은 consultant만 초대 가능
    if (currentRole === "admin" && role === "admin") {
      const supabaseForOwnerCheck = await createSupabaseServerClient();
      const { data: currentUser } = await supabaseForOwnerCheck
        .from("admin_users")
        .select("is_owner")
        .eq("id", userId)
        .single();

      if (!currentUser?.is_owner) {
        throw new AppError(
          "관리자 역할로 초대할 권한이 없습니다. 대표 관리자만 관리자를 초대할 수 있습니다.",
          ErrorCode.FORBIDDEN,
          403,
          true
        );
      }
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError(
        "올바른 이메일 형식이 아닙니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const supabase = await createSupabaseServerClient();
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      throw new AppError(
        "관리자 클라이언트를 초기화할 수 없습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    // 3. 이미 팀원인지 확인 (auth.users에서 이메일로 직접 조회)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingUser } = await (adminClient as any)
      .schema("auth")
      .from("users")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      const { data: existingMember } = await supabase
        .from("admin_users")
        .select("id, role")
        .eq("id", existingUser.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existingMember) {
        throw new AppError(
          "이미 팀원으로 등록된 사용자입니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
    }

    // 4. 중복 초대 확인
    const { data: existingInvite } = await supabase
      .from("team_invitations")
      .select("id, expires_at")
      .eq("tenant_id", tenantId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      throw new AppError(
        "이미 초대가 발송된 이메일입니다. 재발송하려면 기존 초대를 취소하거나 재발송 기능을 이용해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 5. 테넌트 이름 조회
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .single();

    // 6. 초대 생성 (DB 기록)
    const { data: invitation, error: insertError } = await supabase
      .from("team_invitations")
      .insert({
        tenant_id: tenantId!,
        email,
        role,
        invited_by: userId,
      })
      .select()
      .single();

    if (insertError || !invitation) {
      throw new AppError(
        "초대 생성에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: insertError?.message }
      );
    }

    // 7. Resend로 초대 이메일 발송
    const baseUrl = env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_VERCEL_URL || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/invite/${invitation.token}`;
    const roleLabel = role === "admin" ? "관리자" : "컨설턴트";
    const tenantName = tenant?.name || "팀";

    const emailResult = await sendEmail({
      to: email,
      subject: `[TimeLevelUp] ${tenantName}에 ${roleLabel}로 초대되었습니다`,
      html: generateInviteEmailHtml({
        tenantName,
        role: roleLabel,
        inviteUrl,
        expiresAt: invitation.expires_at,
      }),
    });

    // 이메일 발송 결과 처리
    const emailSent = emailResult.success;
    const emailError = emailResult.error;

    if (emailSent) {
      console.log("[createTeamInvitation] 초대 이메일 발송 성공:", email);
    } else {
      console.error("[createTeamInvitation] 초대 이메일 발송 실패:", emailError);
      console.log("[createTeamInvitation] 초대 링크:", inviteUrl);
    }

    return {
      success: true,
      emailSent,
      emailError,
      invitation: {
        id: invitation.id,
        tenantId: invitation.tenant_id,
        email: invitation.email,
        role: invitation.role as InvitationRole,
        status: invitation.status as "pending",
        token: invitation.token,
        invitedBy: invitation.invited_by,
        expiresAt: invitation.expires_at,
        acceptedAt: invitation.accepted_at,
        acceptedBy: invitation.accepted_by,
        createdAt: invitation.created_at,
      },
    };
  }
);

/**
 * 초대 취소
 */
export const cancelInvitation = withErrorHandling(
  async (invitationId: string): Promise<{ success: boolean; error?: string }> => {
    const { tenantId } = await requireAdmin();

    if (!tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("team_invitations")
      .update({ status: "cancelled" })
      .eq("id", invitationId)
      .eq("tenant_id", tenantId)
      .eq("status", "pending");

    if (error) {
      throw new AppError(
        "초대 취소에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: error.message }
      );
    }

    return { success: true };
  }
);

/**
 * 초대 이메일 재발송 (Resend 사용)
 */
export const resendInvitation = withErrorHandling(
  async (invitationId: string): Promise<{ success: boolean; error?: string }> => {
    const { tenantId } = await requireAdmin();

    if (!tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    // 초대 정보 조회
    const { data: invitation, error: fetchError } = await supabase
      .from("team_invitations")
      .select("*, tenants(name)")
      .eq("id", invitationId)
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .single();

    if (fetchError || !invitation) {
      throw new AppError(
        "초대를 찾을 수 없거나 이미 처리된 초대입니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 만료 시간 갱신 (7일 연장)
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    const { error: updateError } = await supabase
      .from("team_invitations")
      .update({ expires_at: newExpiresAt.toISOString() })
      .eq("id", invitationId);

    if (updateError) {
      throw new AppError(
        "초대 정보 갱신에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    // Resend로 초대 이메일 재발송
    const baseUrl = env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_VERCEL_URL || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/invite/${invitation.token}`;
    const roleLabel = invitation.role === "admin" ? "관리자" : "컨설턴트";
    const tenantName = (invitation.tenants as { name: string } | null)?.name || "팀";

    const emailResult = await sendEmail({
      to: invitation.email,
      subject: `[TimeLevelUp] ${tenantName}에 ${roleLabel}로 초대되었습니다 (재발송)`,
      html: generateInviteEmailHtml({
        tenantName,
        role: roleLabel,
        inviteUrl,
        expiresAt: newExpiresAt.toISOString(),
      }),
    });

    if (!emailResult.success) {
      throw new AppError(
        "이메일 발송에 실패했습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true,
        { originalError: emailResult.error }
      );
    }

    return { success: true };
  }
);

/**
 * 회원가입과 동시에 초대 수락
 * - 새 계정 생성
 * - admin_users에 역할 부여
 * - 초대 상태 업데이트
 */
export const signUpAndAcceptInvitation = withErrorHandling(
  async (input: SignUpAndAcceptInput): Promise<SignUpAndAcceptResult> => {
    const { token, email, password, name } = input;

    // 입력 검증
    if (!token || !email || !password || !name) {
      throw new AppError(
        "모든 필드를 입력해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (password.length < 6) {
      throw new AppError(
        "비밀번호는 6자 이상이어야 합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // UUID 형식 검증
    if (!isValidUUID(token)) {
      throw new AppError(
        "유효하지 않은 초대 토큰입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      throw new AppError(
        "서버 오류가 발생했습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    // 초대 정보 조회
    const { data: invitation, error: fetchError } = await adminClient
      .from("team_invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (fetchError || !invitation) {
      throw new AppError(
        "유효하지 않거나 만료된 초대입니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 만료 확인
    if (new Date(invitation.expires_at) < new Date()) {
      await adminClient
        .from("team_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);

      throw new AppError(
        "초대가 만료되었습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 이메일 일치 확인
    if (email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new AppError(
        "초대받은 이메일 주소와 일치하지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // Supabase Auth로 회원가입
    const { data: authData, error: signUpError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 이메일 인증 건너뛰기 (초대를 통한 가입이므로)
      user_metadata: {
        display_name: name,
        name: name,
      },
    });

    if (signUpError || !authData.user) {
      // 이미 존재하는 이메일인 경우
      if (signUpError?.message?.includes("already") || signUpError?.message?.includes("exists")) {
        throw new AppError(
          "이미 가입된 이메일입니다. 로그인해주세요.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
      throw new AppError(
        signUpError?.message || "회원가입에 실패했습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    const userId = authData.user.id;

    // admin_users에 역할 부여
    const { error: insertError } = await adminClient.from("admin_users").insert({
      id: userId,
      role: invitation.role,
      tenant_id: invitation.tenant_id,
      name: name,
    });

    if (insertError) {
      // 롤백: 생성된 사용자 삭제
      await adminClient.auth.admin.deleteUser(userId);
      throw new AppError(
        "팀원 등록에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    // 초대 상태 업데이트
    await adminClient
      .from("team_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: userId,
      })
      .eq("id", invitation.id);

    // 자동 로그인 (세션 설정)
    const supabase = await createSupabaseServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // 로그인 실패해도 회원가입은 완료됨 - 로그인 페이지로 안내
      console.warn("[signUpAndAcceptInvitation] 자동 로그인 실패:", signInError.message);
      return {
        success: true,
        redirectTo: `/login?message=${encodeURIComponent("회원가입이 완료되었습니다. 로그인해주세요.")}`,
      };
    }

    // 자동 로그인 성공 - 대시보드로 이동
    return {
      success: true,
      redirectTo: "/admin/dashboard",
    };
  }
);

/**
 * 초대 수락 (토큰 기반)
 * - 이미 계정이 있는 경우: admin_users에 역할 부여
 * - 계정이 없는 경우: 회원가입 페이지로 안내 (토큰 유지)
 */
export const acceptInvitation = withErrorHandling(
  async (input: AcceptInvitationInput): Promise<AcceptInvitationResult> => {
    const { token } = input;

    if (!token) {
      throw new AppError(
        "초대 토큰이 필요합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // UUID 형식 검증
    if (!isValidUUID(token)) {
      throw new AppError(
        "유효하지 않은 초대 토큰 형식입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // Admin 클라이언트로 토큰 기반 조회 (RLS 우회)
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      throw new AppError(
        "관리자 클라이언트를 초기화할 수 없습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    // 초대 정보 조회
    const { data: invitation, error: fetchError } = await adminClient
      .from("team_invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (fetchError || !invitation) {
      throw new AppError(
        "유효하지 않거나 만료된 초대입니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 만료 확인
    if (new Date(invitation.expires_at) < new Date()) {
      // 만료 상태로 업데이트
      await adminClient
        .from("team_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);

      throw new AppError(
        "초대가 만료되었습니다. 관리자에게 다시 초대를 요청해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 현재 로그인한 사용자 확인
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // 로그인되지 않은 경우 - 로그인/회원가입 페이지로 안내
      return {
        success: false,
        error: "로그인이 필요합니다.",
        redirectTo: `/login?redirect=/invite/${token}`,
      };
    }

    // 이메일 일치 확인 (선택적 - 다른 계정으로 수락 허용 여부)
    // 현재는 이메일이 달라도 수락 가능하게 설정
    // if (user.email !== invitation.email) {
    //   throw new AppError(
    //     "초대받은 이메일과 현재 로그인한 계정이 다릅니다.",
    //     ErrorCode.VALIDATION_ERROR,
    //     400,
    //     true
    //   );
    // }

    // 이미 해당 테넌트의 팀원인지 확인
    const { data: existingMember } = await adminClient
      .from("admin_users")
      .select("id, role")
      .eq("id", user.id)
      .eq("tenant_id", invitation.tenant_id)
      .maybeSingle();

    if (existingMember) {
      // 이미 팀원인 경우 초대 수락 처리만 하고 완료
      await adminClient
        .from("team_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          accepted_by: user.id,
        })
        .eq("id", invitation.id);

      return {
        success: true,
        redirectTo: "/admin/dashboard",
      };
    }

    // 사용자 이름 결정 (user_metadata > email 앞부분)
    const userName =
      user.user_metadata?.display_name ||
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "사용자";

    // admin_users에 역할 부여
    const { error: insertError } = await adminClient.from("admin_users").insert({
      id: user.id,
      role: invitation.role,
      tenant_id: invitation.tenant_id,
      name: userName,
    });

    if (insertError) {
      throw new AppError(
        "팀원 등록에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: insertError.message }
      );
    }

    // 초대 상태 업데이트
    await adminClient
      .from("team_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
      })
      .eq("id", invitation.id);

    return {
      success: true,
      redirectTo: "/admin/dashboard",
    };
  }
);

/**
 * 토큰으로 초대 정보 조회 (공개 - 초대 수락 페이지용)
 */
export async function getInvitationByToken(token: string) {
  // UUID 형식 검증 - 잘못된 형식이면 조기 반환
  if (!token || !isValidUUID(token)) {
    return null;
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return null;
  }

  const { data: invitation } = await adminClient
    .from("team_invitations")
    .select("id, email, role, status, expires_at, tenant_id, tenants(name)")
    .eq("token", token)
    .single();

  if (!invitation) {
    return null;
  }

  // 만료 여부 확인
  const isExpired = new Date(invitation.expires_at) < new Date();
  const isValid = invitation.status === "pending" && !isExpired;

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role as InvitationRole,
    status: invitation.status,
    tenantId: invitation.tenant_id,
    tenantName: (invitation.tenants as { name: string } | null)?.name || null,
    expiresAt: invitation.expires_at,
    isValid,
    isExpired,
  };
}

/**
 * UUID v4 형식 검증
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * HTML 특수문자 이스케이프 (XSS 방지)
 */
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

/**
 * 초대 이메일 HTML 생성
 */
function generateInviteEmailHtml(params: {
  tenantName: string;
  role: string;
  inviteUrl: string;
  expiresAt: string;
}): string {
  const { tenantName, role, inviteUrl, expiresAt } = params;
  const expiresDate = new Date(expiresAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // XSS 방지를 위해 모든 동적 값 이스케이프
  const safeTenantName = escapeHtml(tenantName);
  const safeRole = escapeHtml(role);
  const safeInviteUrl = escapeHtml(inviteUrl);
  const safeExpiresDate = escapeHtml(expiresDate);

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 auto;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">TimeLevelUp</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b;">
                팀 초대 안내
              </h2>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                <strong>${safeTenantName}</strong>에서 <strong>${safeRole}</strong>로 초대했습니다.
              </p>

              <a href="${safeInviteUrl}" style="display: inline-block; padding: 14px 28px; background-color: #2563eb; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                초대 수락하기
              </a>

              <p style="margin: 24px 0 0; font-size: 14px; color: #71717a;">
                이 초대는 <strong>${safeExpiresDate}</strong>까지 유효합니다.
              </p>
            </td>
          </tr>

          <!-- Footer -->
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
</html>
  `.trim();
}

