/**
 * 플랜 그룹 삭제 관련 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import { logActionWarn, logActionDebug } from "@/lib/logging/actionLogger";

/**
 * 캠프 초대 ID로 플랜 그룹 삭제
 */
export async function deletePlanGroupByInvitationId(
  invitationId: string
): Promise<{ success: boolean; error?: string; deletedGroupId?: string }> {
  const supabase = await createSupabaseServerClient();

  // 0. 초대 정보 조회 (camp_template_id와 student_id 확인용)
  const { getCampInvitation } = await import("@/lib/data/campTemplates");
  const invitation = await getCampInvitation(invitationId);

  if (!invitation) {
    // 초대가 없으면 플랜 그룹도 없을 것으로 예상되지만, 안전을 위해 확인
    logActionWarn(
      { domain: "data", action: "deletePlanGroupByInvitationId" },
      "초대를 찾을 수 없음",
      { invitationId }
    );
  }

  const templateId = invitation?.camp_template_id;
  const studentId = invitation?.student_id;

  // 1. camp_invitation_id로 플랜 그룹 조회
  const { data: planGroupByInvitationId, error: fetchError1 } = await supabase
    .from("plan_groups")
    .select("id, student_id")
    .eq("camp_invitation_id", invitationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError1 && fetchError1.code !== "PGRST116") {
    handleQueryError(fetchError1, {
      context: "[data/planGroups] deletePlanGroupByInvitationId - fetch_by_invitation_id",
    });
    return { success: false, error: fetchError1.message };
  }

  // 2. camp_template_id와 student_id로도 플랜 그룹 조회 (camp_invitation_id가 NULL인 경우 대비)
  let planGroupByTemplateAndStudent: { id: string; student_id: string } | null = null;
  if (templateId && studentId) {
    const { data: planGroupByTemplate, error: fetchError2 } = await supabase
      .from("plan_groups")
      .select("id, student_id")
      .eq("camp_template_id", templateId)
      .eq("student_id", studentId)
      .eq("plan_type", "camp")
      .is("camp_invitation_id", null) // camp_invitation_id가 NULL인 것만 (이미 삭제된 초대의 플랜 그룹)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchError2 && fetchError2.code !== "PGRST116") {
      handleQueryError(fetchError2, {
        context: "[data/planGroups] deletePlanGroupByInvitationId - fetch_by_template_and_student",
      });
      // 에러가 있어도 계속 진행 (camp_invitation_id로 찾은 플랜 그룹은 삭제 가능)
    } else {
      planGroupByTemplateAndStudent = planGroupByTemplate;
    }
  }

  // 삭제할 플랜 그룹 결정 (우선순위: camp_invitation_id로 찾은 것)
  const planGroup = planGroupByInvitationId || planGroupByTemplateAndStudent;

  // 플랜 그룹이 없으면 성공으로 처리 (삭제할 것이 없음)
  if (!planGroup) {
    return { success: true };
  }

  const groupId = planGroup.id;
  const finalStudentId = planGroup.student_id;

  // 3. 관련 student_plan 삭제 (hard delete)
  const { error: deletePlansError } = await supabase
    .from("student_plan")
    .delete()
    .eq("plan_group_id", groupId);

  if (deletePlansError) {
    handleQueryError(deletePlansError, {
      context: "[data/planGroups] deletePlanGroupByInvitationId",
    });
    return {
      success: false,
      error: `플랜 삭제 실패: ${deletePlansError.message}`,
    };
  }

  // 4. plan_contents 삭제 (안전을 위해 명시적으로 삭제)
  const { error: deleteContentsError } = await supabase
    .from("plan_contents")
    .delete()
    .eq("plan_group_id", groupId);

  if (deleteContentsError) {
    handleQueryError(deleteContentsError, {
      context: "[data/planGroups] deletePlanGroupByInvitationId - deleteContents",
    });
    // 콘텐츠 삭제 실패해도 계속 진행 (외래키 제약으로 자동 삭제될 수 있음)
  }

  // 5. plan_exclusions 삭제 (안전을 위해 명시적으로 삭제)
  const { error: deleteExclusionsError } = await supabase
    .from("plan_exclusions")
    .delete()
    .eq("plan_group_id", groupId);

  if (deleteExclusionsError) {
    handleQueryError(deleteExclusionsError, {
      context: "[data/planGroups] deletePlanGroupByInvitationId - deleteExclusions",
    });
    // 제외일 삭제 실패해도 계속 진행 (외래키 제약으로 자동 삭제될 수 있음)
  }

  // 6. academy_schedules 삭제는 수행하지 않음
  // 이유:
  // - 캠프 모드에서는 academy_schedules가 plan_group_id 없이 저장됨 (학생별 전역 관리)
  // - submitCampParticipation에서 기존 학원 일정을 모두 삭제하고 템플릿 일정으로 교체
  // - 초대 취소 시 academy_schedules를 삭제하면 다른 플랜 그룹의 학원 일정까지 삭제될 위험이 있음
  // - 따라서 academy_schedules는 삭제하지 않고 유지 (다른 플랜 그룹 보호)

  // 7. plan_groups 삭제 (hard delete)
  const { error: deleteGroupError } = await supabase
    .from("plan_groups")
    .delete()
    .eq("id", groupId);

  if (deleteGroupError) {
    handleQueryError(deleteGroupError, {
      context: "[data/planGroups] deletePlanGroupByInvitationId",
    });
    return {
      success: false,
      error: `플랜 그룹 삭제 실패: ${deleteGroupError.message}`,
    };
  }

  logActionDebug(
    { domain: "data", action: "deletePlanGroupByInvitationId" },
    "플랜 그룹 삭제 완료",
    {
      invitationId,
      groupId,
      studentId: finalStudentId,
      foundByInvitationId: !!planGroupByInvitationId,
      foundByTemplateAndStudent: !!planGroupByTemplateAndStudent,
    }
  );

  return { success: true, deletedGroupId: groupId };
}

