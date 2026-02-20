import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isRateLimitError,
  retryWithBackoff,
} from "@/lib/auth/rateLimitHandler";
import { analyzeAuthError, logAuthError } from "./errorHandlers";

/**
 * React.cache()로 래핑된 Supabase Auth getUser() 호출
 *
 * RSC 요청 내에서 여러 곳(getCurrentUser, getCurrentUserRole, getTenantContext)에서
 * 호출되더라도 실제 네트워크 요청은 1회만 실행됩니다.
 */
export const getCachedAuthUser = cache(async (): Promise<User | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const initialResult = await supabase.auth.getUser();

    if (initialResult.error) {
      const errorInfo = analyzeAuthError(initialResult.error);

      // Refresh token 에러 → 즉시 null 반환
      if (errorInfo.isRefreshTokenError) {
        return null;
      }

      // Rate limit → 재시도
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

      // 기타 에러
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
