import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isRateLimitError,
  retryWithBackoff,
} from "@/lib/auth/rateLimitHandler";
import { analyzeAuthError, logAuthError } from "./errorHandlers";
import {
  extractSignupRole,
  extractTenantId,
  type SignupRole,
} from "@/lib/types/auth";

export type UserRole =
  | "student"
  | "consultant"
  | "admin"
  | "parent"
  | "superadmin"
  | null;

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
 * Admin 역할 조회
 */
async function fetchAdminRole(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  role: "admin" | "consultant" | "superadmin";
  tenantId: string | null;
} | null> {
  const selectAdmin = () =>
    supabase
      .from("admin_users")
      .select("id,role,tenant_id")
      .eq("id", userId)
      .maybeSingle();

  let { data: admin, error: adminError } = await selectAdmin();

  // 컬럼이 존재하지 않는 경우 재시도 (마이그레이션 중 발생 가능)
  if (adminError && adminError.code === "42703") {
    ({ data: admin, error: adminError } = await selectAdmin());
  }

  if (adminError && adminError.code !== "PGRST116") {
    const errorDetails = {
      code: adminError.code,
      message: adminError.message,
      details: adminError.details,
      hint: adminError.hint,
    };
    console.error("[auth] admin_users 조회 실패", errorDetails);
  }

  if (!admin) {
    return null;
  }

  // 개발 환경에서만 로깅
  if (process.env.NODE_ENV === "development") {
    console.log("[getCurrentUserRole] admin_users 조회 결과:", {
      id: admin.id,
      role: admin.role,
      tenant_id: (admin as { tenant_id?: string | null })?.tenant_id,
    });
  }

  // superadmin인 경우 tenant_id는 null이어야 함
  if (admin.role === "superadmin") {
    if (process.env.NODE_ENV === "development") {
      console.log("[getCurrentUserRole] superadmin으로 인식");
    }
    return {
      role: "superadmin",
      tenantId: null,
    };
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[getCurrentUserRole] admin/consultant로 인식:", admin.role);
  }

  return {
    role:
      admin.role === "admin" || admin.role === "consultant"
        ? admin.role
        : "admin",
    tenantId: admin.tenant_id ?? null,
  };
}

/**
 * Parent 역할 조회
 */
