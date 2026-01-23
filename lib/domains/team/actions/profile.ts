"use server";

/**
 * 프로필 관리 Server Actions
 *
 * - updateMyProfile: 현재 로그인한 사용자의 프로필 수정
 * - getMyProfile: 현재 로그인한 사용자의 프로필 조회
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { revalidatePath } from "next/cache";

export type ProfileData = {
  id: string;
  name: string;
  email: string | null;
  role: string;
};

export type UpdateProfileInput = {
  name: string;
};

export type UpdateProfileResult = {
  success: boolean;
  error?: string;
};

/**
 * 현재 로그인한 Admin/Consultant의 프로필 조회
 */
export async function getMyProfile(): Promise<ProfileData | null> {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !["admin", "consultant", "superadmin"].includes(role || "")) {
    return null;
  }

  const supabase = await createSupabaseServerClient();

  const { data: adminUser, error } = await supabase
    .from("admin_users")
    .select("id, name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !adminUser) {
    return null;
  }

  // 이메일은 auth.users에서 가져와야 하지만, 서버 컴포넌트에서는 getUser()로 가능
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    id: adminUser.id,
    name: adminUser.name,
    email: user?.email || null,
    role: adminUser.role,
  };
}

/**
 * 현재 로그인한 Admin/Consultant의 프로필 수정
 */
export const updateMyProfile = withErrorHandling(
  async (input: UpdateProfileInput): Promise<UpdateProfileResult> => {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !["admin", "consultant", "superadmin"].includes(role || "")) {
      throw new AppError(
        "프로필을 수정할 권한이 없습니다.",
        ErrorCode.UNAUTHORIZED,
        401,
        true
      );
    }

    const { name } = input;

    // 입력 검증
    if (!name || name.trim().length === 0) {
      throw new AppError(
        "이름을 입력해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (name.trim().length > 50) {
      throw new AppError(
        "이름은 50자 이내로 입력해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("admin_users")
      .update({ name: name.trim() })
      .eq("id", userId);

    if (error) {
      throw new AppError(
        "프로필 수정에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: error.message }
      );
    }

    // 캐시 무효화
    revalidatePath("/admin/settings");
    revalidatePath("/admin");

    return { success: true };
  }
);
