import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface UserProfileData {
  name: string | null;
  is_active: boolean | null;
  profile_image_url: string | null;
}

/**
 * React.cache()로 래핑된 user_profiles 조회
 *
 * Admin Layout과 Calendar Page 등에서 동일 사용자의 프로필을 조회할 때
 * 요청 내 1회만 DB 쿼리를 실행합니다.
 */
export const getCachedUserProfile = cache(
  async (userId: string): Promise<UserProfileData | null> => {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("name, is_active, profile_image_url")
      .eq("id", userId)
      .maybeSingle();
    return data;
  },
);
