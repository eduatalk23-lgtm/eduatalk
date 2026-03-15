import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isRateLimitError,
  retryWithBackoff,
} from "@/lib/auth/rateLimitHandler";
import { analyzeAuthError, logAuthError } from "./errorHandlers";

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
    const session = JSON.parse(Buffer.from(combined, "base64").toString());

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
 * 성능 최적화:
 * - JWT 쿠키 직접 파싱 우선 (네트워크 호출 없음, ~1ms)
 * - proxy.ts가 매 요청마다 JWT를 검증/리프레시하므로 쿠키의 토큰은 항상 유효
 * - 파싱 실패 시에만 getUser() 네트워크 호출로 폴백 (~500-1000ms)
 */
export const getCachedAuthUser = cache(async (): Promise<User | null> => {
  try {
    // Fast path: JWT 쿠키 직접 파싱 (네트워크 호출 없음)
    const cookieUser = await getUserFromJwtCookie();
    if (cookieUser) {
      return cookieUser;
    }

    // Slow path: 쿠키 파싱 실패 → getUser()로 서버 검증
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
