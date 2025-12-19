// 캠프 템플릿 및 초대 데이터 액세스 레이어

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CampTemplate, CampInvitation } from "@/lib/types/plan";
import type { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import type { PaginationOptions, ListResult } from "@/lib/data/core/types";

/**
 * 캠프 템플릿 조회
 */
export async function getCampTemplate(templateId: string): Promise<CampTemplate | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("camp_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    // PGRST116은 결과가 0개일 때 발생하는 정상적인 에러 (템플릿이 없는 경우)
    if (error.code !== "PGRST116") {
      console.error("[data/campTemplates] 템플릿 조회 실패", {
        templateId,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
      });
    } else if (process.env.NODE_ENV === "development") {
      console.warn("[data/campTemplates] 템플릿을 찾을 수 없음 (PGRST116)", {
        templateId,
      });
    }
    return null;
  }

  if (!data && process.env.NODE_ENV === "development") {
    console.warn("[data/campTemplates] 템플릿 조회 결과가 null", {
      templateId,
    });
  }

  return data as CampTemplate | null;
}

/**
 * 캠프 템플릿 생성
 */
export async function createCampTemplate(data: {
  tenant_id: string;
  name: string;
  description?: string;
  program_type: string;
  template_data: Partial<WizardData> | null;
  created_by: string;
  camp_start_date?: string;
  camp_end_date?: string;
  camp_location?: string;
}): Promise<{ success: boolean; templateId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const insertData: {
    tenant_id: string;
    name: string;
    description: string | null;
    program_type: string;
    template_data: Partial<WizardData> | null;
    status: "draft";
    created_by?: string;
    camp_start_date?: string;
    camp_end_date?: string;
    camp_location?: string;
  } = {
    tenant_id: data.tenant_id,
    name: data.name,
    description: data.description || null,
    program_type: data.program_type,
    template_data: data.template_data,
    status: "draft",
  };

  // created_by는 users 테이블이 있을 때만 추가
  if (data.created_by) {
    insertData.created_by = data.created_by;
  }

  // 캠프 기간 및 장소 필드 추가
  if (data.camp_start_date) {
    insertData.camp_start_date = data.camp_start_date;
  }
  if (data.camp_end_date) {
    insertData.camp_end_date = data.camp_end_date;
  }
  if (data.camp_location) {
    insertData.camp_location = data.camp_location;
  }

  const { data: template, error } = await supabase
    .from("camp_templates")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, templateId: template.id };
}

/**
 * 캠프 템플릿 목록 조회 (관리자용)
 */
export async function getCampTemplatesForTenant(
  tenantId: string
): Promise<CampTemplate[]> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("camp_templates")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[data/campTemplates] 템플릿 목록 조회 실패", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return [];
    }

    return (data || []) as CampTemplate[];
  } catch (error) {
    // 예상치 못한 에러 처리
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[data/campTemplates] 템플릿 목록 조회 중 예외 발생", {
      message: errorMessage,
      error,
    });
    return [];
  }
}

/**
 * 캠프 템플릿 목록 조회 (페이지네이션 지원)
 */
export async function getCampTemplatesForTenantWithPagination(
  tenantId: string,
  options: PaginationOptions = {}
): Promise<ListResult<CampTemplate>> {
  try {
    const supabase = await createSupabaseServerClient();
    
    const page = options.page || 1;
    const pageSize = options.pageSize || options.limit || 20;
    const offset = options.offset ?? (page - 1) * pageSize;

    // 전체 개수 조회
    const { count, error: countError } = await supabase
      .from("camp_templates")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    if (countError) {
      console.error("[data/campTemplates] 템플릿 개수 조회 실패", {
        message: countError.message,
        code: countError.code,
      });
    }

    // 데이터 조회
    const { data, error } = await supabase
      .from("camp_templates")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("[data/campTemplates] 템플릿 목록 조회 실패", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return {
        items: [],
        total: 0,
        page,
        pageSize,
      };
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      items: (data || []) as CampTemplate[],
      total,
      page,
      pageSize,
    };
  } catch (error) {
    // 예상치 못한 에러 처리
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[data/campTemplates] 템플릿 목록 조회 중 예외 발생", {
      message: errorMessage,
      error,
    });
    return {
      items: [],
      total: 0,
      page: options.page || 1,
      pageSize: options.pageSize || options.limit || 20,
    };
  }
}

