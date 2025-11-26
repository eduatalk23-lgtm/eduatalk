/**
 * 테넌트 컨텍스트 요구 헬퍼
 * Server Actions에서 테넌트 정보가 필요한 경우 사용
 */

import { getTenantContext } from "./getTenantContext";
import { AppError, ErrorCode } from "@/lib/errors";

/**
 * 테넌트 컨텍스트를 조회하고, 없으면 에러를 throw합니다.
 * 
 * @returns 테넌트 컨텍스트
 * @throws AppError - 테넌트 정보를 찾을 수 없는 경우
 */
export async function requireTenantContext(): Promise<{
  tenantId: string;
  role: "admin" | "consultant" | "parent" | "student";
  userId: string;
}> {
  const context = await getTenantContext();

  if (!context) {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  if (!context.tenantId) {
    // Super Admin은 tenantId가 null일 수 있음
    if (context.role === "superadmin") {
      throw new AppError(
        "기관 정보가 필요합니다. Super Admin은 이 작업을 수행할 수 없습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    throw new AppError(
      "기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!context.userId) {
    throw new AppError(
      "사용자 정보를 찾을 수 없습니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  return {
    tenantId: context.tenantId,
    role: context.role as "admin" | "consultant" | "parent" | "student",
    userId: context.userId,
  };
}

/**
 * 학생 인증과 테넌트 컨텍스트를 함께 요구하는 헬퍼
 * 
 * @returns 학생 정보와 테넌트 컨텍스트
 */
export async function requireStudentWithTenant(): Promise<{
  userId: string;
  role: "student";
  tenantId: string;
  email?: string | null;
}> {
  const { requireStudentAuth } = await import("@/lib/auth/requireStudentAuth");
  const student = await requireStudentAuth();
  const tenant = await requireTenantContext();

  if (student.tenantId !== tenant.tenantId) {
    throw new AppError(
      "사용자와 기관 정보가 일치하지 않습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  return {
    userId: student.userId,
    role: "student",
    tenantId: tenant.tenantId,
    email: student.email,
  };
}

