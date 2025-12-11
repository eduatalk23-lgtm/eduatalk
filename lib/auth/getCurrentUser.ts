import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole, type CurrentUserRole } from "./getCurrentUserRole";
import { isRateLimitError, retryWithBackoff } from "@/lib/auth/rateLimitHandler";

export type CurrentUser = {
  userId: string;
  role: NonNullable<CurrentUserRole["role"]>;
  tenantId: string | null;
  email?: string | null;
};

/**
 * 현재 로그인한 사용자 정보를 조회합니다.
 * getCurrentUserRole을 확장하여 이메일 정보도 포함합니다.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
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
        return null;
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
            return null;
          }
          
          // 다른 에러 처리
          const errorMessage = authError.message?.toLowerCase() || "";
          const errorCode = authError.code?.toLowerCase() || "";
          
          const isUserNotFound =
            errorCode === "user_not_found" ||
            errorMessage.includes("user from sub claim") ||
            errorMessage.includes("user from sub claim in jwt does not exist") ||
            (authError.status === 403 && errorMessage.includes("does not exist"));
          
          if (!isUserNotFound) {
            console.error("[auth] getCurrentUser: getUser 실패", {
              message: authError.message,
              status: authError.status,
              code: authError.code,
            });
          }
          return null;
        }
        
        if (!user) {
          return null;
        }
        
        // user가 있으면 아래 로직 계속
      } else {
        // Rate limit이 아닌 다른 에러 처리
        const errorMessage = initialResult.error.message?.toLowerCase() || "";
        const errorCode = initialResult.error.code?.toLowerCase() || "";
        
        const isUserNotFound =
          errorCode === "user_not_found" ||
          errorMessage.includes("user from sub claim") ||
          errorMessage.includes("user from sub claim in jwt does not exist") ||
          (initialResult.error.status === 403 && errorMessage.includes("does not exist"));
        
        if (!isUserNotFound) {
          console.error("[auth] getCurrentUser: getUser 실패", {
            message: initialResult.error.message,
            status: initialResult.error.status,
            code: initialResult.error.code,
          });
        }
        return null;
      }
    }
    
    // 정상적인 경우 계속 진행
    const { user } = initialResult.data;

    if (!user) {
      return null;
    }

    const { userId, role, tenantId } = await getCurrentUserRole();

    if (!userId || !role) {
      console.warn("[auth] getCurrentUser: userId 또는 role이 없음", {
        userId,
        role,
        userEmail: user.email,
        userIdFromAuth: user.id,
      });
      return null;
    }

    return {
      userId,
      role,
      tenantId,
      email: user.email ?? null,
    };
  } catch (error) {
    // refresh token 에러는 조용히 처리
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRefreshTokenError = 
      errorMessage.toLowerCase().includes("refresh token") ||
      errorMessage.toLowerCase().includes("refresh_token") ||
      errorMessage.toLowerCase().includes("session");
    
    if (!isRefreshTokenError) {
      console.error("[auth] getCurrentUser 실패", error);
    }
    return null;
  }
}

