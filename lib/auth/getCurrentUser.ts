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

    if (!user) {
      return null;
    }

    const { userId, role, tenantId } = await getCurrentUserRole();

    if (!userId || !role) {
      return null;
    }

    return {
      userId,
      role,
      tenantId,
      email: user.email ?? null,
    };
  } catch (error) {
    console.error("[auth] getCurrentUser 실패", error);
    return null;
  }
}

