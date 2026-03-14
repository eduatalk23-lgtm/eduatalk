import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedUserRole, type UserRole } from "./getCurrentUserRole";
import { getCachedAuthUser } from "./cachedGetUser";

type UserInfoParams = {
  userId: string;
  role: UserRole;
  tenantId: string | null;
};

export type UserProfile = {
  name: string | null;
  profileImageUrl: string | null;
  email: string | null;
};

/**
 * 현재 로그인한 사용자의 프로필 정보(이름, 프로필 이미지, 이메일)를 조회합니다.
 * 역할에 따라 적절한 테이블에서 가져옵니다.
 */
export const getCurrentUserProfile = cache(async (userInfo?: UserInfoParams): Promise<UserProfile> => {
  const empty: UserProfile = { name: null, profileImageUrl: null, email: null };

  try {
    const supabase = await createSupabaseServerClient();

    let userId: string | null;
    let role: UserRole;

    if (userInfo?.userId && userInfo?.role) {
      userId = userInfo.userId;
      role = userInfo.role;
    } else {
      const currentUser = await getCachedUserRole();
      userId = currentUser.userId;
      role = currentUser.role;
    }

    if (!userId || !role) return empty;

    // Phase 3: user_profiles에서 프로필 조회 (이메일 포함, auth.users 별도 조회 불필요)
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("name, profile_image_url, email")
      .eq("id", userId)
      .maybeSingle();

    if (!profileError && profile) {
      return {
        name: profile.name ?? null,
        profileImageUrl: profile.profile_image_url ?? null,
        email: profile.email ?? null,
      };
    }

    // Fallback: 역할별 테이블 조회 (user_profiles 미존재 시)
    const authUser = await getCachedAuthUser();
    const email = authUser?.email ?? null;

    if (role === "student") {
      const { data } = await supabase
        .from("students")
        .select("name, profile_image_url")
        .eq("id", userId)
        .maybeSingle();

      return {
        name: data?.name ?? null,
        profileImageUrl: data?.profile_image_url ?? null,
        email,
      };
    }

    if (role === "admin" || role === "consultant" || role === "superadmin") {
      const { data } = await supabase
        .from("admin_users")
        .select("name, profile_image_url")
        .eq("id", userId)
        .maybeSingle();

      return {
        name: data?.name ?? null,
        profileImageUrl: data?.profile_image_url ?? null,
        email,
      };
    }

    if (role === "parent") {
      const { data } = await supabase
        .from("parent_users")
        .select("name, profile_image_url")
        .eq("id", userId)
        .maybeSingle();

      return {
        name: data?.name ?? null,
        profileImageUrl: data?.profile_image_url ?? null,
        email,
      };
    }

    return { ...empty, email };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[getCurrentUserProfile] 프로필 조회 실패:", errorMessage);
    return empty;
  }
});
