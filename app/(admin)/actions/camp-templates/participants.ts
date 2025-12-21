"use server";

import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCampTemplate } from "@/lib/data/campTemplates";
import {
  AppError,
  ErrorCode,
  withErrorHandling,
  logError,
} from "@/lib/errors";
import type { CampInvitation } from "@/lib/domains/camp/types";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  validateCampTemplateId,
  validateStudentIds,
  validateInvitationIds,
  validateCampInvitationId,
  validateCampInvitationStatus,
  validateTenantContext,
  validateCampTemplateAccess,
  validateCampTemplateActive,
  validateCampInvitationAccess,
} from "@/lib/validation/campValidation";
import { buildCampInvitationStatusUpdate } from "@/lib/utils/campInvitationHelpers";
import {
  getCampInvitationsForTemplateWithPagination,
} from "@/lib/data/campTemplates";

/**
 * 학생 초대 발송
 */
export const sendCampInvitationsAction = withErrorHandling(
  async (
    templateId: string,
    studentIds: string[]
  ): Promise<{ success: boolean; error?: string; count?: number }> => {
    await requireAdminOrConsultant();

    // 입력값 검증
    validateCampTemplateId(templateId);
    validateStudentIds(studentIds);

    // 중복 제거
    const uniqueStudentIds = Array.from(new Set(studentIds));

    // 테넌트 컨텍스트 및 템플릿 권한 확인
    const tenantId = await validateTenantContext();
    await validateCampTemplateActive(templateId, tenantId);

    // Admin Client 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new AppError(
        "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    // 기존 초대 확인 (중복 방지)
    const { data: existingInvitations } = await supabase
      .from("camp_invitations")
      .select("student_id")
      .eq("camp_template_id", templateId)
      .eq("tenant_id", tenantId)
      .in("student_id", uniqueStudentIds);

    const existingStudentIds = new Set(
      (existingInvitations || []).map((inv) => inv.student_id)
    );

    // 새로 초대할 학생만 필터링
    const newStudentIds = uniqueStudentIds.filter(
      (id) => !existingStudentIds.has(id)
    );

    if (newStudentIds.length === 0) {
      return {
        success: true,
        count: 0,
        error: "모든 학생이 이미 초대되었습니다.",
      };
    }

    // 초대 생성 (expires_at: 초대 발송 후 7일)
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitations = newStudentIds.map((studentId) => ({
      tenant_id: tenantId,
      camp_template_id: templateId,
      student_id: studentId,
      status: "pending",
      expires_at: expiresAt.toISOString(),
    }));

    const { data: insertedInvitations, error } = await supabase
      .from("camp_invitations")
      .insert(invitations)
      .select("id");

    if (error) {
      logError(error, {
        function: "sendCampInvitationsAction",
        templateId,
        tenantId,
        action: "insertInvitations",
      });
      return { success: false, error: error.message };
    }

    // 이메일 알림 발송 (비동기, 실패해도 초대는 성공으로 처리)
    if (insertedInvitations && insertedInvitations.length > 0) {
      const { sendCampInvitationNotification } = await import(
        "@/lib/services/campNotificationService"
      );

      // 각 초대에 대해 이메일 발송 (병렬 처리)
      Promise.all(
        insertedInvitations.map((inv) =>
          sendCampInvitationNotification(inv.id).catch((err) => {
            logError(err, {
              function: "sendCampInvitationsAction",
              invitationId: inv.id,
              action: "sendCampInvitationNotification",
            });
          })
        )
      ).catch((err) => {
        logError(err, {
          function: "sendCampInvitationsAction",
          templateId,
          action: "batchEmailNotification",
        });
      });
    }

    return { success: true, count: newStudentIds.length };
  }
);

/**
 * 템플릿별 캠프 초대 목록 조회
 */
