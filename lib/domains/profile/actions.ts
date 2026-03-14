"use server";

/**
 * 통합 프로필 이미지 Server Actions
 *
 * 관리자, 학생, 학부모 공용으로 사용하는 프로필 이미지 업로드/삭제 액션.
 * 스토리지: user-avatars 버킷, 경로: {userId}/avatar.{ext}
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { revalidatePath } from "next/cache";
import {
  AVATAR_BUCKET,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
  ALLOWED_EXTENSIONS,
} from "./constants";

type ProfileImageResult = {
  success: boolean;
  url?: string;
  error?: string;
};

/** 역할별 DB 테이블과 revalidate 경로 매핑 */
const ROLE_CONFIG = {
  admin: { table: "admin_users", paths: ["/admin/settings", "/admin"] },
  consultant: { table: "admin_users", paths: ["/admin/settings", "/admin"] },
  superadmin: { table: "admin_users", paths: ["/admin/settings", "/admin"] },
  student: { table: "students", paths: ["/settings", "/dashboard"] },
  parent: { table: "user_profiles", paths: ["/parent/settings", "/parent/dashboard"] },
} as const;

type SupportedRole = keyof typeof ROLE_CONFIG;

function isSupportedRole(role: string | null): role is SupportedRole {
  return role !== null && role in ROLE_CONFIG;
}

/**
 * 프로필 이미지 업로드 (역할 자동 감지)
 */
export async function uploadProfileImage(
  formData: FormData
): Promise<ProfileImageResult> {
  const { userId, role } = await getCachedUserRole();

  if (!userId || !isSupportedRole(role)) {
    return { success: false, error: "권한이 없습니다." };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "파일을 선택해주세요." };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
    return {
      success: false,
      error: "지원하지 않는 이미지 형식입니다. (JPG, PNG, WebP, GIF)",
    };
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return { success: false, error: "이미지 크기는 5MB 이하여야 합니다." };
  }

  const supabase = await createSupabaseServerClient();
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `${userId}/avatar.${ext}`;

  // 모든 확장자의 기존 파일 삭제 (확장자 변경 시 잔여 파일 방지)
  const oldPaths = ALLOWED_EXTENSIONS.map((e) => `${userId}/avatar.${e}`);
  await supabase.storage.from(AVATAR_BUCKET).remove(oldPaths);

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    return { success: false, error: "이미지 업로드에 실패했습니다." };
  }

  const { data: publicUrlData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(filePath);

  // 캐시 버스팅: 같은 확장자로 재업로드 시 브라우저 캐시 방지
  const publicUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

  // DB에 URL 저장
  const config = ROLE_CONFIG[role];
  const { error: updateError } = await supabase
    .from(config.table)
    .update({ profile_image_url: publicUrl })
    .eq("id", userId);

  if (updateError) {
    return { success: false, error: "프로필 이미지 URL 저장에 실패했습니다." };
  }

  for (const path of config.paths) {
    revalidatePath(path);
  }

  return { success: true, url: publicUrl };
}

/**
 * 프로필 이미지 삭제 (역할 자동 감지)
 */
export async function deleteProfileImage(): Promise<ProfileImageResult> {
  const { userId, role } = await getCachedUserRole();

  if (!userId || !isSupportedRole(role)) {
    return { success: false, error: "권한이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  // 가능한 모든 확장자로 삭제 시도
  const paths = ALLOWED_EXTENSIONS.map((ext) => `${userId}/avatar.${ext}`);
  await supabase.storage.from(AVATAR_BUCKET).remove(paths);

  // DB에서 URL 제거
  const config = ROLE_CONFIG[role];
  const { error } = await supabase
    .from(config.table)
    .update({ profile_image_url: null })
    .eq("id", userId);

  if (error) {
    return { success: false, error: "프로필 이미지 삭제에 실패했습니다." };
  }

  for (const path of config.paths) {
    revalidatePath(path);
  }

  return { success: true };
}
