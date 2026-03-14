"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { syncAuthBanStatus } from "@/lib/auth/syncAuthBanStatus";
import { revalidatePath } from "next/cache";

/**
 * 관리자 계정 생성
 */
export const createAdminUser = withErrorHandling(
  async (formData: FormData): Promise<{ success: boolean; error?: string }> => {
    // 권한 확인 (admin만 허용)
    const { role: currentRole, tenantId } = await requireAdminOrConsultant();

    // Super Admin만 접근 가능
    if (currentRole !== "admin" && currentRole !== "superadmin") {
      throw new AppError(
        "관리자 권한이 필요합니다.",
        ErrorCode.FORBIDDEN,
        403,
        true
      );
    }

    // 일반 Admin은 tenant 필요
    if (currentRole === "admin" && !tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
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

    // user_profiles에서 이메일로 사용자 조회 (auth.admin.listUsers 대체)
    const { data: profileUser, error: profileError } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("email", userEmail)
      .maybeSingle();

    if (profileError) {
      throw new AppError(
        "사용자를 조회할 수 없습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: profileError.message }
      );
    }

    if (!profileUser) {
      throw new AppError(
        "해당 이메일의 사용자를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const user = profileUser;

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

    // admin_users에 추가 (tenant_id 포함)
    const insertPayload: { id: string; role: string; tenant_id?: string | null } = {
      id: user.id,
      role: userRole,
    };

    // 일반 Admin이 생성하는 경우 자신의 tenant에 소속
    if (currentRole === "admin" && tenantId) {
      insertPayload.tenant_id = tenantId;
    }

    const { error: insertError } = await supabase.from("admin_users").insert(insertPayload);

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
    const { role: currentRole, userId: currentUserId, tenantId } =
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

    // 일반 Admin은 tenant 필요
    if (currentRole === "admin" && !tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
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

    // 삭제 대상 확인
    const { data: targetUser } = await supabase
      .from("admin_users")
      .select("id, role, tenant_id, is_owner")
      .eq("id", userId)
      .maybeSingle();

    if (!targetUser) {
      throw new AppError(
        "대상 관리자를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // Owner 보호: 대표 관리자는 superadmin만 제거 가능
    if (targetUser.is_owner && currentRole !== "superadmin") {
      throw new AppError(
        "대표 관리자는 제거할 수 없습니다.",
        ErrorCode.FORBIDDEN,
        403,
        true
      );
    }

    // Non-owner admin은 consultant만 제거 가능
    if (currentRole === "admin") {
      const { data: currentAdmin } = await supabase
        .from("admin_users")
        .select("is_owner")
        .eq("id", currentUserId)
        .maybeSingle();

      if (!currentAdmin?.is_owner && targetUser.role !== "consultant") {
        throw new AppError(
          "관리자를 제거할 권한이 없습니다.",
          ErrorCode.FORBIDDEN,
          403,
          true
        );
      }
    }

    // 삭제 쿼리 (RLS에 DELETE 정책이 없으므로 admin client 사용, 권한 검증은 위에서 완료)
    const adminDeleteClient = createSupabaseAdminClient();
    if (!adminDeleteClient) {
      throw new AppError(
        "서버 오류가 발생했습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    let deleteQuery = adminDeleteClient
      .from("admin_users")
      .delete()
      .eq("id", userId);

    // 일반 Admin인 경우 tenant_id로 필터링 (추가 안전장치)
    if (currentRole === "admin" && tenantId) {
      deleteQuery = deleteQuery.eq("tenant_id", tenantId);
    }

    const { error: deleteError } = await deleteQuery;

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

/**
 * 관리자/컨설턴트 비활성화·활성화
 * 권한 매트릭스: deleteAdminUser와 동일
 * - 자기 자신 비활성화 불가
 * - is_owner 보호: superadmin만 대표관리자 비활성화 가능
 * - 일반 admin(비대표): consultant만 비활성화 가능
 * - 대표 admin(is_owner): consultant + admin 비활성화 가능
 */
export const toggleAdminStatus = withErrorHandling(
  async (
    targetUserId: string,
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    const { role: currentRole, userId: currentUserId, tenantId } =
      await requireAdminOrConsultant();

    // admin 또는 superadmin만 허용
    if (currentRole !== "admin" && currentRole !== "superadmin") {
      throw new AppError(
        "관리자 권한이 필요합니다.",
        ErrorCode.FORBIDDEN,
        403,
        true
      );
    }

    // 일반 Admin은 tenant 필요
    if (currentRole === "admin" && !tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 자기 자신 비활성화 방지
    if (currentUserId === targetUserId) {
      throw new AppError(
        "자신의 계정 상태는 변경할 수 없습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    // 대상 확인
    const { data: targetUser } = await supabase
      .from("admin_users")
      .select("id, role, tenant_id, is_owner")
      .eq("id", targetUserId)
      .maybeSingle();

    if (!targetUser) {
      throw new AppError(
        "대상 관리자를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // Owner 보호: 대표 관리자는 superadmin만 비활성화 가능
    if (targetUser.is_owner && currentRole !== "superadmin") {
      throw new AppError(
        "대표 관리자의 상태는 변경할 수 없습니다.",
        ErrorCode.FORBIDDEN,
        403,
        true
      );
    }

    // Non-owner admin은 consultant만 비활성화 가능
    if (currentRole === "admin") {
      const { data: currentAdmin } = await supabase
        .from("admin_users")
        .select("is_owner")
        .eq("id", currentUserId)
        .maybeSingle();

      if (!currentAdmin?.is_owner && targetUser.role !== "consultant") {
        throw new AppError(
          "관리자의 상태를 변경할 권한이 없습니다.",
          ErrorCode.FORBIDDEN,
          403,
          true
        );
      }
    }

    // DB 업데이트 (admin client 사용 — RLS UPDATE 정책 우회)
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      throw new AppError(
        "서버 오류가 발생했습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    // is_active는 user_profiles에서 관리
    const { error: updateError } = await adminClient
      .from("user_profiles")
      .update({ is_active: isActive })
      .eq("id", targetUserId);

    if (updateError) {
      throw new AppError(
        updateError.message || "상태 변경에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: updateError.message }
      );
    }

    // Supabase Auth ban_duration 동기화
    await syncAuthBanStatus(targetUserId, isActive);

    revalidatePath("/admin/settings");

    return { success: true };
  }
);
