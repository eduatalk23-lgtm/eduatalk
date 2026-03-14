import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isRateLimitError,
  type SupabaseErrorLike,
} from "@/lib/auth/rateLimitHandler";
import { analyzeAuthError, logAuthError } from "./errorHandlers";
import {
  extractSignupRole,
  extractTenantId,
  type SignupRole,
} from "@/lib/types/auth";
import { logActionDebug, logActionWarn } from "@/lib/utils/serverActionLogger";
import { getCachedAuthUser } from "./cachedGetUser";

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
  signupRole?: SignupRole;
};

/**
 * 현재 로그인한 사용자의 역할(role)을 조회합니다.
 * user_profiles 테이블에서 1-쿼리로 조회합니다.
 */
export async function getCurrentUserRole(
  prefetchedUser?: User | null
): Promise<CurrentUserRole> {
  try {
    const supabase = await createSupabaseServerClient();

    let user = prefetchedUser;

    if (!user) {
      const initialResult = await supabase.auth.getUser();

      if (initialResult.error) {
        const errorInfo = analyzeAuthError(initialResult.error);

        if (errorInfo.isRefreshTokenError) {
          return { userId: null, role: null, tenantId: null };
        }

        if (isRateLimitError(initialResult.error)) {
          logActionWarn("auth.getCurrentUserRole", `Rate limit 도달 - status:${(initialResult.error as SupabaseErrorLike).status}, code:${(initialResult.error as SupabaseErrorLike).code}`);
        } else {
          logAuthError("[auth] getUser", errorInfo);
        }

        return { userId: null, role: null, tenantId: null };
      } else {
        user = initialResult.data.user;
      }
    }

    if (!user) {
      return { userId: null, role: null, tenantId: null };
    }

    // user_profiles에서 역할 조회 (1-쿼리)
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, tenant_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role) {
      const profileRole = profile.role as UserRole;
      const profileTenantId = profileRole === "superadmin" ? null : (profile.tenant_id ?? null);
      return {
        userId: user.id,
        role: profileRole,
        tenantId: profileTenantId,
      };
    }

    // user_profiles에 없는 경우: signup_role fallback (신규 가입 직후)
    const signupRole = extractSignupRole(user.user_metadata);
    const tenantIdFromMetadata = extractTenantId(user.user_metadata);

    if (signupRole === "student" || signupRole === "parent") {
      if (process.env.NODE_ENV === "development") {
        logActionDebug("auth.getCurrentUserRole", `user_profiles 레코드 없음, signup_role fallback - userId:${user.id}, signupRole:${signupRole}`);
      }
      return {
        userId: user.id,
        role: signupRole,
        tenantId: tenantIdFromMetadata ?? null,
        signupRole: signupRole,
      };
    }

    logActionWarn("auth.getCurrentUserRole", `사용자 역할을 찾을 수 없음`);
    return { userId: user.id, role: null, tenantId: null };
  } catch (error) {
    const errorInfo = analyzeAuthError(error);
    if (!errorInfo.isRefreshTokenError) {
      logAuthError("[auth] getCurrentUserRole", errorInfo, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    return { userId: null, role: null, tenantId: null };
  }
}

/**
 * React.cache()로 래핑된 getCurrentUserRole
 */
export const getCachedUserRole = cache(async (): Promise<CurrentUserRole> => {
  const user = await getCachedAuthUser();
  if (!user) {
    return { userId: null, role: null, tenantId: null };
  }
  return getCurrentUserRole(user);
});
