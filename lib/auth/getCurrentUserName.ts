import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "./getCurrentUserRole";
import { getStudentById } from "@/lib/data/students";

/**
 * 현재 로그인한 사용자의 이름을 조회합니다.
 * 역할에 따라 적절한 테이블에서 이름을 가져옵니다.
 * 
 * @returns 사용자 이름 또는 null
 */
export const getCurrentUserName = cache(async (): Promise<string | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { userId, role, tenantId } = await getCurrentUserRole();

    if (!userId || !role) {
      return null;
    }

    // user_metadata에서 display_name 먼저 확인
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.user_metadata?.display_name) {
      return user.user_metadata.display_name as string;
    }

    // 역할별로 테이블에서 이름 조회
    if (role === "student") {
      // 테넌트 ID를 전달하여 보안 강화
      const student = await getStudentById(userId, tenantId);
      return student?.name || null;
    }

    if (role === "admin" || role === "consultant") {
      const { data: admin } = await supabase
        .from("admin_users")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (admin) {
        // users 테이블에서 이름 조회
        const { data: userData } = await supabase
          .from("users")
          .select("name")
          .eq("id", userId)
          .maybeSingle();

        return userData?.name || null;
      }
    }

    if (role === "parent") {
      // users 테이블에서 이름 조회
      const { data: userData } = await supabase
        .from("users")
        .select("name")
        .eq("id", userId)
        .maybeSingle();

      return userData?.name || null;
    }

    // superadmin의 경우 users 테이블에서 조회
    if (role === "superadmin") {
      const { data: userData } = await supabase
        .from("users")
        .select("name")
        .eq("id", userId)
        .maybeSingle();

      return userData?.name || null;
    }

    return null;
  } catch (error) {
    console.error("[getCurrentUserName] 사용자 이름 조회 실패:", error);
    return null;
  }
});



