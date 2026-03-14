"use server";

/**
 * 프로필 관리 Server Actions
 *
 * - updateMyProfile: 현재 로그인한 사용자의 프로필 수정
 * - getMyProfile: 현재 로그인한 사용자의 프로필 조회
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { revalidatePath } from "next/cache";

export type ProfileData = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  profileImageUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  phone: string | null;
};

export type UpdateProfileInput = {
  name: string;
  jobTitle?: string;
  department?: string;
  phone?: string;
};

export type UpdateProfileResult = {
  success: boolean;
  error?: string;
};

/**
 * 현재 로그인한 Admin/Consultant의 프로필 조회
 */
export async function getMyProfile(): Promise<ProfileData | null> {
  const { userId, role } = await getCachedUserRole();

  if (!userId || !["admin", "consultant", "superadmin"].includes(role || "")) {
    return null;
  }

  const supabase = await createSupabaseServerClient();

  // admin_users(admin 고유 필드) + user_profiles(공통 필드) 병렬 조회
  const [adminResult, profileResult, authResult] = await Promise.all([
    supabase.from("admin_users").select("id, role, job_title, department").eq("id", userId).maybeSingle(),
    supabase.from("user_profiles").select("name, phone, profile_image_url").eq("id", userId).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (adminResult.error || !adminResult.data) {
    return null;
  }

  const adminUser = adminResult.data;
  const profile = profileResult.data;

  return {
    id: adminUser.id,
    name: profile?.name ?? "",
    email: authResult.data?.user?.email || null,
    role: adminUser.role,
    profileImageUrl: profile?.profile_image_url ?? null,
    jobTitle: adminUser.job_title,
    department: adminUser.department,
    phone: profile?.phone ?? null,
  };
}

/**
 * 현재 로그인한 Admin/Consultant의 프로필 수정
 */
export const updateMyProfile = withErrorHandling(
  async (input: UpdateProfileInput): Promise<UpdateProfileResult> => {
    const { userId, role } = await getCachedUserRole();

    if (!userId || !["admin", "consultant", "superadmin"].includes(role || "")) {
      throw new AppError(
        "프로필을 수정할 권한이 없습니다.",
        ErrorCode.UNAUTHORIZED,
        401,
        true
      );
    }

    const { name, jobTitle, department, phone } = input;

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

    // name, phone은 user_profiles에 저장
    const profileUpdate: Record<string, string | null> = { name: name.trim() };
    if (phone !== undefined) profileUpdate.phone = phone?.trim() || null;

    const { error: profileError } = await supabase
      .from("user_profiles")
      .update(profileUpdate)
      .eq("id", userId);

    if (profileError) {
      throw new AppError(
        "프로필 수정에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: profileError.message }
      );
    }

    // admin 고유 필드(job_title, department)는 admin_users에 저장
    const adminUpdate: Record<string, string | null> = {};
    if (jobTitle !== undefined) adminUpdate.job_title = jobTitle?.trim() || null;
    if (department !== undefined) adminUpdate.department = department?.trim() || null;

    if (Object.keys(adminUpdate).length > 0) {
      const { error: adminError } = await supabase
        .from("admin_users")
        .update(adminUpdate)
        .eq("id", userId);

      if (adminError) {
        throw new AppError(
          "프로필 수정에 실패했습니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true,
          { originalError: adminError.message }
        );
      }
    }

    // 캐시 무효화
    revalidatePath("/admin/settings");
    revalidatePath("/admin");

    return { success: true };
  }
);
