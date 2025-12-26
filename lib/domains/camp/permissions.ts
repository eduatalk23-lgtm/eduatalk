/**
 * Camp Domain Permission Utilities
 *
 * 캠프 도메인 전용 권한 검증 유틸리티
 * - 통합된 권한 검증 함수 제공
 * - 일관된 에러 메시지
 * - 권한 검증 결과 타입 정의
 */

import { AppError, ErrorCode } from "@/lib/errors";
import { requireAdminOrConsultant, type AdminGuardResult } from "@/lib/auth/guards";
import { requireStudentAuth, type StudentAuthResult } from "@/lib/auth/requireStudentAuth";
import { requirePermission, type PermissionKey } from "@/lib/auth/permissions";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCampTemplate, getCampInvitation } from "@/lib/data/campTemplates";

// ============================================
// 타입 정의
// ============================================

/**
 * 캠프 관리자 권한 검증 결과
 */
export type CampAdminAuthResult = AdminGuardResult & {
  tenantId: string;
};

/**
 * 캠프 학생 권한 검증 결과
 */
export type CampStudentAuthResult = StudentAuthResult;

/**
 * 캠프 권한 키
 */
export type CampPermissionKey = Extract<
  PermissionKey,
  "camp.create" | "camp.update" | "camp.delete" | "camp.invite"
>;

// ============================================
// 관리자 권한 검증
// ============================================

/**
 * 캠프 관리자 권한 검증 (기본)
 *
 * 관리자/컨설턴트 역할과 테넌트 컨텍스트를 확인합니다.
 *
 * @throws {AppError} 권한이 없거나 테넌트 정보가 없는 경우
 */
export async function requireCampAdminAuth(): Promise<CampAdminAuthResult> {
  const authResult = await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  return {
    ...authResult,
    tenantId: tenantContext.tenantId,
  };
}

/**
 * 캠프 특정 권한 검증
 *
 * 특정 캠프 권한(create, update, delete, invite)을 확인합니다.
 *
 * @param permission - 확인할 권한 키
 * @throws {AppError} 권한이 없는 경우
 */
export async function requireCampPermission(
  permission: CampPermissionKey
): Promise<CampAdminAuthResult> {
  const permissionResult = await requirePermission(permission);

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  return {
    userId: permissionResult.userId,
    role: permissionResult.role as "admin" | "consultant" | "superadmin",
    tenantId: tenantContext.tenantId,
  };
}

// ============================================
// 템플릿 권한 검증
// ============================================

/**
 * 캠프 템플릿 접근 권한 검증
 *
 * 관리자 권한과 템플릿 소유권을 확인합니다.
 *
 * @param templateId - 템플릿 ID
 * @throws {AppError} 권한이 없거나 템플릿을 찾을 수 없는 경우
 */
