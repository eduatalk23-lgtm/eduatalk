/**
 * 관리자 또는 컨설턴트 권한 체크 헬퍼
 */

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { AppError, ErrorCode } from "@/lib/errors";

/**
 * 관리자 또는 컨설턴트 권한을 확인하고, 권한이 없으면 에러를 throw합니다.
 * @returns 권한이 있는 경우 역할 정보 반환
 * @throws AppError 권한이 없는 경우
 */
export async function requireAdminOrConsultant(): Promise<{ role: string }> {
  const { role } = await getCurrentUserRole();
  
  if (role !== "admin" && role !== "consultant") {
    throw new AppError(
      "권한이 없습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }
  
  return { role };
}

