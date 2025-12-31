/**
 * 테넌트 할당 공통 유틸리티
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserType, TenantAssignmentResult } from "@/lib/types/tenantUser";
import { validateTenantExists } from "./tenantValidation";
import { logActionError } from "@/lib/logging/actionLogger";

/**
 * 사용자 타입별 테넌트 업데이트 공통 로직
 */
export async function updateUserTenant(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  userType: UserType
): Promise<TenantAssignmentResult> {
  try {
    // 테넌트 존재 확인
    const validation = await validateTenantExists(supabase, tenantId);
    if (!validation.exists) {
      return {
        success: false,
        error: validation.error || "해당 기관을 찾을 수 없습니다.",
      };
    }

    // 사용자 타입에 따라 적절한 테이블 업데이트
    let updateError = null;

    if (userType === "student") {
      // students 테이블: user_id로 먼저 시도, 없으면 id로
      const { error: error1 } = await supabase
        .from("students")
        .update({ tenant_id: tenantId })
        .eq("user_id", userId);

      if (error1) {
        // id로 시도
        const { error: error2 } = await supabase
          .from("students")
          .update({ tenant_id: tenantId })
          .eq("id", userId);
        updateError = error2;
      }
    } else if (userType === "parent") {
      // parent_users 테이블: id로 업데이트
      const { error } = await supabase
        .from("parent_users")
        .update({ tenant_id: tenantId })
        .eq("id", userId);
      updateError = error;
    } else if (userType === "admin") {
      // admin_users 테이블: id로 업데이트
      const { error } = await supabase
        .from("admin_users")
        .update({ tenant_id: tenantId })
        .eq("id", userId);
      updateError = error;
    } else {
      return {
        success: false,
        error: `지원하지 않는 사용자 타입입니다: ${userType}`,
      };
    }

    if (updateError) {
      logActionError(
        { domain: "utils", action: "updateUserTenant" },
        updateError,
        { userId, tenantId, userType }
      );
      return {
        success: false,
        error:
          updateError.message || `${userType} 테넌트 할당에 실패했습니다.`,
      };
    }

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "utils", action: "updateUserTenant" },
      error,
      { userId, tenantId, userType }
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "테넌트 할당에 실패했습니다.",
    };
  }
}

/**
 * 다중 사용자에 테넌트 할당
 */
export async function updateMultipleUserTenants(
  supabase: SupabaseClient,
  userIds: Array<{ userId: string; userType: UserType }>,
  tenantId: string
): Promise<TenantAssignmentResult> {
  try {
    // 테넌트 존재 확인
    const validation = await validateTenantExists(supabase, tenantId);
    if (!validation.exists) {
      return {
        success: false,
        error: validation.error || "해당 기관을 찾을 수 없습니다.",
      };
    }

    let assignedCount = 0;
    const errors: string[] = [];

    for (const { userId, userType } of userIds) {
      const result = await updateUserTenant(supabase, userId, tenantId, userType);
      if (result.success) {
        assignedCount++;
      } else {
        errors.push(`${userId} (${userType}): ${result.error || "알 수 없는 오류"}`);
      }
    }

    if (errors.length > 0) {
      logActionError(
        { domain: "utils", action: "updateMultipleUserTenants" },
        new Error("일부 사용자 테넌트 할당 실패"),
        { failedCount: errors.length, errors }
      );
    }

    return {
      success: true,
      assignedCount,
      ...(errors.length > 0 && {
        error: `${errors.length}명의 사용자 할당에 실패했습니다.`,
      }),
    };
  } catch (error) {
    logActionError(
      { domain: "utils", action: "updateMultipleUserTenants" },
      error,
      { tenantId, userCount: userIds.length }
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "일괄 테넌트 할당에 실패했습니다.",
    };
  }
}

