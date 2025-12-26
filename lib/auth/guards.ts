import { getCurrentUserRole } from "./getCurrentUserRole";
import { isAdminRole } from "./isAdminRole";
import { AppError, ErrorCode } from "@/lib/errors";

type AdminGuardOptions = {
  /**
   * tenantId가 반드시 있어야 하는 경우 true.
   * 기본값은 false이며, 필요한 경우 호출부에서 별도로 tenantContext를 조회할 수 있습니다.
   */
  requireTenant?: boolean;
};

export type AdminGuardResult = {
  userId: string;
  role: "admin" | "consultant" | "superadmin";
  tenantId: string | null;
};

/**
 * 관리자/컨설턴트 권한을 검증하고 사용자 정보를 반환합니다.
 */
export async function requireAdminOrConsultant(
  options: AdminGuardOptions = {}
): Promise<AdminGuardResult> {
  const { requireTenant = false } = options;
  const { userId, role, tenantId } = await getCurrentUserRole();

  if (!userId) {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  // isAdminRole 유틸리티 사용 (admin, consultant, superadmin 모두 포함)
  if (!isAdminRole(role)) {
    const errorMessage =
      role === null
        ? "사용자 역할을 확인할 수 없습니다. 다시 로그인해주세요."
        : "관리자 또는 컨설턴트 권한이 필요합니다.";

    throw new AppError(errorMessage, ErrorCode.FORBIDDEN, 403, true);
  }

  if (requireTenant && !tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // role이 null이 아니고 admin, consultant, superadmin 중 하나임을 보장
  // (isAdminRole 체크를 통과했으므로)
  return {
    userId,
    role: role as "admin" | "consultant" | "superadmin",
    tenantId
  };
}

export type SuperAdminGuardResult = {
  userId: string;
  role: "superadmin";
};

/**
 * Super Admin 권한을 검증하고 사용자 정보를 반환합니다.
 */
export async function requireSuperAdmin(): Promise<SuperAdminGuardResult> {
  const { userId, role } = await getCurrentUserRole();

  if (!userId) {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  if (role !== "superadmin") {
    throw new AppError(
      "Super Admin 권한이 필요합니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  return { userId, role: "superadmin" };
}

export type ParentGuardResult = {
  userId: string;
  role: "parent";
};

/**
 * 학부모 권한을 검증하고 사용자 정보를 반환합니다.
 */
export async function requireParent(): Promise<ParentGuardResult> {
  const { userId, role } = await getCurrentUserRole();

  if (!userId) {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  if (role !== "parent") {
    throw new AppError(
      "학부모 권한이 필요합니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  return { userId, role: "parent" };
}

export type AdminOnlyGuardResult = {
  userId: string;
  role: "admin" | "superadmin";
  tenantId: string | null;
};

/**
 * 관리자 권한(컨설턴트 제외)을 검증하고 사용자 정보를 반환합니다.
 * consultant는 제외되며, admin 또는 superadmin만 허용됩니다.
 */
export async function requireAdmin(): Promise<AdminOnlyGuardResult> {
  const { userId, role, tenantId } = await getCurrentUserRole();

  if (!userId) {
    throw new AppError(
      "로그인이 필요합니다.",
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

  return { userId, role, tenantId };
}

// 학생 권한 가드는 requireStudentAuth 사용 (더 완전한 정보 포함: tenantId, email)
export { requireStudentAuth, requireStudentAuth as requireStudent } from "./requireStudentAuth";

