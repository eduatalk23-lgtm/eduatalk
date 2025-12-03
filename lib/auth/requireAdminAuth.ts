/**
 * 관리자 인증 요구 헬퍼
 * Server Actions에서 관리자(superadmin 또는 admin) 권한이 필요한 경우 사용
 */

import { getCurrentUserRole } from "./getCurrentUserRole";
import { AppError, ErrorCode } from "@/lib/errors";

/**
 * 현재 사용자가 관리자(superadmin 또는 admin)인지 확인하고, 사용자 정보를 반환합니다.
 * 관리자가 아니면 에러를 throw합니다.
 * 
 * @returns 관리자 사용자 정보
 * @throws AppError - 관리자가 아닌 경우 또는 로그인되지 않은 경우
 */
export async function requireAdminAuth(): Promise<{
  userId: string;
  role: "admin" | "superadmin";
  tenantId: string | null;
}> {
  const { userId, role, tenantId } = await getCurrentUserRole();

  if (!userId) {
    throw new AppError(
      "로그인이 필요합니다. 세션이 만료되었거나 사용자 정보를 찾을 수 없습니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  if (role !== "admin" && role !== "superadmin") {
    const errorMessage =
      role === null
        ? "사용자 역할을 확인할 수 없습니다. 다시 로그인해주세요."
        : role === "consultant"
        ? "관리자 권한이 필요합니다. 컨설턴트 권한으로는 이 작업을 수행할 수 없습니다."
        : "관리자 권한이 필요합니다.";

    throw new AppError(errorMessage, ErrorCode.FORBIDDEN, 403, true);
  }

  return {
    userId,
    role,
    tenantId,
  };
}


