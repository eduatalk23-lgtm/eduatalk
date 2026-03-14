"use server";

/**
 * 통합 초대 시스템 Server Actions
 *
 * - createInvitation: 초대 생성 (모든 역할 통합)
 * - validateInvitationByToken: 토큰으로 초대 검증
 * - validateInvitationByCode: 레거시 코드로 초대 검증
 * - acceptInvitation: 초대 수락 (역할별 분기 처리)
 * - cancelInvitation: 초대 취소
 * - resendInvitation: 초대 재발송
 * - getInvitationsByStudent: 학생별 초대 목록
 * - getTeamInvitations: 팀 초대 목록
 */

import { requireAdmin, requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionError, logActionSuccess } from "@/lib/logging/actionLogger";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { getBaseUrl } from "@/lib/utils/getBaseUrl";
import { revalidatePath } from "next/cache";
import { deliverInvitation } from "./delivery";
import { saveUserConsents } from "@/lib/data/userConsents";
import type { ConsentData } from "@/lib/types/auth";
import type {
  Invitation,
  InvitationRole,
  InvitationRelation,
  DeliveryMethod,
  CreateInvitationInput,
  CreateInvitationResult,
  ValidateInvitationResult,
  AcceptInvitationResult,
} from "./types";

// ============================================
// Helpers
// ============================================

function getDefaultExpiryDays(role: InvitationRole): number {
  return role === "admin" || role === "consultant" ? 7 : 30;
}

