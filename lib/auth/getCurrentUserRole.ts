import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isRateLimitError,
  retryWithBackoff,
} from "@/lib/auth/rateLimitHandler";

export type UserRole =
  | "student"
  | "consultant"
  | "admin"
  | "parent"
  | "superadmin"
  | null;

/**
 * 회원가입 시 선택한 역할 타입
 */
export type SignupRole = "student" | "parent";

export type CurrentUserRole = {
  userId: string | null;
  role: UserRole;
  tenantId: string | null;
  /**
   * 회원가입 시 선택한 역할 (옵셔널)
   * Phase 1 fallback 로직에서 사용됨
   */
  signupRole?: SignupRole;
};

/**
 * 현재 로그인한 사용자의 역할(role)을 조회합니다.
 * 우선순위: admin/consultant (admin_users) > parent > student
 * @returns {Promise<CurrentUserRole>} userId와 role을 포함한 객체
 */
export async function getCurrentUserRole(): Promise<CurrentUserRole> {
  try {
    const supabase = await createSupabaseServerClient();

    // 먼저 직접 getUser()를 호출하여 refresh token 에러를 빠르게 감지
    // Supabase가 내부적으로 에러를 로깅하기 전에 처리하기 위함
    const initialResult = await supabase.auth.getUser();

    // Refresh token 에러인 경우 즉시 반환 (재시도 불필요)
    if (initialResult.error) {
      const errorMessage = initialResult.error.message?.toLowerCase() || "";
      const errorCode = initialResult.error.code?.toLowerCase() || "";

      const isRefreshTokenError =
        errorMessage.includes("refresh token") ||
        errorMessage.includes("refresh_token") ||
        errorMessage.includes("session") ||
        errorCode === "refresh_token_not_found";

      if (isRefreshTokenError) {
        // Refresh token 에러는 조용히 처리하고 null 반환
        return { userId: null, role: null, tenantId: null };
      }

      // Rate limit 에러인 경우에만 재시도
      if (isRateLimitError(initialResult.error)) {
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
            return { userId: null, role: null, tenantId: null };
          }

          // 다른 에러는 아래 로직에서 처리
          const errorMessage = authError.message?.toLowerCase() || "";
          const errorName = authError.name?.toLowerCase() || "";
          const errorCode = authError.code?.toLowerCase() || "";

          const isSessionMissing =
            errorMessage.includes("session") ||
            errorMessage.includes("refresh token") ||
            errorMessage.includes("refresh_token") ||
            errorName === "authsessionmissingerror" ||
            (errorName === "authapierror" &&
              (errorMessage.includes("refresh token not found") ||
                errorMessage.includes("invalid refresh token") ||
                errorMessage.includes("refresh token expired")));

          const isUserNotFound =
            errorCode === "user_not_found" ||
            errorMessage.includes("user from sub claim") ||
            errorMessage.includes(
              "user from sub claim in jwt does not exist"
            ) ||
            (authError.status === 403 &&
              errorMessage.includes("does not exist"));

          if (!isSessionMissing && !isUserNotFound) {
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

        // user가 있으면 아래 로직 계속
      } else {
        // Rate limit이 아닌 다른 에러는 아래 로직에서 처리
        const errorMessage = initialResult.error.message?.toLowerCase() || "";
        const errorName = initialResult.error.name?.toLowerCase() || "";
        const errorCode = initialResult.error.code?.toLowerCase() || "";

        const isSessionMissing =
          errorMessage.includes("session") ||
          errorMessage.includes("refresh token") ||
          errorMessage.includes("refresh_token") ||
          errorName === "authsessionmissingerror" ||
          (errorName === "authapierror" &&
            (errorMessage.includes("refresh token not found") ||
              errorMessage.includes("invalid refresh token") ||
              errorMessage.includes("refresh token expired")));

        const isUserNotFound =
          errorCode === "user_not_found" ||
          errorMessage.includes("user from sub claim") ||
          errorMessage.includes("user from sub claim in jwt does not exist") ||
          (initialResult.error.status === 403 &&
            errorMessage.includes("does not exist"));

        if (!isSessionMissing && !isUserNotFound) {
          const errorDetails = {
            message: initialResult.error.message,
            status: initialResult.error.status,
            code: initialResult.error.code,
            name: initialResult.error.name,
          };
          console.error("[auth] getUser 실패", errorDetails);
        }

        return { userId: null, role: null, tenantId: null };
      }
    }

    // 정상적인 경우 계속 진행
    const { user } = initialResult.data;

    if (!user) {
      return { userId: null, role: null, tenantId: null };
    }

    // user_metadata에서 signup_role과 tenant_id 미리 추출 (재사용)
    const signupRole = user.user_metadata?.signup_role as
      | string
      | null
      | undefined;
    const tenantIdFromMetadata = user.user_metadata?.tenant_id as
      | string
      | null
      | undefined;

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
      // 디버깅: admin_users에서 조회된 role 값 확인
      console.log("[getCurrentUserRole] admin_users 조회 결과:", {
        id: admin.id,
        role: admin.role,
        tenant_id: (admin as { tenant_id?: string | null })?.tenant_id,
      });

      // superadmin인 경우 tenant_id는 null이어야 함
      if (admin.role === "superadmin") {
        console.log("[getCurrentUserRole] superadmin으로 인식");
        return {
          userId: user.id,
          role: "superadmin",
          tenantId: null,
        };
      }
      console.log("[getCurrentUserRole] admin/consultant로 인식:", admin.role);
      return {
        userId: user.id,
        role:
          admin.role === "admin" || admin.role === "consultant"
            ? admin.role
            : "admin",
        tenantId: admin.tenant_id ?? null,
      };
    }

    // 2. parent_users 테이블에서 조회
    const selectParent = () =>
      supabase
        .from("parent_users")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

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
      supabase
        .from("students")
        .select("id,tenant_id")
        .eq("id", user.id)
        .maybeSingle();

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

    // 모든 테이블 조회 실패 시 user_metadata의 signup_role 확인 (fallback)
    if (!admin && !parent && !student) {
      if (signupRole === "student" || signupRole === "parent") {
        console.log("[auth] 테이블 레코드 없음, signup_role fallback 사용", {
          userId: user.id,
          signupRole,
          tenantIdFromMetadata,
        });
        return {
          userId: user.id,
          role: signupRole as "student" | "parent",
          tenantId: tenantIdFromMetadata ?? null,
          signupRole: signupRole as SignupRole,
        };
      }
    }

    // 어떤 테이블에도 없고 signup_role도 없으면 null 반환
    console.warn("[auth] 사용자 역할을 찾을 수 없음", {
      userId: user.id,
      email: user.email,
      adminFound: !!admin,
      parentFound: !!parent,
      studentFound: !!student,
      signupRole,
      studentError: studentError
        ? {
            code: studentError.code,
            message: studentError.message,
          }
        : null,
    });
    return { userId: user.id, role: null, tenantId: null };
  } catch (error) {
    // refresh token 에러는 조용히 처리
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRefreshTokenError =
      errorMessage.toLowerCase().includes("refresh token") ||
      errorMessage.toLowerCase().includes("refresh_token") ||
      errorMessage.toLowerCase().includes("session") ||
      (error instanceof Error &&
        "code" in error &&
        String(error.code).toLowerCase() === "refresh_token_not_found");

    if (!isRefreshTokenError) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error("[auth] getCurrentUserRole 실패", {
        message: errorMessage,
        stack: errorStack,
      });
    }

    return { userId: null, role: null, tenantId: null };
  }
}
