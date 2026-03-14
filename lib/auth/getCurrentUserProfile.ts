import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedUserRole, type UserRole } from "./getCurrentUserRole";

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
 * 현재 로그인한 사용자의 프로필 정보를 조회합니다.
 * user_profiles 테이블에서 1-쿼리로 이름, 프로필 이미지, 이메일을 조회합니다.
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

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("name, profile_image_url, email")
      .eq("id", userId)
      .maybeSingle();

    if (profile) {
      return {
        name: profile.name ?? null,
        profileImageUrl: profile.profile_image_url ?? null,
        email: profile.email ?? null,
      };
    }

    return empty;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[getCurrentUserProfile] 프로필 조회 실패:", errorMessage);
    return empty;
  }
});