async function fetchParentRole(
  supabase: SupabaseClient,
  userId: string
): Promise<{ role: "parent"; tenantId: null } | null> {
  const selectParent = () =>
    supabase
      .from("parent_users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

  let { data: parent, error: parentError } = await selectParent();

  // 컬럼이 존재하지 않는 경우 재시도 (마이그레이션 중 발생 가능)
  if (parentError && parentError.code === "42703") {
    ({ data: parent, error: parentError } = await selectParent());
  }

  if (parentError && parentError.code !== "PGRST116") {
    const errorDetails = {
      code: parentError.code,
      message: parentError.message,
      details: parentError.details,
      hint: parentError.hint,
    };
    console.error("[auth] parent_users 조회 실패", errorDetails);
  }

  if (!parent) {
    return null;
  }

  return {
    role: "parent",
    tenantId: null,
  };
}

/**
 * Student 역할 조회
 */
async function fetchStudentRole(
  supabase: SupabaseClient,
  userId: string
): Promise<{ role: "student"; tenantId: string | null } | null> {
  const selectStudent = () =>
    supabase
      .from("students")
      .select("id,tenant_id")
      .eq("id", userId)
      .maybeSingle();

  let { data: student, error: studentError } = await selectStudent();

  // 컬럼이 존재하지 않는 경우 재시도 (마이그레이션 중 발생 가능)
  if (studentError && studentError.code === "42703") {
    ({ data: student, error: studentError } = await selectStudent());
  }

  if (studentError && studentError.code !== "PGRST116") {
    const errorDetails = {
      code: studentError.code,
      message: studentError.message,
      details: studentError.details,
      hint: studentError.hint,
    };
    console.error("[auth] students 조회 실패", errorDetails);
  }

  if (!student) {
    return null;
  }

  return {
    role: "student",
    tenantId: student.tenant_id ?? null,
  };
}

/**
 * 현재 로그인한 사용자의 역할(role)을 조회합니다.
 * 우선순위: admin/consultant (admin_users) > parent > student
 * @param prefetchedUser - 미리 조회한 User 객체 (선택적, 전달 시 getUser 호출 건너뜀)
 * @returns {Promise<CurrentUserRole>} userId와 role을 포함한 객체
 */
export async function getCurrentUserRole(
  prefetchedUser?: User | null
): Promise<CurrentUserRole> {
  try {
    const supabase = await createSupabaseServerClient();

    let user = prefetchedUser;
    let initialResult: { data: { user: User | null }; error: unknown } | null = null;

    // prefetchedUser가 없으면 getUser() 호출
    if (!user) {
      // 먼저 직접 getUser()를 호출하여 refresh token 에러를 빠르게 감지
      // Supabase가 내부적으로 에러를 로깅하기 전에 처리하기 위함
      initialResult = await supabase.auth.getUser();

      // 에러 처리: 공통 에러 분석 유틸리티 사용
      if (initialResult.error) {
        const errorInfo = analyzeAuthError(initialResult.error);

        // Refresh token 에러인 경우 즉시 반환 (재시도 불필요)
        if (errorInfo.isRefreshTokenError) {
          return { userId: null, role: null, tenantId: null };
        }

        // Rate limit 에러인 경우에만 재시도
        if (isRateLimitError(initialResult.error)) {
          const {
            data: { user: retriedUser },
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

            // 다른 에러 처리: 공통 에러 분석 유틸리티 사용
            const errorInfo = analyzeAuthError(authError);
            logAuthError("[auth] getUser", errorInfo);
            return { userId: null, role: null, tenantId: null };
          }

          if (!retriedUser) {
            return { userId: null, role: null, tenantId: null };
          }

          user = retriedUser;
        } else {
          // Rate limit이 아닌 다른 에러 처리: 공통 에러 분석 유틸리티 사용
          const errorInfo = analyzeAuthError(initialResult.error);
          logAuthError("[auth] getUser", errorInfo);
          return { userId: null, role: null, tenantId: null };
        }
      } else {
        // 정상적인 경우 계속 진행
        user = initialResult.data.user;
      }
    }

    if (!user) {
      return { userId: null, role: null, tenantId: null };
    }

    // user_metadata에서 signup_role과 tenant_id 미리 추출 (타입 가드 사용)
    const signupRole = extractSignupRole(user.user_metadata);
    const tenantIdFromMetadata = extractTenantId(user.user_metadata);

    // 1. admin_users 테이블에서 조회 (최우선)
    const adminRole = await fetchAdminRole(supabase, user.id);
    if (adminRole) {
      return {
        userId: user.id,
        role: adminRole.role,
        tenantId: adminRole.tenantId,
      };
    }

    // 2. parent_users 테이블에서 조회
    const parentRole = await fetchParentRole(supabase, user.id);
    if (parentRole) {
      return {
        userId: user.id,
        role: parentRole.role,
        tenantId: parentRole.tenantId,
      };
    }

    // 3. students 테이블에서 조회 (tenant_id 포함)
    const studentRole = await fetchStudentRole(supabase, user.id);
    if (studentRole) {
      return {
        userId: user.id,
        role: studentRole.role,
        tenantId: studentRole.tenantId,
      };
    }

    // 모든 테이블 조회 실패 시 user_metadata의 signup_role 확인 (fallback)
    if (signupRole === "student" || signupRole === "parent") {
      if (process.env.NODE_ENV === "development") {
        console.log("[auth] 테이블 레코드 없음, signup_role fallback 사용", {
          userId: user.id,
          signupRole,
          tenantIdFromMetadata,
        });
      }
      return {
        userId: user.id,
        role: signupRole, // 타입 가드로 이미 SignupRole 타입 보장됨
        tenantId: tenantIdFromMetadata ?? null,
        signupRole: signupRole, // 타입 가드로 이미 SignupRole 타입 보장됨
      };
    }

    // 어떤 테이블에도 없고 signup_role도 없으면 null 반환
    console.warn("[auth] 사용자 역할을 찾을 수 없음", {
      userId: user.id,
      email: user.email,
      adminFound: !!adminRole,
      parentFound: !!parentRole,
      studentFound: !!studentRole,
      signupRole,
    });
    return { userId: user.id, role: null, tenantId: null };
  } catch (error) {
    // 에러 처리: 공통 에러 분석 유틸리티 사용
    const errorInfo = analyzeAuthError(error);
    if (!errorInfo.isRefreshTokenError) {
      logAuthError("[auth] getCurrentUserRole", errorInfo, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    return { userId: null, role: null, tenantId: null };
  }
}
