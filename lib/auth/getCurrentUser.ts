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

    // refresh token 에러는 조용히 처리 (세션이 없는 것으로 간주)
    if (authError) {
      const errorMessage = authError.message?.toLowerCase() || "";
      const isRefreshTokenError = 
        errorMessage.includes("refresh token") ||
        errorMessage.includes("refresh_token") ||
        errorMessage.includes("session");
      
      // refresh token 에러가 아닌 경우에만 로깅
      if (!isRefreshTokenError) {
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

