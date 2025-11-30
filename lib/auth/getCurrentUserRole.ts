import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isRateLimitError, retryWithBackoff } from "@/lib/auth/rateLimitHandler";

type UserRole = "student" | "consultant" | "admin" | "parent" | "superadmin" | null;

export type CurrentUserRole = {
  userId: string | null;
  role: UserRole;
  tenantId: string | null;
};

/**
 * 현재 로그인한 사용자의 역할(role)을 조회합니다.
 * 우선순위: admin/consultant (admin_users) > parent > student
 * @returns {Promise<CurrentUserRole>} userId와 role을 포함한 객체
 */
export async function getCurrentUserRole(): Promise<CurrentUserRole> {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Rate limit 에러 처리 및 재시도 (인증 요청이므로 더 긴 대기 시간)
    const {
      data: { user },
      error: authError,
    } = await retryWithBackoff(
      async () => {
        const result = await supabase.auth.getUser();
        if (result.error && isRateLimitError(result.error)) {
          throw result.error;
        }
        return result;
      },
      2,
      2000,
      true // 인증 요청 플래그
    );

    if (authError) {
      // Rate limit 에러 처리
      if (isRateLimitError(authError)) {
        console.warn("[auth] Rate limit 도달, 잠시 후 재시도합니다.", {
          status: authError.status,
          code: authError.code,
        });
        // Rate limit인 경우 null 반환 (재시도는 이미 retryWithBackoff에서 처리됨)
        return { userId: null, role: null, tenantId: null };
      }

      // 세션이 없거나 refresh token이 만료/손상된 것은 정상적인 상황일 수 있음 (로그인 페이지 등)
      // "Auth session missing", "Refresh Token" 관련 에러는 조용히 처리
      const errorMessage = authError.message?.toLowerCase() || "";
      const errorName = authError.name?.toLowerCase() || "";
      const isSessionMissing = 
        errorMessage.includes("session") ||
        errorMessage.includes("refresh token") ||
        errorMessage.includes("refresh_token") ||
        errorName === "authsessionmissingerror" ||
        errorName === "authapierror" && (
          errorMessage.includes("refresh token not found") ||
          errorMessage.includes("invalid refresh token") ||
          errorMessage.includes("refresh token expired")
        );
      
      if (!isSessionMissing) {
        // 세션/토큰 관련이 아닌 다른 에러만 로깅
        const errorDetails = {
          message: authError.message,
          status: authError.status,
          code: authError.code,
          name: authError.name,
        };
        console.error("[auth] getUser 실패", errorDetails);
      }
      
      return { userId: null, role: null, tenantId: null };
    }

    if (!user) {
      return { userId: null, role: null, tenantId: null };
    }

    // 1. admin_users 테이블에서 조회 (최우선)
    const selectAdmin = () =>
      supabase
        .from("admin_users")
        .select("id,role,tenant_id")
        .eq("id", user.id)
        .maybeSingle();

    let { data: admin, error: adminError } = await selectAdmin();

    if (adminError && adminError.code === "42703") {
      ({ data: admin, error: adminError } = await selectAdmin());
    }

    if (adminError && adminError.code !== "PGRST116") {
      // 에러 객체를 안전하게 직렬화하여 로깅
      const errorDetails = {
        code: adminError.code,
        message: adminError.message,
        details: adminError.details,
        hint: adminError.hint,
      };
      console.error("[auth] admin_users 조회 실패", errorDetails);
    }

    // admin_users에 레코드가 있으면 admin/consultant/superadmin 반환
    if (admin) {
      // superadmin인 경우 tenant_id는 null이어야 함
      if (admin.role === "superadmin") {
        return {
          userId: user.id,
          role: "superadmin",
          tenantId: null,
        };
      }
      return {
        userId: user.id,
        role: admin.role === "admin" || admin.role === "consultant" ? admin.role : "admin",
        tenantId: admin.tenant_id ?? null,
      };
    }

    // 2. parent_users 테이블에서 조회
    const selectParent = () =>
      supabase.from("parent_users").select("id").eq("id", user.id).maybeSingle();

    let { data: parent, error: parentError } = await selectParent();

    if (parentError && parentError.code === "42703") {
      ({ data: parent, error: parentError } = await selectParent());
    }

    if (parentError && parentError.code !== "PGRST116") {
      // 에러 객체를 안전하게 직렬화하여 로깅
      const errorDetails = {
        code: parentError.code,
        message: parentError.message,
        details: parentError.details,
        hint: parentError.hint,
      };
      console.error("[auth] parent_users 조회 실패", errorDetails);
    }

    // parent_users에 레코드가 있으면 parent 반환
    if (parent) {
      return {
        userId: user.id,
        role: "parent",
        tenantId: null,
      };
    }

    // 3. students 테이블에서 조회 (tenant_id 포함)
    const selectStudent = () =>
      supabase.from("students").select("id,tenant_id").eq("id", user.id).maybeSingle();

    let { data: student, error: studentError } = await selectStudent();

    if (studentError && studentError.code === "42703") {
      ({ data: student, error: studentError } = await selectStudent());
    }

    if (studentError && studentError.code !== "PGRST116") {
      // 에러 객체를 안전하게 직렬화하여 로깅
      const errorDetails = {
        code: studentError.code,
        message: studentError.message,
        details: studentError.details,
        hint: studentError.hint,
      };
      console.error("[auth] students 조회 실패", errorDetails);
    }

    // students에 레코드가 있으면 student 반환
    if (student) {
      return {
        userId: user.id,
        role: "student",
        tenantId: student.tenant_id ?? null,
      };
    }

    // 어떤 테이블에도 없으면 null 반환
    console.warn("[auth] 사용자 역할을 찾을 수 없음", { 
      userId: user.id,
      email: user.email,
      adminFound: !!admin,
      parentFound: !!parent,
      studentFound: !!student,
      studentError: studentError ? {
        code: studentError.code,
        message: studentError.message,
      } : null,
    });
    return { userId: user.id, role: null, tenantId: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[auth] getCurrentUserRole 실패", {
      message: errorMessage,
      stack: errorStack,
      error,
    });
    return { userId: null, role: null, tenantId: null };
  }
}

