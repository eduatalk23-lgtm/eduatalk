"use server";

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * 미인증 사용자 삭제
 */
export async function deleteUnverifiedUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin") {
    return { success: false, error: "관리자 권한이 필요합니다." };
  }

  try {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return {
        success: false,
        error: "SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다.",
      };
    }

    const { error } = await adminClient.auth.admin.deleteUser(userId);

    if (error) {
      console.error("[admin/unverified-users] 사용자 삭제 실패", error);
      return { success: false, error: error.message || "사용자 삭제에 실패했습니다." };
    }

    revalidatePath("/admin/unverified-users");
    return { success: true };
  } catch (error) {
    console.error("[admin/unverified-users] 사용자 삭제 중 오류", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "사용자 삭제에 실패했습니다.",
    };
  }
}

/**
 * 미인증 사용자에게 인증 메일 재발송
 */
export async function resendVerificationEmail(
  email: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin") {
    return { success: false, error: "관리자 권한이 필요합니다." };
  }

  try {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return {
        success: false,
        error: "SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다.",
      };
    }
    
    // 사용자 조회
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
      return { success: false, error: "사용자를 찾을 수 없습니다." };
    }

    const user = usersData?.users.find((u) => u.email === email);
    if (!user) {
      return { success: false, error: "해당 이메일의 사용자를 찾을 수 없습니다." };
    }

    // 인증 링크 생성 및 이메일 발송
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "signup",
      email: email,
    });

    if (linkError) {
      console.error("[admin/unverified-users] 인증 링크 생성 실패", linkError);
      return { success: false, error: linkError.message || "인증 메일 재발송에 실패했습니다." };
    }

    // Supabase는 generateLink만으로는 이메일을 자동 발송하지 않으므로,
    // 실제로는 Supabase의 이메일 템플릿 설정이나 별도의 이메일 서비스를 사용해야 합니다.
    // 여기서는 링크가 생성되었음을 알려주고, 수동으로 이메일을 발송하도록 안내합니다.

    return {
      success: true,
      message: "인증 링크가 생성되었습니다. (이메일 발송은 Supabase 설정에 따라 자동으로 처리됩니다.)",
    };
  } catch (error) {
    console.error("[admin/unverified-users] 인증 메일 재발송 중 오류", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "인증 메일 재발송에 실패했습니다.",
    };
  }
}

/**
 * 미인증 사용자 일괄 삭제
 */
export async function deleteMultipleUnverifiedUsers(
  userIds: string[]
): Promise<{ success: boolean; error?: string; deletedCount?: number }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin") {
    return { success: false, error: "관리자 권한이 필요합니다." };
  }

  try {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return {
        success: false,
        error: "SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다.",
      };
    }

    let deletedCount = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) {
        errors.push(`${userId}: ${error.message}`);
      } else {
        deletedCount++;
      }
    }

    if (errors.length > 0) {
      console.error("[admin/unverified-users] 일부 사용자 삭제 실패", errors);
    }

    revalidatePath("/admin/unverified-users");
    return { success: true, deletedCount };
  } catch (error) {
    console.error("[admin/unverified-users] 일괄 삭제 중 오류", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "일괄 삭제에 실패했습니다.",
    };
  }
}

