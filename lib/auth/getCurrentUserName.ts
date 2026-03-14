import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedUserRole, type UserRole } from "./getCurrentUserRole";

type UserInfoParams = {
  userId: string;
  role: UserRole;
  tenantId: string | null;
};

/**
 * 현재 로그인한 사용자의 이름을 조회합니다.
 * user_profiles 테이블에서 1-쿼리로 조회합니다.
 */
export const getCurrentUserName = cache(async (userInfo?: UserInfoParams): Promise<string | null> => {
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

    if (!userId || !role) {
      return null;
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();

    return profile?.name ?? null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[getCurrentUserName] 사용자 이름 조회 실패:", errorMessage);
    return null;
  }
});
