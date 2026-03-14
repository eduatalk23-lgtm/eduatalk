import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedUserRole, type UserRole } from "./getCurrentUserRole";
import { getStudentById } from "@/lib/data/students";

/**
 * 사용자 정보 파라미터 (선택적)
 * 이미 조회한 정보를 전달하면 중복 조회를 방지합니다.
 */
type UserInfoParams = {
  userId: string;
  role: UserRole;
  tenantId: string | null;
};

/**
 * 현재 로그인한 사용자의 이름을 조회합니다.
 * 역할에 따라 적절한 테이블에서 이름을 가져옵니다.
 *
 * @param userInfo - 이미 조회한 사용자 정보 (선택적, 전달 시 getCurrentUserRole 호출 생략)
 * @returns 사용자 이름 또는 null
 */
export const getCurrentUserName = cache(async (userInfo?: UserInfoParams): Promise<string | null> => {
  try {
    const supabase = await createSupabaseServerClient();

    // userInfo가 전달되면 재사용, 아니면 조회
    let userId: string | null;
    let role: UserRole;
    let tenantId: string | null;

    if (userInfo?.userId && userInfo?.role) {
      userId = userInfo.userId;
      role = userInfo.role;
      tenantId = userInfo.tenantId;
    } else {
      const currentUser = await getCachedUserRole();
      userId = currentUser.userId;
      role = currentUser.role;
      tenantId = currentUser.tenantId;
    }

    if (!userId || !role) {
      return null;
    }

    // Phase 3: user_profiles에서 이름 조회 (1-쿼리)
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();

    if (!profileError && profile?.name) {
      return profile.name;
    }

    // Fallback: 역할별 테이블에서 이름 조회 (user_profiles 미존재 시)
    if (role === "student") {
      const student = await getStudentById(userId, tenantId);
      return student?.name || null;
    }

    if (role === "admin" || role === "consultant" || role === "superadmin") {
      const { data: adminUser } = await supabase
        .from("admin_users")
        .select("name")
        .eq("id", userId)
        .maybeSingle();

      return adminUser?.name || null;
    }

    if (role === "parent") {
      const { data: parentUser } = await supabase
        .from("parent_users")
        .select("name")
        .eq("id", userId)
        .maybeSingle();

      return parentUser?.name || null;
    }

    return null;
  } catch (error) {
    // 프로덕션에서는 에러 객체 전체 로깅 제외 (스택 트레이스에 민감 정보 포함 가능)
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[getCurrentUserName] 사용자 이름 조회 실패:", errorMessage);
    return null;
  }
});





