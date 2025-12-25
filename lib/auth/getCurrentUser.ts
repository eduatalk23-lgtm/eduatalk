import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole, type CurrentUserRole } from "./getCurrentUserRole";
import { isRateLimitError, retryWithBackoff } from "@/lib/auth/rateLimitHandler";
import { analyzeAuthError, logAuthError } from "./errorHandlers";

export type CurrentUser = {
  userId: string;
  role: NonNullable<CurrentUserRole["role"]>;
  tenantId: string | null;
  email?: string | null;
};

/**
 * 현재 로그인한 사용자 정보를 조회합니다.
 * getCurrentUserRole을 확장하여 이메일 정보도 포함합니다.
 * 
 * React의 cache 함수를 사용하여 동일한 요청 내에서 중복 호출을 방지합니다.
 * (Next.js Request Memoization 활용)
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    
    // 먼저 직접 getUser()를 호출하여 refresh token 에러를 빠르게 감지
    // Supabase가 내부적으로 에러를 로깅하기 전에 처리하기 위함
    const initialResult = await supabase.auth.getUser();
    
    // 에러 처리: 공통 에러 분석 유틸리티 사용
    if (initialResult.error) {
      const errorInfo = analyzeAuthError(initialResult.error);
      
      // Refresh token 에러인 경우 즉시 반환 (재시도 불필요)
      if (errorInfo.isRefreshTokenError) {
        return null;
      }
      
      // Rate limit 에러인 경우 재시도는 아래에서 처리
      // (에러가 있어도 user가 없으면 null 반환)
      if (!isRateLimitError(initialResult.error)) {
        // Rate limit이 아닌 다른 에러 처리
        logAuthError("[auth] getCurrentUser: getUser", errorInfo);
        return null;
      }
    }
    
    // 정상적인 경우 계속 진행
    let user = initialResult.data.user;

    // Rate limit 재시도로 user를 획득한 경우
    if (initialResult.error && isRateLimitError(initialResult.error)) {
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
          return null;
        }
        
        // 다른 에러 처리: 공통 에러 분석 유틸리티 사용
        const errorInfo = analyzeAuthError(authError);
        logAuthError("[auth] getCurrentUser: getUser", errorInfo);
        return null;
      }
      
      if (!retriedUser) {
        return null;
      }
      
      user = retriedUser;
    }

    if (!user) {
      return null;
    }

    // user 객체를 getCurrentUserRole에 전달하여 중복 getUser 호출 방지
    const { userId, role, tenantId } = await getCurrentUserRole(user);

    if (!userId || !role) {
      // 프로덕션에서는 민감 정보(email, userId) 로깅 제외
      if (process.env.NODE_ENV === "development") {
        console.warn("[auth] getCurrentUser: userId 또는 role이 없음", {
          userId,
          role,
          userEmail: user.email,
          userIdFromAuth: user.id,
        });
      } else {
        console.warn("[auth] getCurrentUser: userId 또는 role이 없음", {
          hasUserId: !!userId,
          hasRole: !!role,
        });
      }
      return null;
    }

    return {
      userId,
      role,
      tenantId,
      email: user.email ?? null,
    };
  } catch (error) {
    // 에러 처리: 공통 에러 분석 유틸리티 사용
    const errorInfo = analyzeAuthError(error);
    if (!errorInfo.isRefreshTokenError) {
      logAuthError("[auth] getCurrentUser", errorInfo);
    }
    return null;
  }
});