export const getCampInvitationsForTemplate = withErrorHandling(
  async (templateId: string) => {
    await requireAdminOrConsultant();

    // 입력값 검증
    validateCampTemplateId(templateId);
    const tenantId = await validateTenantContext();

    // 템플릿 존재 확인 (템플릿이 없어도 초대 목록은 조회 가능 - 삭제된 템플릿의 초대도 볼 수 있어야 함)
    const template = await getCampTemplate(templateId);
    if (template) {
      // 템플릿이 존재하는 경우, 권한 확인
      await validateCampTemplateAccess(templateId, tenantId);
    }
    // 템플릿이 없는 경우 (삭제된 경우 등)에도 초대 목록은 조회 가능
    // 초대 목록 자체가 tenant_id로 필터링되므로 보안 문제 없음

    // Admin Client 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new AppError(
        "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    // 초대 목록 조회 (tenant_id로 필터링하여 권한 확인)
    const { data: invitations, error } = await supabase
      .from("camp_invitations")
      .select(
        `
        *,
        students:student_id (
          name,
          grade,
          class
        )
      `
      )
      .eq("camp_template_id", templateId)
      .eq("tenant_id", tenantId)
      .order("invited_at", { ascending: false });

    if (error) {
      console.error("[campTemplateActions] 초대 목록 조회 실패", error);
      return { success: true, invitations: [] };
    }

    // 학생 정보를 평탄화
    type InvitationWithStudent = CampInvitation & {
      students?: {
        name: string | null;
        grade: number | null;
        class: string | null;
      } | null;
    };
    
    const formattedInvitations = (invitations || []).map((invitation: InvitationWithStudent) => ({
      ...invitation,
      student_name: invitation.students?.name ?? null,
      student_grade: invitation.students?.grade ?? null,
      student_class: invitation.students?.class ?? null,
    }));

    return { success: true, invitations: formattedInvitations };
  }
);

/**
 * 템플릿별 캠프 초대 목록 조회 (페이지네이션 지원, 서버 사이드 필터링)
 */
