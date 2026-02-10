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
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !["admin", "consultant", "superadmin"].includes(role || "")) {
    return null;
  }

  const supabase = await createSupabaseServerClient();

  const { data: adminUser, error } = await supabase
    .from("admin_users")
    .select("id, name, role, profile_image_url, job_title, department, phone")
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
    profileImageUrl: adminUser.profile_image_url,
    jobTitle: adminUser.job_title,
    department: adminUser.department,
    phone: adminUser.phone,
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

    const updateData: Record<string, string | null> = { name: name.trim() };
    if (jobTitle !== undefined) updateData.job_title = jobTitle?.trim() || null;
    if (department !== undefined) updateData.department = department?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;

    const { error } = await supabase
      .from("admin_users")
      .update(updateData)
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

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * 프로필 이미지 업로드
 */
export async function uploadProfileImage(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !["admin", "consultant", "superadmin"].includes(role || "")) {
    return { success: false, error: "권한이 없습니다." };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "파일을 선택해주세요." };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { success: false, error: "지원하지 않는 이미지 형식입니다. (JPG, PNG, WebP, GIF)" };
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return { success: false, error: "이미지 크기는 5MB 이하여야 합니다." };
  }

  const supabase = await createSupabaseServerClient();
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `${userId}/avatar.${ext}`;

  // 기존 파일 삭제 (upsert 효과)
  await supabase.storage.from("admin-avatars").remove([filePath]);

  const { error: uploadError } = await supabase.storage
    .from("admin-avatars")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    return { success: false, error: "이미지 업로드에 실패했습니다." };
  }

  const { data: publicUrlData } = supabase.storage
    .from("admin-avatars")
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData.publicUrl;

  // DB에 URL 저장
  const { error: updateError } = await supabase
    .from("admin_users")
    .update({ profile_image_url: publicUrl })
    .eq("id", userId);

  if (updateError) {
    return { success: false, error: "프로필 이미지 URL 저장에 실패했습니다." };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");

  return { success: true, url: publicUrl };
}

/**
 * 프로필 이미지 삭제
 */
export async function deleteProfileImage(): Promise<{ success: boolean; error?: string }> {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !["admin", "consultant", "superadmin"].includes(role || "")) {
    return { success: false, error: "권한이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  // Storage에서 파일 삭제 (확장자를 모르므로 가능한 모든 확장자 시도)
  const extensions = ["jpg", "jpeg", "png", "webp", "gif"];
  const paths = extensions.map((ext) => `${userId}/avatar.${ext}`);
  await supabase.storage.from("admin-avatars").remove(paths);

  // DB에서 URL 제거
  const { error } = await supabase
    .from("admin_users")
    .update({ profile_image_url: null })
    .eq("id", userId);

  if (error) {
    return { success: false, error: "프로필 이미지 삭제에 실패했습니다." };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");

  return { success: true };
}