/**
 * 학생의 캠프 초대 목록 조회
 */
export async function getCampInvitationsForStudent(
  studentId: string
): Promise<CampInvitation[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("camp_invitations")
    .select("*")
    .eq("student_id", studentId)
    .in("status", ["pending", "accepted"])
    .order("invited_at", { ascending: false });

  if (error) {
    console.error("[data/campTemplates] 초대 목록 조회 실패", error);
    return [];
  }

  return (data || []) as CampInvitation[];
}

/**
 * 캠프 초대 조회
 */
export async function getCampInvitation(
  invitationId: string
): Promise<CampInvitation | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("camp_invitations")
    .select("*")
    .eq("id", invitationId)
    .maybeSingle();

  if (error) {
    // PGRST116은 결과가 0개일 때 발생하는 정상적인 에러 (초대가 없는 경우)
    if (error.code !== "PGRST116") {
      console.error("[data/campTemplates] 초대 조회 실패", error);
    }
    return null;
  }

  return data as CampInvitation | null;
}

/**
 * 캠프 초대 상태 업데이트
 */
export async function updateCampInvitationStatus(
  invitationId: string,
  status: "accepted" | "declined"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "accepted") {
    updateData.accepted_at = new Date().toISOString();
  } else {
    updateData.declined_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("camp_invitations")
    .update(updateData)
    .eq("id", invitationId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 템플릿별 캠프 초대 목록 조회 (관리자용)
 */
export async function getCampInvitationsForTemplate(
  templateId: string
): Promise<Array<CampInvitation & { student_name?: string; student_grade?: string; student_class?: string }>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("camp_invitations")
    .select(`
      *,
      students:student_id (
        name,
        grade,
        class
      )
    `)
    .eq("camp_template_id", templateId)
    .order("invited_at", { ascending: false });

  if (error) {
    console.error("[data/campTemplates] 템플릿별 초대 목록 조회 실패", error);
    return [];
  }

  // 학생 정보를 평탄화
  return (data || []).map((invitation: any) => ({
    ...invitation,
    student_name: invitation.students?.name || null,
    student_grade: invitation.students?.grade || null,
    student_class: invitation.students?.class || null,
  }));
}

/**
 * 템플릿별 캠프 초대 목록 조회 (페이지네이션 지원)
 */
export async function getCampInvitationsForTemplateWithPagination(
  templateId: string,
  tenantId: string,
  options: PaginationOptions = {}
): Promise<ListResult<CampInvitation & { student_name?: string | null; student_grade?: string | null; student_class?: string | null }>> {
  try {
    const supabase = await createSupabaseServerClient();
    
    const page = options.page || 1;
    const pageSize = options.pageSize || options.limit || 20;
    const offset = options.offset ?? (page - 1) * pageSize;

    // 전체 개수 조회
    const { count, error: countError } = await supabase
      .from("camp_invitations")
      .select("*", { count: "exact", head: true })
      .eq("camp_template_id", templateId)
      .eq("tenant_id", tenantId);

    if (countError) {
      console.error("[data/campTemplates] 초대 개수 조회 실패", {
        message: countError.message,
        code: countError.code,
      });
    }

    // 데이터 조회
    const { data, error } = await supabase
      .from("camp_invitations")
      .select(`
        *,
        students:student_id (
          name,
          grade,
          class
        )
      `)
      .eq("camp_template_id", templateId)
      .eq("tenant_id", tenantId)
      .order("invited_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("[data/campTemplates] 템플릿별 초대 목록 조회 실패", error);
      return {
        items: [],
        total: 0,
        page,
        pageSize,
      };
    }

    // 학생 정보를 평탄화
    const items = (data || []).map((invitation: any) => ({
      ...invitation,
      student_name: invitation.students?.name || null,
      student_grade: invitation.students?.grade || null,
      student_class: invitation.students?.class || null,
    }));

    const total = count || 0;

    return {
      items,
      total,
      page,
      pageSize,
    };
  } catch (error) {
    // 예상치 못한 에러 처리
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[data/campTemplates] 템플릿별 초대 목록 조회 중 예외 발생", {
      message: errorMessage,
      error,
    });
    return {
      items: [],
      total: 0,
      page: options.page || 1,
      pageSize: options.pageSize || options.limit || 20,
    };
  }
}

