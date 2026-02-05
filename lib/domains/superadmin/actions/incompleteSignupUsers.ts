"use server";

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode } from "@/lib/errors";
import { withActionResponse } from "@/lib/utils/serverActionHandler";
import { logActionError } from "@/lib/logging/actionLogger";
import type { IncompleteSignupUser } from "../types";

/**
 * 미완료 가입 사용자 조회 (역할 레코드가 없는 auth.users)
 */
async function _getIncompleteSignupUsers(): Promise<IncompleteSignupUser[]> {
  const { role } = await getCurrentUserRole();

  if (role !== "superadmin") {
    throw new AppError(
      "Super Admin만 접근할 수 있습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    throw new AppError(
      "Service Role Key가 설정되지 않았습니다. 관리자에게 문의하세요.",
      ErrorCode.CONFIGURATION_ERROR,
      500,
      true
    );
  }

  // auth.users에서 역할 레코드가 없는 사용자 조회
  const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers({
    perPage: 1000,
  });

  if (authError) {
    logActionError(
      { domain: "superadmin", action: "getIncompleteSignupUsers" },
      authError,
      { context: "auth.users 조회 실패" }
    );
    throw new AppError(
      authError.message || "사용자 목록 조회에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  if (!authUsers?.users) {
    return [];
  }

  // 역할 테이블에서 모든 사용자 ID 조회
  const [studentsResult, parentsResult, adminsResult] = await Promise.all([
    adminClient.from("students").select("id"),
    adminClient.from("parent_users").select("id"),
    adminClient.from("admin_users").select("id"),
  ]);

  const roleUserIds = new Set<string>();

  (studentsResult.data || []).forEach((s) => roleUserIds.add(s.id));
  (parentsResult.data || []).forEach((p) => roleUserIds.add(p.id));
  (adminsResult.data || []).forEach((a) => roleUserIds.add(a.id));

  // 역할 레코드가 없는 사용자 필터링
  const incompleteUsers: IncompleteSignupUser[] = authUsers.users
    .filter((user) => !roleUserIds.has(user.id))
    .map((user) => ({
      id: user.id,
      email: user.email || "이메일 없음",
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      provider: user.app_metadata?.provider || null,
      signupRole: user.user_metadata?.signup_role || null,
      created_at: user.created_at,
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return incompleteUsers;
}

export const getIncompleteSignupUsers = withActionResponse(_getIncompleteSignupUsers);

/**
 * 미완료 가입 사용자 삭제
 */
async function _deleteIncompleteSignupUser(userId: string): Promise<void> {
  const { role } = await getCurrentUserRole();

  if (role !== "superadmin") {
    throw new AppError(
      "Super Admin만 접근할 수 있습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    throw new AppError(
      "Service Role Key가 설정되지 않았습니다. 관리자에게 문의하세요.",
      ErrorCode.CONFIGURATION_ERROR,
      500,
      true
    );
  }

  // 역할 레코드가 있는지 확인 (있으면 삭제 불가)
  const [studentResult, parentResult, adminResult] = await Promise.all([
    adminClient.from("students").select("id").eq("id", userId).maybeSingle(),
    adminClient.from("parent_users").select("id").eq("id", userId).maybeSingle(),
    adminClient.from("admin_users").select("id").eq("id", userId).maybeSingle(),
  ]);

  if (studentResult.data || parentResult.data || adminResult.data) {
    throw new AppError(
      "역할이 할당된 사용자는 삭제할 수 없습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // auth.users에서 삭제
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    logActionError(
      { domain: "superadmin", action: "deleteIncompleteSignupUser" },
      error,
      { userId }
    );
    throw new AppError(
      error.message || "사용자 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/superadmin/tenantless-users");
}

export const deleteIncompleteSignupUser = withActionResponse(_deleteIncompleteSignupUser);