function getJoinUrl(token: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/join/${token}`;
}

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/** DB row → Invitation 타입 매핑 */
function mapRowToInvitation(row: Record<string, unknown>): Invitation {
  const tenant = row.tenants as { name: string } | null;
  const student = row.students as { name: string } | null;

  return {
    id: row.id as string,
    token: row.token as string,
    tenantId: row.tenant_id as string,
    tenantName: tenant?.name ?? null,
    targetRole: row.target_role as InvitationRole,
    email: row.email as string | null,
    phone: row.phone as string | null,
    studentId: row.student_id as string | null,
    studentName: student?.name ?? null,
    relation: row.relation as InvitationRelation | null,
    legacyCode: row.legacy_code as string | null,
    status: row.status as Invitation["status"],
    expiresAt: row.expires_at as string,
    deliveryMethod: row.delivery_method as DeliveryMethod,
    deliveryStatus: row.delivery_status as Invitation["deliveryStatus"],
    deliveredAt: row.delivered_at as string | null,
    invitedBy: row.invited_by as string,
    acceptedAt: row.accepted_at as string | null,
    acceptedBy: row.accepted_by as string | null,
    createdAt: row.created_at as string,
  };
}

const INVITATION_SELECT = `
  id, token, tenant_id, target_role, email, phone,
  student_id, relation, legacy_code, status, expires_at,
  delivery_method, delivery_status, delivered_at,
  invited_by, accepted_at, accepted_by, created_at,
  tenants:tenant_id(name),
  students:student_id(name)
`;

// ============================================
// 초대 생성
// ============================================

export async function createInvitation(
  input: CreateInvitationInput
): Promise<CreateInvitationResult> {
  const { targetRole, deliveryMethod, email, phone, studentId, relation, expiryDays } = input;

  // 역할별 권한 검증
  let tenantId: string | null;
  let userId: string;

  if (targetRole === "admin") {
    const auth = await requireAdmin();
    tenantId = auth.tenantId;
    userId = auth.userId;

    // admin 초대는 owner만 가능
    const supabase = await createSupabaseServerClient();
    const { data: currentUser } = await supabase
      .from("admin_users")
      .select("is_owner")
      .eq("id", userId)
      .single();

    if (auth.role === "admin" && !currentUser?.is_owner) {
      return { success: false, error: "관리자 역할로 초대할 권한이 없습니다. 대표 관리자만 가능합니다." };
    }
  } else if (targetRole === "consultant") {
    const auth = await requireAdmin();
    tenantId = auth.tenantId;
    userId = auth.userId;
  } else {
    // student, parent
    const auth = await requireAdminOrConsultant();
    tenantId = auth.tenantId;
    userId = auth.userId;
  }

  if (!userId) {
    return { success: false, error: "사용자 정보를 찾을 수 없습니다." };
  }

  if (!tenantId) {
    return { success: false, error: "기관 정보를 찾을 수 없습니다." };
  }

  // 입력 검증
  if ((targetRole === "admin" || targetRole === "consultant") && deliveryMethod === "email" && !email) {
    return { success: false, error: "이메일 주소를 입력해주세요." };
  }

  if ((targetRole === "student" || targetRole === "parent") && !studentId) {
    return { success: false, error: "학생을 선택해주세요." };
  }

  if (deliveryMethod === "sms" && !phone) {
    return { success: false, error: "전화번호를 입력해주세요." };
  }

  // 이메일 중복 초대 확인 (admin/consultant만)
  if (email && (targetRole === "admin" || targetRole === "consultant")) {
    const supabase = await createSupabaseServerClient();
    const { data: existing } = await supabase
      .from("invitations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return { success: false, error: "이미 초대가 발송된 이메일입니다." };
    }
  }

  // 학생 초대 검증: 이미 연결된 학생이거나 pending 초대가 있으면 차단
  if (targetRole === "student" && studentId) {
    const adminClient = createSupabaseAdminClient();
    if (adminClient) {
      // 이미 auth user와 연결된 학생인지 확인
      const { data: authData } = await adminClient.auth.admin.getUserById(studentId);
      if (authData?.user) {
        return {
          success: false,
          error: "이미 연결된 학생입니다. 연결 해제 후 재초대하세요.",
        };
      }
    }

    // pending 학생 초대 중복 확인
    const checkSupabase = await createSupabaseServerClient();
    const { data: pendingStudentInv } = await checkSupabase
      .from("invitations")
      .select("id")
      .eq("student_id", studentId)
      .eq("target_role", "student")
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (pendingStudentInv) {
      return {
        success: false,
        error: "이미 대기 중인 학생 초대가 있습니다. 기존 초대를 취소 후 다시 시도하세요.",
      };
    }
  }

  // 학부모 초대 검증: pending 학부모 초대가 있으면 차단
  let duplicateRelationWarning: string | undefined;
  if (targetRole === "parent" && studentId) {
    const checkSupabase = await createSupabaseServerClient();
    const { data: pendingParentInv } = await checkSupabase
      .from("invitations")
      .select("id")
      .eq("student_id", studentId)
      .eq("target_role", "parent")
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (pendingParentInv) {
      return {
        success: false,
        error: "이미 대기 중인 학부모 초대가 있습니다. 기존 초대를 취소 후 다시 시도하세요.",
      };
    }

    // 동일 관계 중복 경고 (차단하지 않음)
    if (relation) {
      const { data: existingLinks } = await checkSupabase
        .from("parent_student_links")
        .select("id")
        .eq("student_id", studentId)
        .eq("relation", relation)
        .limit(1);

      if (existingLinks && existingLinks.length > 0) {
        const RELATION_LABEL: Record<string, string> = {
          father: "아버지", mother: "어머니", guardian: "보호자",
        };
        duplicateRelationWarning = `이미 "${RELATION_LABEL[relation] ?? relation}" 관계의 학부모가 연결되어 있습니다.`;
      }
    }
  }

  // 만료일 설정
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (expiryDays ?? getDefaultExpiryDays(targetRole)));

  const supabase = await createSupabaseServerClient();

  try {
    const { data: row, error } = await supabase
      .from("invitations")
      .insert({
        tenant_id: tenantId,
        target_role: targetRole,
        email: email ?? null,
        phone: phone ?? null,
        student_id: studentId ?? null,
        relation: relation ?? null,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        delivery_method: deliveryMethod,
        delivery_status: deliveryMethod === "manual" || deliveryMethod === "qr" ? "skipped" : "pending",
        invited_by: userId,
      })
      .select(INVITATION_SELECT)
      .single();

    if (error || !row) {
      logActionError({ domain: "invitation", action: "create" }, error, { ...input });
      return { success: false, error: `초대 생성에 실패했습니다: ${error?.message}` };
    }

    const invitation = mapRowToInvitation(row);
    const joinUrl = getJoinUrl(invitation.token);

    // 발송 처리 (manual/qr은 발송 건너뜀)
    let deliverySent = false;
    let deliveryError: string | undefined;

    if (deliveryMethod !== "manual" && deliveryMethod !== "qr") {
      const deliveryResult = await deliverInvitation(invitation, joinUrl);
      deliverySent = deliveryResult.success;
      deliveryError = deliveryResult.error;

      // 발송 상태 업데이트
      await supabase
        .from("invitations")
        .update({
          delivery_status: deliverySent ? "sent" : "failed",
          delivered_at: deliverySent ? new Date().toISOString() : null,
        })
        .eq("id", invitation.id);
    }

    // 캐시 무효화
    if (studentId) {
      revalidatePath(`/admin/students/${studentId}`);
    }
    revalidatePath("/admin/team");

    logActionSuccess(
      { domain: "invitation", action: "create", userId },
      { targetRole, deliveryMethod, deliverySent }
    );

    return {
      success: true,
      invitation,
      joinUrl,
      warning: duplicateRelationWarning,
      deliverySent,
      deliveryError,
    };
  } catch (error) {
    logActionError({ domain: "invitation", action: "create" }, error, { ...input });
    return {
      success: false,
      error: error instanceof Error ? error.message : "초대 생성 중 오류가 발생했습니다.",
    };
  }
}

// ============================================
// 초대 검증 (토큰)
// ============================================

export async function validateInvitationByToken(
  token: string
): Promise<ValidateInvitationResult> {
  if (!isValidUUID(token)) {
    return { success: false, error: "유효하지 않은 초대 링크입니다." };
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return { success: false, error: "서버 오류가 발생했습니다." };
  }

  const { data, error } = await adminClient
    .from("invitations")
    .select(`
      id, token, tenant_id, target_role, student_id, relation, email, expires_at, status,
      tenants:tenant_id(name),
      students:student_id(name)
    `)
    .eq("token", token)
    .single();

  if (error || !data) {
    return { success: false, error: "유효하지 않은 초대입니다." };
  }

  if (data.status !== "pending") {
    const msg = data.status === "accepted" ? "이미 수락된 초대입니다." :
                data.status === "expired" ? "만료된 초대입니다." :
                "취소된 초대입니다.";
    return { success: false, error: msg };
  }

  if (new Date(data.expires_at) < new Date()) {
    // 자동 만료 처리
    await adminClient
      .from("invitations")
      .update({ status: "expired" })
      .eq("id", data.id);
    return { success: false, error: "만료된 초대입니다." };
  }

  const tenant = data.tenants as { name: string } | null;
  const student = data.students as { name: string } | null;

  return {
    success: true,
    invitation: {
      id: data.id,
      token: data.token,
      tenantId: data.tenant_id,
      tenantName: tenant?.name ?? null,
      targetRole: data.target_role as InvitationRole,
      studentId: data.student_id,
      studentName: student?.name ?? null,
      relation: data.relation as InvitationRelation | null,
      email: data.email,
      expiresAt: data.expires_at,
    },
  };
}

// ============================================
// 초대 검증 (레거시 코드 — 하위 호환)
// ============================================

export async function validateInvitationByCode(
  code: string
): Promise<ValidateInvitationResult> {
  if (!/^INV-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code.toUpperCase())) {
    return { success: false, error: "초대 코드 형식이 올바르지 않습니다." };
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return { success: false, error: "서버 오류가 발생했습니다." };
  }

  const { data, error } = await adminClient
    .from("invitations")
    .select(`
      id, token, tenant_id, target_role, student_id, relation, email, expires_at, status,
      tenants:tenant_id(name),
      students:student_id(name)
    `)
    .eq("legacy_code", code.toUpperCase())
    .single();

  if (error || !data) {
    return { success: false, error: "유효하지 않은 초대 코드입니다." };
  }

  if (data.status !== "pending") {
    return { success: false, error: "이미 사용되었거나 만료된 초대 코드입니다." };
  }

  if (new Date(data.expires_at) < new Date()) {
    await adminClient
      .from("invitations")
      .update({ status: "expired" })
      .eq("id", data.id);
    return { success: false, error: "만료된 초대 코드입니다." };
  }

  const tenant = data.tenants as { name: string } | null;
  const student = data.students as { name: string } | null;

  return {
    success: true,
    invitation: {
      id: data.id,
      token: data.token,
      tenantId: data.tenant_id,
      tenantName: tenant?.name ?? null,
      targetRole: data.target_role as InvitationRole,
      studentId: data.student_id,
      studentName: student?.name ?? null,
      relation: data.relation as InvitationRelation | null,
      email: data.email,
      expiresAt: data.expires_at,
    },
  };
}

// ============================================
// 초대 수락
// ============================================

export async function acceptInvitation(
  token: string,
  userId: string,
  options?: { relation?: string; consents?: ConsentData }
): Promise<AcceptInvitationResult> {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return { success: false, error: "서버 오류가 발생했습니다." };
  }

  try {
    // 초대 검증 (상태별 명확한 에러 메시지는 validateInvitationByToken에서 처리)
    const validation = await validateInvitationByToken(token);
    if (!validation.success || !validation.invitation) {
      return { success: false, error: validation.error };
    }

    const inv = validation.invitation;

    // 역할 충돌 검증: 기존 역할과 초대 역할이 충돌하는지 확인
    const { data: authUser } = await adminClient.auth.admin.getUserById(userId);
    const existingRole = authUser?.user?.user_metadata?.signup_role as string | undefined;

    if (existingRole && existingRole !== inv.targetRole) {
      const ROLE_LABEL_MAP: Record<string, string> = {
        student: "학생", parent: "학부모", admin: "관리자", consultant: "상담사",
      };
      const existingLabel = ROLE_LABEL_MAP[existingRole] ?? existingRole;
      const targetLabel = ROLE_LABEL_MAP[inv.targetRole] ?? inv.targetRole;
      return {
        success: false,
        error: `이미 ${existingLabel} 계정으로 등록되어 있습니다. ${targetLabel} 초대를 수락하려면 다른 계정을 사용해주세요.`,
      };
    }

    // 초대 수락 처리 (race condition 방지: status가 pending인 경우만 업데이트)
    const { data: updated, error: updateError } = await adminClient
      .from("invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: userId,
      })
      .eq("id", inv.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      // 상세한 에러 메시지를 위해 현재 상태 재조회
      const { data: currentInv } = await adminClient
        .from("invitations")
        .select("status")
        .eq("id", inv.id)
        .maybeSingle();

      if (currentInv?.status === "accepted") {
        return { success: false, error: "이미 수락된 초대입니다." };
      }
      if (currentInv?.status === "cancelled") {
        return { success: false, error: "관리자가 초대를 취소했습니다. 새 초대를 요청해주세요." };
      }
      if (currentInv?.status === "expired") {
        return { success: false, error: "만료된 초대입니다. 관리자에게 새 초대를 요청해주세요." };
      }
      return { success: false, error: "초대 수락에 실패했습니다. 다시 시도해주세요." };
    }

    // 역할별 후속 처리
    let redirectTo: string;

    switch (inv.targetRole) {
      case "admin":
      case "consultant": {
        // admin_users에 레코드 생성
        const { data: existing } = await adminClient
          .from("admin_users")
          .select("id")
          .eq("id", userId)
          .eq("tenant_id", inv.tenantId)
          .maybeSingle();

        if (!existing) {
          // authUser는 공통 후처리에서도 조회하므로, 여기서는 간단히 이름만 가져옴
          const { data: au } = await adminClient.auth.admin.getUserById(userId);
          const userName =
            au?.user?.user_metadata?.display_name ||
            au?.user?.user_metadata?.name ||
            au?.user?.email?.split("@")[0] ||
            "사용자";

          // admin_users에는 admin 고유 필드만, name은 user_profiles에서 관리
          const { error: insertError } = await adminClient.from("admin_users").insert({
            id: userId,
            role: inv.targetRole,
            tenant_id: inv.tenantId,
          });

          // name은 user_profiles에 저장
          if (!insertError && userName) {
            await adminClient.from("user_profiles").update({ name: userName }).eq("id", userId);
          }

          if (insertError) {
            logActionError({ domain: "invitation", action: "accept" }, insertError, { token, userId });
            return { success: false, error: "팀원 등록에 실패했습니다." };
          }
        }

        redirectTo = "/admin/dashboard";
        break;
      }

      case "student": {
        if (!inv.studentId) {
          return { success: false, error: "학생 정보가 없는 초대입니다." };
        }

        // studentId와 userId가 같으면 이미 연결된 상태
        if (inv.studentId !== userId) {
          // RPC: students.id를 auth user ID로 변경
          // invitations.student_id FK는 ON UPDATE CASCADE로 자동 업데이트됨
          const { error: rpcError } = await adminClient.rpc("transfer_student_identity", {
            old_id: inv.studentId,
            new_id: userId,
          });

          if (rpcError) {
            logActionError({ domain: "invitation", action: "accept" }, rpcError, { token, userId });
            // RPC 실패 시 초대를 pending으로 롤백
            await adminClient
              .from("invitations")
              .update({ status: "pending", accepted_at: null, accepted_by: null })
              .eq("id", inv.id);
            return { success: false, error: "학생 계정 연결에 실패했습니다. 다시 시도해주세요." };
          }
        }

        // 연결 이력 기록
        await adminClient.from("student_connection_history").insert({
          student_id: userId, // transfer 후 userId가 students.id
          auth_user_id: userId,
          action: "connected",
          performed_by: userId,
        });

        redirectTo = "/dashboard";
        break;
      }

      case "parent": {
        if (!inv.studentId || !inv.tenantId) {
          return { success: false, error: "학생 또는 기관 정보가 없는 초대입니다." };
        }

        const finalRelation = options?.relation || inv.relation || "guardian";

        const { data: existingParent } = await adminClient
          .from("user_profiles")
          .select("id")
          .eq("id", userId)
          .eq("role", "parent")
          .maybeSingle();

        if (!existingParent) {
          const { data: au } = await adminClient.auth.admin.getUserById(userId);
          const parentName =
            au?.user?.user_metadata?.display_name ||
            au?.user?.user_metadata?.name ||
            "학부모";

          const { error: parentInsertError } = await adminClient.from("user_profiles").insert({
            id: userId,
            role: "parent",
            name: parentName,
            tenant_id: inv.tenantId,
          });

          if (parentInsertError) {
            logActionError({ domain: "invitation", action: "accept" }, parentInsertError, { token, userId });
            return { success: false, error: "학부모 등록에 실패했습니다." };
          }
        }

        // ghost parent 병합: 같은 student_id + relation의 기존 ghost link가 있으면 교체
        const { data: ghostLink } = await adminClient
          .from("parent_student_links")
          .select("id, parent_id")
          .eq("student_id", inv.studentId)
          .eq("relation", finalRelation)
          .maybeSingle();

        if (ghostLink && ghostLink.parent_id !== userId) {
          // ghost parent의 link를 실제 사용자로 교체
          await adminClient
            .from("parent_student_links")
            .update({ parent_id: userId })
            .eq("id", ghostLink.id);
          // ghost user_profiles 정리 (다른 link가 없으면 삭제)
          const { count } = await adminClient
            .from("parent_student_links")
            .select("id", { count: "exact", head: true })
            .eq("parent_id", ghostLink.parent_id);
          if (count === 0) {
            await adminClient.from("user_profiles").delete().eq("id", ghostLink.parent_id);
          }
        }

        const { data: existingLink } = await adminClient
          .from("parent_student_links")
          .select("id")
          .eq("parent_id", userId)
          .eq("student_id", inv.studentId)
          .maybeSingle();

        if (!existingLink) {
          const { error: linkError } = await adminClient
            .from("parent_student_links")
            .insert({
              parent_id: userId,
              student_id: inv.studentId,
              relation: finalRelation,
              tenant_id: inv.tenantId,
            });

          if (linkError) {
            logActionError({ domain: "invitation", action: "accept" }, linkError, { token, userId });
            return { success: false, error: "자녀 연결에 실패했습니다." };
          }
        }

        redirectTo = "/parent/dashboard";
        break;
      }

      default:
        return { success: false, error: "알 수 없는 역할입니다." };
    }

    // 공통 후처리: auth 메타데이터 업데이트
    const { data: authUserForMeta } = await adminClient.auth.admin.getUserById(userId);
    const displayName =
      authUserForMeta?.user?.user_metadata?.display_name ||
      authUserForMeta?.user?.user_metadata?.name ||
      authUserForMeta?.user?.user_metadata?.full_name ||
      authUserForMeta?.user?.email?.split("@")[0] ||
      "사용자";

    await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...authUserForMeta?.user?.user_metadata,
        signup_role: inv.targetRole,
        tenant_id: inv.tenantId,
        display_name: displayName,
      },
    });

    // 공통 후처리: 동의 정보 저장
    if (options?.consents) {
      await saveUserConsents(userId, options.consents, undefined, true);
    }

    logActionSuccess(
      { domain: "invitation", action: "accept", userId },
      { targetRole: inv.targetRole, tenantId: inv.tenantId, studentId: inv.studentId }
    );

    return { success: true, redirectTo };
  } catch (error) {
    logActionError({ domain: "invitation", action: "accept" }, error, { token, userId });
    return {
      success: false,
      error: error instanceof Error ? error.message : "초대 수락 중 오류가 발생했습니다.",
    };
  }
}

// ============================================
// 초대 취소
// ============================================

export async function cancelInvitationAction(
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdminOrConsultant();

  const supabase = await createSupabaseServerClient();

  // 초대 정보 조회 (revalidation용)
  const { data: inv } = await supabase
    .from("invitations")
    .select("student_id")
    .eq("id", invitationId)
    .maybeSingle();

  const { error } = await supabase
    .from("invitations")
    .update({ status: "cancelled" })
    .eq("id", invitationId)
    .eq("status", "pending");

  if (error) {
    logActionError({ domain: "invitation", action: "cancel" }, error, { invitationId });
    return { success: false, error: error.message };
  }

  if (inv?.student_id) {
    revalidatePath(`/admin/students/${inv.student_id}`);
  }
  revalidatePath("/admin/team");

  return { success: true };
}

// ============================================
// 초대 재발송
// ============================================

export const resendInvitationAction = withErrorHandling(
  async (invitationId: string): Promise<{ success: boolean; error?: string }> => {
    await requireAdminOrConsultant();

    const supabase = await createSupabaseServerClient();

    const { data: row, error: fetchError } = await supabase
      .from("invitations")
      .select(INVITATION_SELECT)
      .eq("id", invitationId)
      .eq("status", "pending")
      .single();

    if (fetchError || !row) {
      throw new AppError("초대를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
    }

    const invitation = mapRowToInvitation(row);

    // 재발송 쿨다운: 마지막 발송 후 1분
    if (invitation.deliveredAt) {
      const lastDelivered = new Date(invitation.deliveredAt).getTime();
      const cooldownMs = 60 * 1000; // 1분
      if (Date.now() - lastDelivered < cooldownMs) {
        const remainSec = Math.ceil((cooldownMs - (Date.now() - lastDelivered)) / 1000);
        throw new AppError(
          `재발송은 ${remainSec}초 후에 가능합니다.`,
          ErrorCode.BUSINESS_LOGIC_ERROR,
          429,
          true
        );
      }
    }

    // 만료 시간 연장
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + getDefaultExpiryDays(invitation.targetRole));

    await supabase
      .from("invitations")
      .update({ expires_at: newExpiresAt.toISOString() })
      .eq("id", invitationId);

    // 재발송
    const joinUrl = getJoinUrl(invitation.token);
    const deliveryResult = await deliverInvitation(invitation, joinUrl);

    if (!deliveryResult.success) {
      throw new AppError(
        deliveryResult.error || "발송에 실패했습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    // 발송 상태 업데이트
    await supabase
      .from("invitations")
      .update({
        delivery_status: "sent",
        delivered_at: new Date().toISOString(),
      })
      .eq("id", invitationId);

    return { success: true };
  }
);

// ============================================
// 학생별 초대 목록
// ============================================

export async function getStudentInvitations(
  studentId: string
): Promise<{ success: boolean; data?: Invitation[]; error?: string }> {
  await requireAdminOrConsultant();

  const supabase = await createSupabaseServerClient();

  // 만료된 pending 초대를 자동으로 expired 처리
  await supabase
    .from("invitations")
    .update({ status: "expired" })
    .eq("student_id", studentId)
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());

  const { data, error } = await supabase
    .from("invitations")
    .select(INVITATION_SELECT)
    .eq("student_id", studentId)
    .in("target_role", ["student", "parent"])
    .order("created_at", { ascending: false });

  if (error) {
    logActionError({ domain: "invitation", action: "getStudentInvitations" }, error, { studentId });
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: (data ?? []).map(mapRowToInvitation),
  };
}

// ============================================
// 팀 초대 목록
// ============================================

export async function getTeamInvitations(): Promise<{
  success: boolean;
  data?: Invitation[];
  error?: string;
}> {
  const { tenantId } = await requireAdmin();

  if (!tenantId) {
    return { success: false, error: "기관 정보를 찾을 수 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("invitations")
    .select(INVITATION_SELECT)
    .eq("tenant_id", tenantId)
    .in("target_role", ["admin", "consultant"])
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    logActionError({ domain: "invitation", action: "getTeamInvitations" }, error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: (data ?? []).map(mapRowToInvitation),
  };
}

// ============================================
// 토큰으로 초대 정보 조회 (공개 — /join/[token] 페이지용)
// ============================================

export async function getInvitationByToken(token: string) {
  if (!token || !isValidUUID(token)) {
    return null;
  }

  const result = await validateInvitationByToken(token);
  if (!result.success || !result.invitation) {
    return null;
  }

  return result.invitation;
}
