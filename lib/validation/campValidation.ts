/**
 * 캠프 관련 공통 검증 로직
 */

import { AppError, ErrorCode } from "@/lib/errors";
import { getCampTemplate } from "@/lib/data/campTemplates";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 템플릿 ID 검증
 */
export function validateCampTemplateId(templateId: string): void {
  if (!templateId || typeof templateId !== "string") {
    throw new AppError(
      "템플릿 ID가 올바르지 않습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }
}

/**
 * 초대 ID 검증
 */
export function validateCampInvitationId(invitationId: string): void {
  if (!invitationId || typeof invitationId !== "string") {
    throw new AppError(
      "초대 ID가 올바르지 않습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }
}

/**
 * 학생 ID 배열 검증
 */
export function validateStudentIds(studentIds: string[]): void {
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new AppError(
      "최소 1명 이상의 학생을 선택해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }
}

/**
 * 초대 ID 배열 검증
 */
export function validateInvitationIds(invitationIds: string[]): void {
  if (!Array.isArray(invitationIds) || invitationIds.length === 0) {
    throw new AppError(
      "재발송할 초대를 선택해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }
}

/**
 * 초대 상태 검증
 */
export function validateCampInvitationStatus(
  status: string
): status is "pending" | "accepted" | "declined" {
  if (!["pending", "accepted", "declined"].includes(status)) {
    throw new AppError(
      "올바른 상태를 선택해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }
  return true;
}

/**
 * 테넌트 컨텍스트 검증
 */
export async function validateTenantContext(): Promise<string> {
  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }
  return tenantContext.tenantId;
}

/**
 * 템플릿 존재 및 권한 확인
 */
export async function validateCampTemplateAccess(
  templateId: string,
  tenantId: string
): Promise<void> {
  const template = await getCampTemplate(templateId);
  if (!template) {
    throw new AppError(
      "템플릿을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  if (template.tenant_id !== tenantId) {
    throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
  }
}

/**
 * 템플릿 활성 상태 확인
 */
export async function validateCampTemplateActive(
  templateId: string,
  tenantId: string
): Promise<void> {
  await validateCampTemplateAccess(templateId, tenantId);
  
  const template = await getCampTemplate(templateId);
  if (!template) {
    // validateCampTemplateAccess에서 이미 확인했지만 타입 안전성을 위해
    throw new AppError(
      "템플릿을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  if (template.status !== "active") {
    const statusMessage =
      template.status === "archived"
        ? "보관된 템플릿에는 초대를 발송할 수 없습니다."
        : template.status === "draft"
        ? "초안 상태의 템플릿에는 초대를 발송할 수 없습니다. 템플릿을 활성화한 후 초대를 발송해주세요."
        : "활성 상태의 템플릿만 초대를 발송할 수 있습니다.";
    throw new AppError(statusMessage, ErrorCode.VALIDATION_ERROR, 400, true);
  }
}

/**
 * 초대 존재 및 권한 확인
 */
export async function validateCampInvitationAccess(
  invitationId: string,
  tenantId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data: invitation, error: checkError } = await supabase
    .from("camp_invitations")
    .select("id, tenant_id")
    .eq("id", invitationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (checkError) {
    throw new AppError(
      "초대 정보를 확인하는데 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: checkError.message }
    );
  }

  if (!invitation) {
    throw new AppError(
      "초대를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }
}