export async function requireCampTemplateAccess(
  templateId: string
): Promise<CampAdminAuthResult & { templateId: string }> {
  // 관리자 권한 확인
  const authResult = await requireCampAdminAuth();

  // 템플릿 ID 검증
  if (!templateId || typeof templateId !== "string") {
    throw new AppError(
      "템플릿 ID가 올바르지 않습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 템플릿 존재 및 소유권 확인
  const template = await getCampTemplate(templateId);
  if (!template) {
    throw new AppError(
      "템플릿을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  if (template.tenant_id !== authResult.tenantId) {
    throw new AppError(
      "이 템플릿에 접근할 권한이 없습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  return {
    ...authResult,
    templateId,
  };
}

/**
 * 캠프 템플릿 생성 권한 검증
 */
export async function requireCampTemplateCreate(): Promise<CampAdminAuthResult> {
  return requireCampPermission("camp.create");
}

/**
 * 캠프 템플릿 수정 권한 검증
 *
 * @param templateId - 템플릿 ID
 */
export async function requireCampTemplateUpdate(
  templateId: string
): Promise<CampAdminAuthResult & { templateId: string }> {
  // 권한 확인
  const authResult = await requireCampPermission("camp.update");

  // 템플릿 접근 권한 확인
  const template = await getCampTemplate(templateId);
  if (!template) {
    throw new AppError(
      "템플릿을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  if (template.tenant_id !== authResult.tenantId) {
    throw new AppError(
      "이 템플릿을 수정할 권한이 없습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  return {
    ...authResult,
    templateId,
  };
}

/**
 * 캠프 템플릿 삭제 권한 검증
 *
 * @param templateId - 템플릿 ID
 */
export async function requireCampTemplateDelete(
  templateId: string
): Promise<CampAdminAuthResult & { templateId: string }> {
  // 권한 확인
  const authResult = await requireCampPermission("camp.delete");

  // 템플릿 접근 권한 확인
  const template = await getCampTemplate(templateId);
  if (!template) {
    throw new AppError(
      "템플릿을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  if (template.tenant_id !== authResult.tenantId) {
    throw new AppError(
      "이 템플릿을 삭제할 권한이 없습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  return {
    ...authResult,
    templateId,
  };
}

// ============================================
// 초대 권한 검증
// ============================================

/**
 * 캠프 초대 발송 권한 검증
 *
 * @param templateId - 템플릿 ID
 */
export async function requireCampInvitePermission(
  templateId: string
): Promise<CampAdminAuthResult & { templateId: string }> {
  // 초대 권한 확인
  const authResult = await requireCampPermission("camp.invite");

  // 템플릿 접근 권한 확인
  const template = await getCampTemplate(templateId);
  if (!template) {
    throw new AppError(
      "템플릿을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  if (template.tenant_id !== authResult.tenantId) {
    throw new AppError(
      "이 템플릿에 초대를 발송할 권한이 없습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  // 템플릿이 활성 상태인지 확인
  if (template.status === "archived") {
    throw new AppError(
      "보관된 템플릿에는 초대를 발송할 수 없습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  return {
    ...authResult,
    templateId,
  };
}

/**
 * 캠프 초대 접근 권한 검증 (관리자)
 *
 * @param invitationId - 초대 ID
 */
export async function requireCampInvitationAccess(
  invitationId: string
): Promise<CampAdminAuthResult & { invitationId: string; invitation: NonNullable<Awaited<ReturnType<typeof getCampInvitation>>> }> {
  // 관리자 권한 확인
  const authResult = await requireCampAdminAuth();

  // 초대 ID 검증
  if (!invitationId || typeof invitationId !== "string") {
    throw new AppError(
      "초대 ID가 올바르지 않습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 초대 존재 확인
  const invitation = await getCampInvitation(invitationId);
  if (!invitation) {
    throw new AppError(
      "초대를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 템플릿 소유권 확인
  const template = await getCampTemplate(invitation.camp_template_id);
  if (!template || template.tenant_id !== authResult.tenantId) {
    throw new AppError(
      "이 초대에 접근할 권한이 없습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  return {
    ...authResult,
    invitationId,
    invitation,
  };
}

// ============================================
// 학생 권한 검증
// ============================================

/**
 * 캠프 학생 권한 검증 (기본)
 *
 * 학생 역할을 확인합니다.
 *
 * @throws {AppError} 학생 권한이 없는 경우
 */
export async function requireCampStudentAuth(): Promise<CampStudentAuthResult> {
  return requireStudentAuth();
}

/**
 * 캠프 초대 접근 권한 검증 (학생)
 *
 * 학생 권한과 초대 소유권을 확인합니다.
 *
 * @param invitationId - 초대 ID
 * @throws {AppError} 권한이 없거나 초대를 찾을 수 없는 경우
 */
export async function requireStudentInvitationAccess(
  invitationId: string
): Promise<CampStudentAuthResult & { invitationId: string; invitation: NonNullable<Awaited<ReturnType<typeof getCampInvitation>>> }> {
  // 학생 권한 확인
  const authResult = await requireStudentAuth();

  // 초대 ID 검증
  if (!invitationId || typeof invitationId !== "string") {
    throw new AppError(
      "초대 ID가 올바르지 않습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 초대 존재 확인
  const invitation = await getCampInvitation(invitationId);
  if (!invitation) {
    throw new AppError(
      "초대를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 소유권 확인
  if (invitation.student_id !== authResult.userId) {
    throw new AppError(
      "이 초대에 접근할 권한이 없습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  return {
    ...authResult,
    invitationId,
    invitation,
  };
}

// ============================================
// 권한 확인 헬퍼 (비동기 권한 체크)
// ============================================

/**
 * 캠프 권한 확인 (에러 없이)
 *
 * 권한이 있는지 확인만 하고 에러를 throw하지 않습니다.
 *
 * @param permission - 확인할 권한 키
 * @returns 권한이 있으면 true, 없으면 false
 */
export async function hasCampPermission(
  permission: CampPermissionKey
): Promise<boolean> {
  try {
    await requireCampPermission(permission);
    return true;
  } catch {
    return false;
  }
}

/**
 * 캠프 템플릿 접근 권한 확인 (에러 없이)
 *
 * @param templateId - 템플릿 ID
 * @returns 접근 권한이 있으면 true, 없으면 false
 */
export async function canAccessCampTemplate(templateId: string): Promise<boolean> {
  try {
    await requireCampTemplateAccess(templateId);
    return true;
  } catch {
    return false;
  }
}

/**
 * 학생 초대 접근 권한 확인 (에러 없이)
 *
 * @param invitationId - 초대 ID
 * @returns 접근 권한이 있으면 true, 없으면 false
 */
export async function canAccessStudentInvitation(
  invitationId: string
): Promise<boolean> {
  try {
    await requireStudentInvitationAccess(invitationId);
    return true;
  } catch {
    return false;
  }
}
