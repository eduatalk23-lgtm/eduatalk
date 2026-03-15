import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isRateLimitError,
  retryWithBackoff,
} from "@/lib/auth/rateLimitHandler";
import { analyzeAuthError, logAuthError } from "./errorHandlers";

/**
 * proxy.ts가 주입한 x-auth-* 헤더에서 User 객체를 조립 (네트워크/파싱 0)
 *
 * proxy.ts가 JWT 파싱 또는 getUser() 후 검증된 결과를 헤더에 주입하므로
 * RSC/API Route에서 중복 auth 호출 없이 즉시 사용 가능.
 */
async function getUserFromAuthHeaders(): Promise<User | null> {
  try {
    const headerStore = await headers();
    const userId = headerStore.get("x-auth-user-id");
    if (!userId) return null;

    const email = headerStore.get("x-auth-email") ?? "";
    const role = headerStore.get("x-auth-role") ?? "";
    const tenantId = headerStore.get("x-auth-tenant-id") ?? "";

    return {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email,
      email_confirmed_at: undefined,
      phone: "",
      confirmed_at: undefined,
      app_metadata: {},
      user_metadata: {
        signup_role: role || undefined,
        tenant_id: tenantId || undefined,
      },
      identities: [],
      created_at: "",
      updated_at: "",
    } as User;
  } catch {
    return null;
  }
}

/**
 * Supabase 쿠키에서 JWT를 파싱하여 User 객체를 추출 (네트워크 호출 없음)
 *
 * proxy.ts가 매 요청마다 JWT를 검증/리프레시하므로 쿠키의 토큰은 항상 유효.
 * getSession() 대신 직접 파싱하여 Supabase 경고 메시지 완전 회피.
 *
 * @returns User 객체 또는 null (파싱 실패/만료 시)
 */
async function getUserFromJwtCookie(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const authCookies = cookieStore
      .getAll()
      .filter((c) => c.name.includes("auth-token"))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (authCookies.length === 0) return null;

    const combined = authCookies.map((c) => c.value).join("");
    // Supabase SSR v0.7+ 쿠키 포맷: "base64-{base64url인코딩된 세션JSON}"
    const sessionStr = combined.startsWith("base64-")
      ? Buffer.from(combined.substring(7), "base64url").toString()
      : combined;
    const session = JSON.parse(sessionStr);

    const accessToken = session?.access_token;
    if (!accessToken) return null;

    // JWT payload 디코딩 (base64url)
    const payloadPart = accessToken.split(".")[1];
    if (!payloadPart) return null;

    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString()
    );

    // 만료 체크
    const exp = payload.exp as number | undefined;
    if (exp && Math.floor(Date.now() / 1000) >= exp) return null;

    return {
      id: payload.sub,
      aud: payload.aud ?? "authenticated",
      role: payload.role ?? "authenticated",
      email: payload.email ?? "",
      email_confirmed_at: payload.email_confirmed_at,
      phone: payload.phone ?? "",
      confirmed_at: payload.confirmed_at,
      app_metadata: payload.app_metadata ?? {},
      user_metadata: payload.user_metadata ?? {},
      identities: [],
      created_at: "",
      updated_at: "",
    } as User;
  } catch {
    return null;
  }
}

/**
 * React.cache()로 래핑된 Supabase Auth 사용자 조회
 *
 * RSC 요청 내에서 여러 곳(getCurrentUser, getCurrentUserRole, getTenantContext)에서
 * 호출되더라도 실제 조회는 1회만 실행됩니다.
 *
 * 성능 최적화 (3단계 fallback):
 * 1. proxy.ts 주입 헤더 (네트워크 0, 파싱 0, ~0ms)
 * 2. JWT 쿠키 직접 파싱 (네트워크 0, ~1ms) — API Route 등 proxy 미경유 시
 * 3. getUser() 네트워크 호출 (~500-1000ms) — 최종 fallback
 */
export const getCachedAuthUser = cache(async (): Promise<User | null> => {
  try {
    // 1순위: proxy.ts가 주입한 헤더 (0ms, 네트워크 0)
    const headerUser = await getUserFromAuthHeaders();
    if (headerUser) {
      return headerUser;
    }

    // 2순위: JWT 쿠키 직접 파싱 (네트워크 호출 없음) — API Route 등 proxy 미경유 시
    const cookieUser = await getUserFromJwtCookie();
    if (cookieUser) {
      return cookieUser;
    }

    // 3순위: 쿠키 파싱 실패 → getUser()로 서버 검증
    if (process.env.NODE_ENV === "development") {
      console.log("[AUTH-DEBUG] getCachedAuthUser → getUser() 네트워크 호출");
    }
    const supabase = await createSupabaseServerClient();
    const initialResult = await supabase.auth.getUser();

    if (initialResult.error) {
      const errorInfo = analyzeAuthError(initialResult.error);

      if (errorInfo.isRefreshTokenError) {
        return null;
      }

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
          true
        );

        if (authError) {
          const retryErrorInfo = analyzeAuthError(authError);
          if (!retryErrorInfo.isRefreshTokenError) {
            logAuthError("[auth] getCachedAuthUser retry", retryErrorInfo);
          }
          return null;
        }

        return retriedUser;
      }

      logAuthError("[auth] getCachedAuthUser", errorInfo);
      return null;
    }

    return initialResult.data.user;
  } catch (error) {
    const errorInfo = analyzeAuthError(error);
    if (!errorInfo.isRefreshTokenError) {
      logAuthError("[auth] getCachedAuthUser", errorInfo);
    }
    return null;
  }
});
