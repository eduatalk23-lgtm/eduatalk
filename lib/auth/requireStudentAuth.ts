/**
 * 학생 인증 요구 헬퍼
 * Server Actions에서 학생 권한이 필요한 경우 사용
 */

import { getCurrentUser } from "./getCurrentUser";
import { AppError, ErrorCode } from "@/lib/errors";

/**
 * 현재 사용자가 학생인지 확인하고, 학생 정보를 반환합니다.
 * 학생이 아니면 에러를 throw합니다.
 * 
 * @returns 학생 사용자 정보
 * @throws AppError - 학생이 아닌 경우 또는 로그인되지 않은 경우
 */
export async function requireStudentAuth(): Promise<{
  userId: string;
  role: "student";
  tenantId: string | null;
  email?: string | null;
}> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError(
      "로그인이 필요합니다. 세션이 만료되었거나 사용자 정보를 찾을 수 없습니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  if (user.role !== "student") {
    throw new AppError(
      "학생 권한이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      403,
      true
    );
  }

  return {
    userId: user.userId,
    role: "student",
    tenantId: user.tenantId,
    email: user.email,
  };
}

