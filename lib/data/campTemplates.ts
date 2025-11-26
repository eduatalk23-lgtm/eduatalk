// 캠프 템플릿 및 초대 데이터 액세스 레이어

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CampTemplate, CampInvitation } from "@/lib/types/plan";

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
  template_data: any; // WizardData JSON
  created_by: string;
  camp_start_date?: string;
  camp_end_date?: string;
  camp_location?: string;
}): Promise<{ success: boolean; templateId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const insertData: any = {
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
  const { error, count } = await supabase
    .from("camp_invitations")
    .delete()
    .in("id", invitationIds)
    .select("id", { count: "exact", head: false });

  if (error) {
    console.error("[data/campTemplates] 초대 일괄 삭제 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true, count: count || 0 };
}

