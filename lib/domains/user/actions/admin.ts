"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

/**
 * 관리자 계정 생성
 */
export const createAdminUser = withErrorHandling(
  async (formData: FormData): Promise<{ success: boolean; error?: string }> => {
    // 권한 확인 (admin만 허용)
    const { role: currentRole } = await requireAdminOrConsultant();

    // Super Admin만 접근 가능
    if (currentRole !== "admin" && currentRole !== "superadmin") {
      throw new AppError(
        "관리자 권한이 필요합니다.",
        ErrorCode.FORBIDDEN,
        403,
        true
      );
    }

    const userEmail = formData.get("user_email")?.toString();
    const userRole = formData.get("role")?.toString() as "admin" | "consultant";

    if (!userEmail || !userRole) {
      throw new AppError(
        "이메일과 역할을 입력해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (userRole !== "admin" && userRole !== "consultant") {
      throw new AppError(
        "올바른 역할을 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    // 이메일로 사용자 조회 (Service Role Key 필요)
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      throw new AppError(
        "SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    const { data: users, error: listError } =
      await adminClient.auth.admin.listUsers();

    if (listError) {
      throw new AppError(
        "사용자 목록을 조회할 수 없습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: listError.message }
      );
    }

    const user = users.users.find(
      (u: { email?: string }) => u.email === userEmail
    );

    if (!user) {
      throw new AppError(
        "해당 이메일의 사용자를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 이미 관리자인지 확인
    const { data: existingAdmin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existingAdmin) {
      throw new AppError(
        "이미 관리자로 등록된 사용자입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // admin_users에 추가
    const { error: insertError } = await supabase.from("admin_users").insert({
      id: user.id,
      role: userRole,
    });

    if (insertError) {
      throw new AppError(
        insertError.message || "관리자 계정 생성에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: insertError.message }
      );
    }

    return { success: true };
  }
);

/**
 * 관리자 권한 제거
 */
export const deleteAdminUser = withErrorHandling(
  async (userId: string): Promise<{ success: boolean; error?: string }> => {
    // 권한 확인 (admin만 허용)
    const { role: currentRole, userId: currentUserId } =
      await requireAdminOrConsultant();

    // Super Admin만 접근 가능
    if (currentRole !== "admin" && currentRole !== "superadmin") {
      throw new AppError(
        "관리자 권한이 필요합니다.",
        ErrorCode.FORBIDDEN,
        403,
        true
      );
    }

    // 자신의 권한은 제거할 수 없음
    if (currentUserId === userId) {
      throw new AppError(
        "자신의 관리자 권한은 제거할 수 없습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    const { error: deleteError } = await supabase
      .from("admin_users")
      .delete()
      .eq("id", userId);

    if (deleteError) {
      throw new AppError(
        deleteError.message || "관리자 권한 제거에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: deleteError.message }
      );
    }

    return { success: true };
  }
);