/**
 * 캠프 템플릿 ID로 모든 관련 플랜 그룹 삭제
 */
export async function deletePlanGroupsByTemplateId(
  templateId: string
): Promise<{ success: boolean; error?: string; deletedGroupIds?: string[] }> {
  const supabase = await createSupabaseServerClient();

  // 1. camp_template_id로 플랜 그룹 조회 (여러 개일 수 있음)
  const { data: planGroups, error: fetchError } = await supabase
    .from("plan_groups")
    .select("id, student_id")
    .eq("camp_template_id", templateId)
    .is("deleted_at", null);

  if (fetchError) {
    handleQueryError(fetchError, {
      context: "[data/planGroups] deletePlanGroupsByTemplateId",
    });
    return { success: false, error: fetchError.message };
  }

  // 플랜 그룹이 없으면 성공으로 처리 (삭제할 것이 없음)
  if (!planGroups || planGroups.length === 0) {
    return { success: true, deletedGroupIds: [] };
  }

  const groupIds = planGroups.map((g) => g.id);
  const deletedGroupIds: string[] = [];

  // 2. 각 플랜 그룹에 대해 관련 데이터 삭제
  for (const groupId of groupIds) {
    // 2-1. 관련 student_plan 삭제 (hard delete)
    const { error: deletePlansError } = await supabase
      .from("student_plan")
      .delete()
      .eq("plan_group_id", groupId);

    if (deletePlansError) {
      handleQueryError(deletePlansError, {
        context: "[data/planGroups] deletePlanGroupsByTemplateId - deletePlans",
      });
      // 개별 플랜 삭제 실패해도 계속 진행
    }

    // 2-2. plan_contents 삭제 (안전을 위해 명시적으로 삭제)
    const { error: deleteContentsError } = await supabase
      .from("plan_contents")
      .delete()
      .eq("plan_group_id", groupId);

    if (deleteContentsError) {
      handleQueryError(deleteContentsError, {
        context: "[data/planGroups] deletePlanGroupsByTemplateId - deleteContents",
      });
      // 콘텐츠 삭제 실패해도 계속 진행
    }

    // 2-3. plan_exclusions 삭제 (안전을 위해 명시적으로 삭제)
    const { error: deleteExclusionsError } = await supabase
      .from("plan_exclusions")
      .delete()
      .eq("plan_group_id", groupId);

    if (deleteExclusionsError) {
      handleQueryError(deleteExclusionsError, {
        context: "[data/planGroups] deletePlanGroupsByTemplateId - deleteExclusions",
      });
      // 제외일 삭제 실패해도 계속 진행
    }

    // 2-4. plan_groups 삭제 (hard delete)
    const { error: deleteGroupError } = await supabase
      .from("plan_groups")
      .delete()
      .eq("id", groupId);

    if (deleteGroupError) {
      handleQueryError(deleteGroupError, {
        context: "[data/planGroups] deletePlanGroupsByTemplateId - deleteGroup",
      });
      // 개별 플랜 그룹 삭제 실패는 기록만 하고 계속 진행
    } else {
      deletedGroupIds.push(groupId);
    }
  }

  return { success: true, deletedGroupIds };
}
