import { cache } from "react";
import { getCurrentUserRole, type CurrentUserRole } from "./getCurrentUserRole";
import { getCachedAuthUser } from "./cachedGetUser";

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
 * getCachedAuthUser()를 사용하여 동일한 RSC 요청 내에서
 * getUser() 호출이 1회로 통합됩니다.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const user = await getCachedAuthUser();
  if (!user) return null;

  const { userId, role, tenantId } = await getCurrentUserRole(user);

  if (!userId || !role) {
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
});