export const getCampInvitationsForTemplateWithPaginationAction = withErrorHandling(
  async (
    templateId: string,
    page: number = 1,
    pageSize: number = 20,
    filters?: {
      search?: string;
      status?: string;
    }
  ) => {
    await requireAdminOrConsultant();

    // 입력값 검증
    validateCampTemplateId(templateId);
    const tenantId = await validateTenantContext();

    // 페이지네이션된 초대 목록 조회 (필터 적용)
    const result = await getCampInvitationsForTemplateWithPagination(
      templateId,
      tenantId,
      {
        page,
        pageSize,
        filters,
      }
    );

    return {
      success: true,
      invitations: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
);

/**
 * 캠프 초대 상태 수동 변경
 */
export const updateCampInvitationStatusAction = withErrorHandling(
  async (
    invitationId: string,
    status: "pending" | "accepted" | "declined"
  ): Promise<{ success: boolean; error?: string }> => {
    await requireAdminOrConsultant();

    // 입력값 검증
    validateCampInvitationId(invitationId);
    validateCampInvitationStatus(status);

    // 테넌트 컨텍스트 및 초대 권한 확인
    const tenantId = await validateTenantContext();
    await validateCampInvitationAccess(invitationId, tenantId);

    // Admin Client 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new AppError(
        "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    // 상태 업데이트 데이터 준비
    const updateData = buildCampInvitationStatusUpdate(status);

    // 상태 업데이트
    const { data: updatedRows, error: updateError } = await supabase
      .from("camp_invitations")
      .update(updateData)
      .eq("id", invitationId)
      .eq("tenant_id", tenantId)
      .select();

    if (updateError) {
      throw new AppError(
        "초대 상태 변경에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: updateError.message }
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      throw new AppError(
        "초대를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    return { success: true };
  }
);

/**
 * 캠프 초대 삭제
 */
export const deleteCampInvitationAction = withErrorHandling(
  async (
    invitationId: string
  ): Promise<{ success: boolean; error?: string }> => {
    await requireAdminOrConsultant();

    // 입력값 검증
    if (!invitationId || typeof invitationId !== "string") {
      throw new AppError(
        "초대 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 초대 존재 및 권한 확인 (강화된 검증)
    const { getCampInvitation } = await import("@/lib/data/campTemplates");
    const invitation = await getCampInvitation(invitationId);
    if (!invitation) {
      throw new AppError(
        "초대를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 템플릿 권한 확인
    const template = await getCampTemplate(invitation.camp_template_id);
    if (!template) {
      throw new AppError(
        "템플릿을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (template.tenant_id !== tenantContext.tenantId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const { deleteCampInvitation } = await import("@/lib/data/campTemplates");
    const result = await deleteCampInvitation(invitationId);

    if (!result.success) {
      throw new AppError(
        result.error || "초대 삭제에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    return result;
  }
);

/**
 * 캠프 초대 일괄 삭제
 */
export const deleteCampInvitationsAction = withErrorHandling(
  async (
    invitationIds: string[]
  ): Promise<{ success: boolean; error?: string; count?: number }> => {
    await requireAdminOrConsultant();

    // 입력값 검증
    if (!invitationIds || invitationIds.length === 0) {
      throw new AppError(
        "삭제할 초대를 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 모든 초대의 템플릿 권한 확인
    const { getCampInvitation } = await import("@/lib/data/campTemplates");
    const invitations = await Promise.all(
      invitationIds.map((id) => getCampInvitation(id))
    );

    const validInvitations = invitations.filter(Boolean);
    if (validInvitations.length !== invitationIds.length) {
      throw new AppError(
        "일부 초대를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 템플릿 권한 확인
    const templateIds = new Set(
      validInvitations.map((inv) => inv!.camp_template_id)
    );
    const templates = await Promise.all(
      Array.from(templateIds).map((id) => getCampTemplate(id))
    );

    const invalidTemplates = templates.some(
      (t) => !t || t.tenant_id !== tenantContext.tenantId
    );
    if (invalidTemplates) {
      throw new AppError(
        "권한이 없는 초대가 포함되어 있습니다.",
        ErrorCode.FORBIDDEN,
        403,
        true
      );
    }

    const { deleteCampInvitations } = await import("@/lib/data/campTemplates");
    const result = await deleteCampInvitations(invitationIds);

    if (!result.success) {
      throw new AppError(
        result.error || "초대 삭제에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    return result;
  }
);

/**
 * 캠프 초대 재발송
 */
export const resendCampInvitationsAction = withErrorHandling(
  async (
    templateId: string,
    invitationIds: string[]
  ): Promise<{ success: boolean; error?: string; count?: number }> => {
    await requireAdminOrConsultant();

    // 입력값 검증
    validateCampTemplateId(templateId);
    validateInvitationIds(invitationIds);

    // 중복 제거
    const uniqueInvitationIds = Array.from(new Set(invitationIds));

    // 테넌트 컨텍스트 및 템플릿 권한 확인
    const tenantId = await validateTenantContext();
    await validateCampTemplateActive(templateId, tenantId);

    // 초대 조회 및 학생 ID 추출
    const { getCampInvitation } = await import("@/lib/data/campTemplates");
    const invitations = await Promise.all(
      uniqueInvitationIds.map((id) => getCampInvitation(id))
    );

    const validInvitations = invitations.filter(Boolean);
    if (validInvitations.length === 0) {
      throw new AppError(
        "유효한 초대를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 모든 초대가 같은 템플릿인지 확인
    const allSameTemplate = validInvitations.every(
      (inv) => inv!.camp_template_id === templateId
    );
    if (!allSameTemplate) {
      throw new AppError(
        "같은 템플릿의 초대만 재발송할 수 있습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const studentIds = validInvitations.map((inv) => inv!.student_id);

    // 기존 초대 삭제 후 재발송
    const { deleteCampInvitations } = await import("@/lib/data/campTemplates");
    const deleteResult = await deleteCampInvitations(uniqueInvitationIds);
    if (!deleteResult.success) {
      throw new AppError(
        "기존 초대 삭제에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    // 재발송
    const result = await sendCampInvitationsAction(templateId, studentIds);

    return result;
  }
);