export type CampTemplateImpactSummary = {
  invitationStats: {
    pending: number;
    accepted: number;
    declined: number;
  };
  planGroupStats: {
    draft: number;
    saved: number;
    active: number;
    paused: number;
    completed: number;
    cancelled: number;
  };
  totalInvitations: number;
  submittedInvitationCount: number;
  hasPendingInvites: boolean;
  hasAcceptedInvites: boolean;
  hasReviewInProgress: boolean;
  hasActivatedPlans: boolean;
};

export async function getCampTemplateImpactSummary(
  templateId: string,
  tenantId: string
): Promise<CampTemplateImpactSummary> {
  const supabase = await createSupabaseServerClient();

  const invitationStats = {
    pending: 0,
    accepted: 0,
    declined: 0,
  };

  const planGroupStats = {
    draft: 0,
    saved: 0,
    active: 0,
    paused: 0,
    completed: 0,
    cancelled: 0,
  };

  const { data: invitations, error: invitationsError } = await supabase
    .from("camp_invitations")
    .select("id, status")
    .eq("camp_template_id", templateId)
    .eq("tenant_id", tenantId);

  if (invitationsError) {
    console.error(
      "[data/campTemplates] 초대 통계 조회 실패",
      invitationsError
    );
  } else {
    (invitations || []).forEach((invitation) => {
      const status = invitation.status as keyof typeof invitationStats;
      if (status in invitationStats) {
        invitationStats[status]++;
      }
    });
  }

  const submittedInvitationIds = new Set<string>();
  const { data: planGroups, error: planGroupsError } = await supabase
    .from("plan_groups")
    .select("id, status, camp_invitation_id")
    .eq("camp_template_id", templateId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (planGroupsError) {
    console.error(
      "[data/campTemplates] 플랜 그룹 통계 조회 실패",
      planGroupsError
    );
  } else {
    (planGroups || []).forEach((group) => {
      if (group.camp_invitation_id) {
        submittedInvitationIds.add(group.camp_invitation_id);
      }
      const status = group.status as keyof typeof planGroupStats;
      if (status in planGroupStats) {
        planGroupStats[status]++;
      }
    });
  }

  return {
    invitationStats,
    planGroupStats,
    totalInvitations: invitations?.length || 0,
    submittedInvitationCount: submittedInvitationIds.size,
    hasPendingInvites: invitationStats.pending > 0,
    hasAcceptedInvites: invitationStats.accepted > 0,
    hasReviewInProgress:
      planGroupStats.draft > 0 || planGroupStats.saved > 0,
    hasActivatedPlans: planGroupStats.active > 0,
  };
}

/**
 * 캠프 초대 삭제
 */
export async function deleteCampInvitation(
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // 1. 초대 삭제 전에 관련된 플랜 그룹 삭제
  const { deletePlanGroupByInvitationId } = await import(
    "@/lib/data/planGroups"
  );
  const planGroupResult = await deletePlanGroupByInvitationId(invitationId);

  if (!planGroupResult.success) {
    console.error(
      "[data/campTemplates] 플랜 그룹 삭제 실패",
      planGroupResult.error
    );
    return {
      success: false,
      error: `플랜 그룹 삭제 실패: ${planGroupResult.error}`,
    };
  }

  // 2. 초대 삭제
  const { error } = await supabase
    .from("camp_invitations")
    .delete()
    .eq("id", invitationId);

  if (error) {
    console.error("[data/campTemplates] 초대 삭제 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 캠프 초대 일괄 삭제
 */
export async function deleteCampInvitations(
  invitationIds: string[]
): Promise<{ success: boolean; error?: string; count?: number }> {
  const supabase = await createSupabaseServerClient();

  // 1. 각 초대에 대해 플랜 그룹 삭제
  const { deletePlanGroupByInvitationId } = await import(
    "@/lib/data/planGroups"
  );

  const planGroupResults = await Promise.all(
    invitationIds.map((invitationId) =>
      deletePlanGroupByInvitationId(invitationId)
    )
  );

  // 플랜 그룹 삭제 실패한 경우 확인
  const failedPlanGroupDeletes = planGroupResults.filter(
    (result) => !result.success
  );

  if (failedPlanGroupDeletes.length > 0) {
    const errorMessages = failedPlanGroupDeletes
      .map((result) => result.error)
      .join("; ");
    console.error(
      "[data/campTemplates] 일부 플랜 그룹 삭제 실패",
      errorMessages
    );
    // 플랜 그룹 삭제 실패해도 초대 삭제는 계속 진행 (데이터 일관성 유지)
    // 하지만 에러를 기록해두는 것이 좋음
  }

  // 2. 초대 일괄 삭제
  const { error } = await supabase
    .from("camp_invitations")
    .delete()
    .in("id", invitationIds);
  
  const count = error ? 0 : invitationIds.length;

  if (error) {
    console.error("[data/campTemplates] 초대 일괄 삭제 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true, count: count || 0 };
}

/**
 * 캠프 템플릿 복사
 * 템플릿 데이터와 블록 세트 연결을 복사합니다. 초대 정보는 복사하지 않습니다.
 */
export async function copyCampTemplate(
  templateId: string,
  newName?: string
): Promise<{ success: boolean; templateId?: string; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    // 원본 템플릿 조회
    const originalTemplate = await getCampTemplate(templateId);
    if (!originalTemplate) {
      return { success: false, error: "템플릿을 찾을 수 없습니다." };
    }

    // 새 템플릿 이름 생성
    const copiedName = newName || `${originalTemplate.name} (복사본)`;

    // 새 템플릿 생성
    const newTemplateResult = await createCampTemplate({
      tenant_id: originalTemplate.tenant_id,
      name: copiedName,
      description: originalTemplate.description || undefined,
      program_type: originalTemplate.program_type,
      template_data: originalTemplate.template_data,
      created_by: originalTemplate.created_by || undefined,
      camp_start_date: originalTemplate.camp_start_date || undefined,
      camp_end_date: originalTemplate.camp_end_date || undefined,
      camp_location: originalTemplate.camp_location || undefined,
    });

    if (!newTemplateResult.success || !newTemplateResult.templateId) {
      return {
        success: false,
        error: newTemplateResult.error || "템플릿 복사에 실패했습니다.",
      };
    }

    const newTemplateId = newTemplateResult.templateId;

    // 블록 세트 연결 복사 (camp_template_block_sets 테이블)
    const { data: originalBlockSetLink, error: blockSetLinkError } =
      await supabase
        .from("camp_template_block_sets")
        .select("tenant_block_set_id")
        .eq("camp_template_id", templateId)
        .maybeSingle();

    if (blockSetLinkError && blockSetLinkError.code !== "PGRST116") {
      // PGRST116은 결과가 없을 때 발생하는 정상적인 에러
      console.error(
        "[data/campTemplates] 블록 세트 연결 조회 실패",
        blockSetLinkError
      );
    } else if (originalBlockSetLink) {
      // 블록 세트 연결이 있으면 복사
      const { error: insertError } = await supabase
        .from("camp_template_block_sets")
        .insert({
          camp_template_id: newTemplateId,
          tenant_block_set_id: originalBlockSetLink.tenant_block_set_id,
        });

      if (insertError) {
        console.error(
          "[data/campTemplates] 블록 세트 연결 복사 실패",
          insertError
        );
        // 블록 세트 연결 실패해도 템플릿 복사는 성공으로 처리 (경고만)
      }
    }

    return { success: true, templateId: newTemplateId };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[data/campTemplates] 템플릿 복사 중 예외 발생", {
      message: errorMessage,
      error,
    });
    return {
      success: false,
      error: errorMessage || "템플릿 복사에 실패했습니다.",
    };
  }
}

/**
 * 테넌트별 캠프 통계 조회
 */
export type CampStatistics = {
  activeTemplates: number;
  totalInvitations: number;
  acceptedInvitations: number;
  declinedInvitations: number;
  pendingInvitations: number;
  participationRate: number; // 참여율 (수락 / 전체 초대)
};

export async function getCampStatisticsForTenant(
  tenantId: string
): Promise<CampStatistics> {
  try {
    const supabase = await createSupabaseServerClient();

    // 활성 템플릿 수 조회
    const { count: activeTemplatesCount, error: templatesError } = await supabase
      .from("camp_templates")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (templatesError) {
      console.error(
        "[data/campTemplates] 활성 템플릿 수 조회 실패",
        templatesError
      );
    }

    // 초대 통계 조회
    const { data: invitations, error: invitationsError } = await supabase
      .from("camp_invitations")
      .select("status")
      .eq("tenant_id", tenantId);

    if (invitationsError) {
      console.error(
        "[data/campTemplates] 초대 통계 조회 실패",
        invitationsError
      );
    }

    const totalInvitations = invitations?.length || 0;
    const acceptedInvitations =
      invitations?.filter((inv) => inv.status === "accepted").length || 0;
    const declinedInvitations =
      invitations?.filter((inv) => inv.status === "declined").length || 0;
    const pendingInvitations =
      invitations?.filter((inv) => inv.status === "pending").length || 0;

    const participationRate =
      totalInvitations > 0
        ? Math.round((acceptedInvitations / totalInvitations) * 100)
        : 0;

    return {
      activeTemplates: activeTemplatesCount || 0,
      totalInvitations,
      acceptedInvitations,
      declinedInvitations,
      pendingInvitations,
      participationRate,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[data/campTemplates] 캠프 통계 조회 중 예외 발생", {
      message: errorMessage,
      error,
    });
    return {
      activeTemplates: 0,
      totalInvitations: 0,
      acceptedInvitations: 0,
      declinedInvitations: 0,
      pendingInvitations: 0,
      participationRate: 0,
    };
  }
}

/**
 * 템플릿별 캠프 통계 조회
 */
export type CampTemplateStatistics = {
  totalInvitations: number;
  acceptedInvitations: number;
  declinedInvitations: number;
  pendingInvitations: number;
  participationRate: number;
  planGroupsCount: number;
  activePlanGroupsCount: number;
};

export async function getCampTemplateStatistics(
  templateId: string,
  tenantId: string
): Promise<CampTemplateStatistics> {
  try {
    const supabase = await createSupabaseServerClient();

    // 초대 통계 조회
    const { data: invitations, error: invitationsError } = await supabase
      .from("camp_invitations")
      .select("status")
      .eq("camp_template_id", templateId)
      .eq("tenant_id", tenantId);

    if (invitationsError) {
      console.error(
        "[data/campTemplates] 템플릿별 초대 통계 조회 실패",
        invitationsError
      );
    }

    const totalInvitations = invitations?.length || 0;
    const acceptedInvitations =
      invitations?.filter((inv) => inv.status === "accepted").length || 0;
    const declinedInvitations =
      invitations?.filter((inv) => inv.status === "declined").length || 0;
    const pendingInvitations =
      invitations?.filter((inv) => inv.status === "pending").length || 0;

    const participationRate =
      totalInvitations > 0
        ? Math.round((acceptedInvitations / totalInvitations) * 100)
        : 0;

    // 플랜 그룹 통계 조회
    const { data: planGroups, error: planGroupsError } = await supabase
      .from("plan_groups")
      .select("status")
      .eq("camp_template_id", templateId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

    if (planGroupsError) {
      console.error(
        "[data/campTemplates] 템플릿별 플랜 그룹 통계 조회 실패",
        planGroupsError
      );
    }

    const planGroupsCount = planGroups?.length || 0;
    const activePlanGroupsCount =
      planGroups?.filter((pg) => pg.status === "active").length || 0;

    return {
      totalInvitations,
      acceptedInvitations,
      declinedInvitations,
      pendingInvitations,
      participationRate,
      planGroupsCount,
      activePlanGroupsCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      "[data/campTemplates] 템플릿별 캠프 통계 조회 중 예외 발생",
      {
        message: errorMessage,
        error,
      }
    );
    return {
      totalInvitations: 0,
      acceptedInvitations: 0,
      declinedInvitations: 0,
      pendingInvitations: 0,
      participationRate: 0,
      planGroupsCount: 0,
      activePlanGroupsCount: 0,
    };
  }
}

