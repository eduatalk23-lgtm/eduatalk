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
  validateCampInvitationNotExpired,
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
  ): Promise<{ success: boolean; error?: string; count?: number; failedNotifications?: number }> => {
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

    // 이메일 알림 발송 (결과 추적 및 DB 업데이트)
    let failedNotifications = 0;
    if (insertedInvitations && insertedInvitations.length > 0) {
      const { sendCampInvitationNotification } = await import(
        "@/lib/services/campNotificationService"
      );

      // 각 초대에 대해 이메일 발송 (병렬 처리, 결과 추적)
      const notificationResults = await Promise.allSettled(
        insertedInvitations.map((inv) => sendCampInvitationNotification(inv.id))
      );

      // 성공/실패 분리
      const now = new Date().toISOString();
      const successIds: string[] = [];
      const failedUpdates: { id: string; error: string }[] = [];

      notificationResults.forEach((result, index) => {
        const invitationId = insertedInvitations[index].id;
        if (result.status === "fulfilled") {
          successIds.push(invitationId);
        } else {
          const errorMessage = result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
          failedUpdates.push({ id: invitationId, error: errorMessage });
          logError(result.reason, {
            function: "sendCampInvitationsAction",
            invitationId,
            action: "sendCampInvitationNotification",
          });
        }
      });

      // 성공한 알림 상태 업데이트
      if (successIds.length > 0) {
        await supabase
          .from("camp_invitations")
          .update({
            notification_status: "sent",
            notification_sent_at: now,
            notification_attempts: 1,
          })
          .in("id", successIds);
      }

      // 실패한 알림 상태 업데이트
      for (const { id, error } of failedUpdates) {
        await supabase
          .from("camp_invitations")
          .update({
            notification_status: "failed",
            notification_error: error.substring(0, 500), // 에러 메시지 길이 제한
            notification_attempts: 1,
          })
          .eq("id", id);
      }

      failedNotifications = failedUpdates.length;
    }

    return {
      success: true,
      count: newStudentIds.length,
      failedNotifications: failedNotifications > 0 ? failedNotifications : undefined,
    };
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

    // P1 개선: 수락 시 만료 여부 확인
    if (status === "accepted") {
      await validateCampInvitationNotExpired(invitationId, tenantId);
    }

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

/**
 * 캠프 참여자 목록 조회 (서버 액션)
 * 관리자가 참여자 목록을 조회할 수 있도록 Admin Client 사용
 */
export const getCampParticipantsAction = withErrorHandling(
  async (templateId: string): Promise<{
    success: boolean;
    participants?: Array<{
      invitation_id: string;
      student_id: string;
      student_name: string;
      student_grade: string | null;
      student_class: string | null;
      invitation_status: string;
      display_status?: string;
      plan_group_id: string | null;
      plan_group_name: string | null;
      plan_group_status: string | null;
      hasPlans: boolean;
      invited_at: string;
      accepted_at: string | null;
    }>;
    /** 플랜 그룹 누락 등 문제 발생 시 경고 메시지 */
    warnings?: string[];
    /** 문제가 있는 참여자 수 */
    issueCount?: number;
    error?: string;
  }> => {
    await requireAdminOrConsultant();

    // 입력값 검증
    validateCampTemplateId(templateId);
    const tenantId = await validateTenantContext();

    // 템플릿 권한 확인
    await validateCampTemplateAccess(templateId, tenantId);

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

    // 초대와 학생 정보 조회
    const { data: invitationsData, error: invitationsError } = await supabase
      .from("camp_invitations")
      .select(
        `
        id,
        student_id,
        status,
        invited_at,
        accepted_at,
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

    if (invitationsError) {
      console.error("[campTemplateActions] 초대 조회 실패:", invitationsError);
      throw new AppError(
        "참여자 목록을 불러오는데 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: invitationsError.message }
      );
    }

    // 플랜 그룹 정보 조회
    const invitationIds = (invitationsData || []).map((inv) => inv.id);
    let planGroupsData: Array<{
      id: string;
      name: string | null;
      status: string | null;
      camp_invitation_id: string | null;
      camp_template_id: string | null;
      student_id: string;
    }> = [];

    if (invitationIds.length > 0) {
      // 방법 1: camp_invitation_id로 직접 조회
      const { data: method1Data, error: method1Error } = await supabase
        .from("plan_groups")
        .select("id, name, status, camp_invitation_id, camp_template_id, student_id")
        .in("camp_invitation_id", invitationIds)
        .is("deleted_at", null);

      if (method1Error) {
        console.error("[campTemplateActions] 플랜 그룹 조회 실패 (방법 1):", method1Error);
      } else if (method1Data) {
        planGroupsData = [
          ...planGroupsData,
          ...method1Data.filter((pg) => pg.camp_invitation_id !== null),
        ];
      }

      // 방법 2: camp_template_id와 student_id로 조회 (fallback)
      const studentIds = (invitationsData || []).map((inv) => inv.student_id);
      const { data: method2Data, error: method2Error } = await supabase
        .from("plan_groups")
        .select("id, name, status, camp_invitation_id, camp_template_id, student_id")
        .eq("camp_template_id", templateId)
        .eq("plan_type", "camp")
        .in("student_id", studentIds)
        .is("deleted_at", null);

      if (method2Error) {
        console.error("[campTemplateActions] 플랜 그룹 조회 실패 (방법 2):", method2Error);
      } else if (method2Data) {
        const existingGroupIds = new Set(planGroupsData.map((pg) => pg.id));
        const newGroups = method2Data.filter(
          (pg) => !existingGroupIds.has(pg.id)
        );
        planGroupsData = [...planGroupsData, ...newGroups];
      }
    }

    // 플랜 생성 여부 확인
    const planGroupIds = planGroupsData.map((pg) => pg.id);
    const plansMap = new Map<string, boolean>();

    if (planGroupIds.length > 0) {
      const { data: plansData, error: plansError } = await supabase
        .from("student_plan")
        .select("plan_group_id")
        .in("plan_group_id", planGroupIds)
        .limit(1000);

      if (plansError) {
        console.error("[campTemplateActions] 플랜 조회 실패:", plansError);
      } else if (plansData) {
        (plansData as Array<{ plan_group_id: string | null }>).forEach(
          (plan) => {
            if (plan.plan_group_id) {
              plansMap.set(plan.plan_group_id, true);
            }
          }
        );
      }
    }

    // 데이터 병합
    const planGroupsMap = new Map<string, typeof planGroupsData[0]>();
    planGroupsData.forEach((pg) => {
      if (pg.camp_invitation_id) {
        planGroupsMap.set(pg.camp_invitation_id, pg);
      }
    });

    const participants = (invitationsData || []).map((invitation) => {
      const planGroup = planGroupsMap.get(invitation.id);
      const isSubmitted =
        invitation.status === "pending" && planGroup !== undefined;
      const displayStatus = isSubmitted ? "submitted" : invitation.status;

      return {
        invitation_id: invitation.id,
        student_id: invitation.student_id,
        student_name: (invitation.students as any)?.name || "이름 없음",
        student_grade: (invitation.students as any)?.grade
          ? String((invitation.students as any).grade)
          : null,
        student_class: (invitation.students as any)?.class || null,
        invitation_status: invitation.status,
        display_status: displayStatus,
        plan_group_id: planGroup?.id || null,
        plan_group_name: planGroup?.name || null,
        plan_group_status: planGroup?.status || null,
        hasPlans: planGroup ? plansMap.has(planGroup.id) : false,
        invited_at: invitation.invited_at,
        accepted_at: invitation.accepted_at,
      };
    });

    // 플랜 그룹 누락 감지
    const participantsWithIssues = participants.filter(
      (p) =>
        (p.invitation_status === "accepted" || p.display_status === "submitted") &&
        !p.plan_group_id
    );

    const warnings: string[] = [];
    if (participantsWithIssues.length > 0) {
      warnings.push(
        `${participantsWithIssues.length}명의 참여자에게 플랜 그룹이 누락되었습니다. 복구가 필요할 수 있습니다.`
      );
    }

    return {
      success: true,
      participants,
      warnings: warnings.length > 0 ? warnings : undefined,
      issueCount: participantsWithIssues.length,
    };
  }
);

/**
 * P1 개선: 만료된 캠프 초대 자동 처리
 * 크론 작업 또는 주기적 실행을 통해 호출
 * pending 상태이면서 expires_at이 지난 초대를 expired 상태로 변경
 */
export async function autoExpireCampInvitations(): Promise<{
  success: boolean;
  expiredCount: number;
  error?: string;
}> {
  // Admin Client 사용 (RLS 우회, 시스템 작업)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      success: false,
      expiredCount: 0,
      error: "Admin 클라이언트를 생성할 수 없습니다.",
    };
  }

  try {
    const now = new Date().toISOString();

    // 만료된 pending 초대 조회
    const { data: expiredInvitations, error: fetchError } = await supabase
      .from("camp_invitations")
      .select("id")
      .eq("status", "pending")
      .not("expires_at", "is", null)
      .lt("expires_at", now);

    if (fetchError) {
      console.error("[camp/participants] 만료된 초대 조회 실패:", fetchError);
      return {
        success: false,
        expiredCount: 0,
        error: fetchError.message,
      };
    }

    if (!expiredInvitations || expiredInvitations.length === 0) {
      return { success: true, expiredCount: 0 };
    }

    const expiredIds = expiredInvitations.map((inv) => inv.id);

    // 상태를 expired로 변경
    const { error: updateError } = await supabase
      .from("camp_invitations")
      .update({
        status: "expired",
        updated_at: now,
      })
      .in("id", expiredIds);

    if (updateError) {
      console.error("[camp/participants] 만료 상태 업데이트 실패:", updateError);
      return {
        success: false,
        expiredCount: 0,
        error: updateError.message,
      };
    }

    console.log(
      `[camp/participants] ${expiredIds.length}개의 만료된 초대를 expired 상태로 변경했습니다.`
    );

    return { success: true, expiredCount: expiredIds.length };
  } catch (error) {
    console.error("[camp/participants] 자동 만료 처리 중 오류:", error);
    return {
      success: false,
      expiredCount: 0,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

