import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
import { CACHE_TAGS, CACHE_REVALIDATE_TIME } from "@/lib/cache/cacheStrategy";

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

// ============================================
// JWT metadata에서 역할 추출 (proxy.ts와 동일 패턴)
// ============================================

/**
 * user_metadata에서 역할 추출 (DB 쿼리 0, 네트워크 0)
 *
 * proxy.ts의 getRoleFromMetadata()와 동일한 로직.
 * signup_role은 회원가입/초대 수락 시 설정되며,
 * admin, consultant, superadmin 포함 모든 역할을 커버.
 */
function getRoleFromMetadata(
  metadata: Record<string, unknown> | undefined | null,
): UserRole {
  const signupRole = metadata?.signup_role;
  if (
    signupRole === "student" ||
    signupRole === "parent" ||
    signupRole === "admin" ||
    signupRole === "consultant" ||
    signupRole === "superadmin"
  ) {
    return signupRole as UserRole;
  }
  return null;
}

// ============================================
// DB fallback: unstable_cache (metadata 없는 레거시 유저용)
// ============================================

/**
 * user_profiles에서 역할 조회 (unstable_cache 5분 캐싱)
 *
 * JWT metadata에 역할이 없는 레거시 유저 전용 fallback.
 * unstable_cache 내부 cookies() 불가 → admin client 사용.
 */
function getCrossRequestUserRole(
  userId: string,
): Promise<{ role: UserRole; tenantId: string | null } | null> {
  return unstable_cache(
    async () => {
      const supabase = createSupabaseAdminClient();
      if (!supabase) return null;

      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("role, tenant_id")
        .eq("id", userId)
        .maybeSingle();

      if (error || !profile?.role) return null;

      const role = profile.role as UserRole;
      return {
        role,
        tenantId: role === "superadmin" ? null : (profile.tenant_id ?? null),
      };
    },
    ["user-role", userId],
    {
      tags: [`${CACHE_TAGS.USER_ROLE}:${userId}`],
      revalidate: CACHE_REVALIDATE_TIME.MEDIUM,
    },
  )();
}

/**
 * user-role 캐시 무효화
 *
 * 역할 변경, 계정 비활성화 등에서 호출.
 */
export async function invalidateUserRoleCache(userId: string): Promise<void> {
  const { revalidateTag } = await import("next/cache");
  (revalidateTag as (tag: string) => void)(`${CACHE_TAGS.USER_ROLE}:${userId}`);
}

// ============================================
// getCurrentUserRole (기존 호환용, Server Action 등에서 사용)
// ============================================

/**
 * 현재 로그인한 사용자의 역할(role)을 조회합니다.
 * user_profiles 테이블에서 1-쿼리로 조회합니다.
 *
 * 주의: 가능하면 getCachedUserRole()을 사용하세요.
 * 이 함수는 JWT metadata를 사용하지 않으므로 DB 쿼리가 발생합니다.
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

// ============================================
// getCachedUserRole — 통합 auth 엔트리포인트
// ============================================

/**
 * proxy.ts 헤더 → JWT metadata → DB fallback 3단계 역할 조회
 *
 * 1순위: proxy.ts가 주입한 x-auth-* 헤더 (네트워크 0, 파싱 0, ~0ms)
 * 2순위: JWT metadata에서 추출 (네트워크 0, ~1ms)
 * 3순위: DB fallback (unstable_cache 5분)
 *
 * metadata에 역할이 없는 레거시 유저만 DB fallback.
 */
export const getCachedUserRole = cache(async (): Promise<CurrentUserRole> => {
  // 1순위: proxy.ts가 주입한 헤더에서 직접 읽기 (가장 빠름)
  // tenantId가 없으면 DB fallback 필요 → 헤더만으로 조기 리턴하지 않음
  try {
    const headerStore = await headers();
    const headerUserId = headerStore.get("x-auth-user-id");
    const headerRole = headerStore.get("x-auth-role");
    const headerTenantId = headerStore.get("x-auth-tenant-id") || null;
    if (headerUserId && headerRole && (headerRole === "superadmin" || headerTenantId)) {
      return {
        userId: headerUserId,
        role: headerRole as UserRole,
        tenantId: headerRole === "superadmin" ? null : headerTenantId,
      };
    }
  } catch {
    // headers() 사용 불가 (Edge Runtime 등), fallback 진행
  }

  // 2순위 이하: getCachedAuthUser() → metadata → DB fallback
  const user = await getCachedAuthUser();
  if (!user) {
    return { userId: null, role: null, tenantId: null };
  }

  // Fast path: JWT metadata에서 역할 추출 (proxy.ts와 동일, DB 쿼리 0)
  const metadataRole = getRoleFromMetadata(user.user_metadata);
  if (metadataRole) {
    const tenantId = (user.user_metadata as Record<string, unknown>)?.tenant_id as string | null ?? null;
    if (tenantId || metadataRole === "superadmin") {
      return {
        userId: user.id,
        role: metadataRole,
        tenantId: metadataRole === "superadmin" ? null : tenantId,
      };
    }
    // tenantId가 JWT에 없으면 DB에서 보충 (레거시 가입, metadata 미전파 등)
    const cached = await getCrossRequestUserRole(user.id);
    if (cached) {
      return {
        userId: user.id,
        role: metadataRole,
        tenantId: cached.tenantId,
      };
    }
  }

  // Slow path: metadata에 역할 없음 → DB fallback (unstable_cache 5분 캐싱)
  const cached = await getCrossRequestUserRole(user.id);
  if (cached?.role) {
    return {
      userId: user.id,
      role: cached.role,
      tenantId: cached.tenantId,
    };
  }

  // 최종 fallback: 기존 방식 (Server Action 등 호환)
  return getCurrentUserRole(user);
});
