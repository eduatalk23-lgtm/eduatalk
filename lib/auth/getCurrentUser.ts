import { cache } from "react";
import { getCachedUserRole, type CurrentUserRole } from "./getCurrentUserRole";
import { getCachedAuthUser } from "./cachedGetUser";

export type CurrentUser = {
  userId: string;
  role: NonNullable<CurrentUserRole["role"]>;
  tenantId: string | null;
  email?: string | null;
};

/**
 * 현재 로그인한 사용자 정보를 조회합니다.
 * getCachedUserRole()을 사용하여 동일한 RSC 요청 내에서
 * getUser() 1회 + user_profiles 쿼리 1회로 통합됩니다.
 *
 * 이전: getCurrentUserRole(user) 직접 호출 → getCachedUserRole()과 동시 사용 시 user_profiles 2회 쿼리
 * 현재: getCachedUserRole() 사용 → React.cache()로 중복 방지
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const { userId, role, tenantId } = await getCachedUserRole();

  if (!userId || !role) {
    return null;
  }

  // 이메일 정보는 getCachedAuthUser()에서 가져옴 (이미 캐시됨)
  const user = await getCachedAuthUser();

  return {
    userId,
    role,
    tenantId,
    email: user?.email ?? null,
  };
});

