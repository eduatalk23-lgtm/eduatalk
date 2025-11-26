"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  getCampInvitationsForStudent,
  getCampInvitation,
  getCampTemplate,
  updateCampInvitationStatus,
} from "@/lib/data/campTemplates";
import { createPlanGroupAction } from "./planGroupActions";
import { WizardData } from "../plan/new-group/_components/PlanGroupWizard";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 학생의 캠프 초대 목록 조회
 */
export const getStudentCampInvitations = withErrorHandling(async () => {
  // 권한 검증
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
  }

  const invitations = await getCampInvitationsForStudent(user.userId);

  // 템플릿 정보도 함께 조회
  const invitationsWithTemplates = await Promise.all(
    invitations.map(async (invitation) => {
      const template = await getCampTemplate(invitation.camp_template_id);
      return {
        ...invitation,
        template: template
          ? {
              name: template.name,
              program_type: template.program_type,
              description: template.description,
            }
          : null,
      };
    })
  );

  return { success: true, invitations: invitationsWithTemplates };
});

/**
 * 캠프 초대 상세 조회 (템플릿 포함)
 */
export const getCampInvitationWithTemplate = withErrorHandling(
  async (invitationId: string) => {
    // 권한 검증
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    // 입력값 검증
    if (!invitationId || typeof invitationId !== "string") {
      throw new AppError("초대 ID가 올바르지 않습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
    }

    const invitation = await getCampInvitation(invitationId);
    if (!invitation) {
      throw new AppError("초대를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
    }

    // 본인의 초대인지 확인 (보안 강화)
    if (invitation.student_id !== user.userId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const template = await getCampTemplate(invitation.camp_template_id);
    if (!template) {
      throw new AppError("템플릿을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
    }

    return {
      success: true,
      invitation,
      template,
    };
  }
);

/**
 * 캠프 참여 정보 제출
 */
export const submitCampParticipation = withErrorHandling(
  async (
    invitationId: string,
    wizardData: Partial<WizardData>
  ): Promise<{ success: boolean; groupId?: string; invitationId?: string; error?: string }> => {
    // 권한 검증
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    // 입력값 검증
    if (!invitationId || typeof invitationId !== "string") {
      throw new AppError("초대 ID가 올바르지 않습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
    }

    if (!wizardData) {
      throw new AppError("참여 정보가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
    }

    // 초대 정보 확인 및 권한 검증 (강화)
    const invitation = await getCampInvitation(invitationId);
    if (!invitation) {
      throw new AppError("초대를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
    }

    // 본인의 초대인지 확인 (보안 강화)
    if (invitation.student_id !== user.userId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    // 초대 상태 확인
    if (invitation.status !== "pending") {
      throw new AppError("이미 처리된 초대입니다.", ErrorCode.VALIDATION_ERROR, 400, true);
    }

    // 이미 생성된 플랜 그룹이 있는지 확인 (중복 제출 방지)
    const supabase = await createSupabaseServerClient();
    const { data: existingGroup, error: checkError } = await supabase
      .from("plan_groups")
      .select("id, status")
      .eq("camp_invitation_id", invitationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116은 "multiple rows" 에러인데, 이는 이미 처리됨 (limit(1) 사용)
      console.error("[campActions] 기존 플랜 그룹 확인 중 에러:", checkError);
      throw new AppError(
        "기존 플랜 그룹 확인 중 오류가 발생했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    // status를 고려하여 중복 제출 방지
    // saved 상태면 이미 제출 완료된 것으로 간주하고 중복 제출 방지
    // draft 상태면 이어서 작성 가능하도록 허용 (기존 draft 업데이트)
    if (existingGroup) {
      if (existingGroup.status === "saved") {
        console.warn("[campActions] 이미 제출 완료된 플랜 그룹이 존재함:", {
          invitationId,
          groupId: existingGroup.id,
          status: existingGroup.status,
        });
        throw new AppError(
          "이미 제출된 캠프 참여 정보가 있습니다.",
          ErrorCode.DUPLICATE_ENTRY,
          409,
          true
        );
      }
      // draft 상태인 경우 기존 draft를 업데이트하도록 groupId를 반환
      // (아래 로직에서 기존 draft를 업데이트하도록 처리)
      if (existingGroup.status === "draft") {
        console.log("[campActions] 기존 draft 플랜 그룹 발견, 업데이트 진행:", {
          invitationId,
          groupId: existingGroup.id,
          status: existingGroup.status,
        });
        // 기존 draft를 업데이트하기 위해 groupId를 저장
        // 아래에서 updatePlanGroupDraftAction을 사용하여 업데이트
      }
    }

    // 템플릿 데이터와 학생 입력 데이터 병합
    const template = await getCampTemplate(invitation.camp_template_id);
    if (!template) {
      throw new AppError("템플릿을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
    }

    // 템플릿이 활성 상태인지 확인
    if (template.status === "archived") {
      throw new AppError("보관된 템플릿에는 참여할 수 없습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
    }

    const templateData = template.template_data as Partial<WizardData>;

    // 템플릿 제외일과 학원 일정에 source, is_locked 필드 추가
    const templateExclusions = (templateData.exclusions || []).map((exclusion: any) => ({
      ...exclusion,
      source: "template" as const,
      is_locked: true,
    }));

    const templateAcademySchedules = (templateData.academy_schedules || []).map((schedule: any) => ({
      ...schedule,
      source: "template" as const,
      is_locked: true,
    }));

    // 템플릿 기본값 + 학생 입력값 병합
    const mergedData: Partial<WizardData> = {
      ...templateData,
      // 학생이 입력하는 필드는 wizardData 우선 (plan_purpose, name 등)
      name: wizardData.name || templateData.name || "",
      plan_purpose: wizardData.plan_purpose || templateData.plan_purpose || "",
      scheduler_type: wizardData.scheduler_type || templateData.scheduler_type || "1730_timetable",
      period_start: wizardData.period_start || templateData.period_start || "",
      period_end: wizardData.period_end || templateData.period_end || "",
      block_set_id: wizardData.block_set_id || templateData.block_set_id || "",
      // 학생이 입력하는 부분은 wizardData 우선
      academy_schedules: [
        ...templateAcademySchedules,
        ...(wizardData.academy_schedules?.filter(
          (s) => s.source !== "template" // 템플릿 학원 일정 제외
        ) || []),
      ],
      student_contents: wizardData.student_contents || [],
      recommended_contents: templateData.recommended_contents || [],
      // 제외일: 템플릿 기본값 (source, is_locked 포함) + 학생 추가 제외일
      exclusions: [
        ...templateExclusions,
        ...(wizardData.exclusions?.filter(
          (e) =>
            e.source !== "template" && // 템플릿 제외일 제외
            !templateExclusions.some(
              (te) => te.exclusion_date === e.exclusion_date
            )
        ) || []),
      ],
      // 캠프 모드: 전략과목/취약과목 설정은 관리자 검토 후 설정하므로 null로 저장
      subject_allocations: undefined,
      student_level: wizardData.student_level || templateData.student_level || undefined,
      // 기타 필드들도 wizardData 우선
      time_settings: wizardData.time_settings || templateData.time_settings,
      scheduler_options: wizardData.scheduler_options || templateData.scheduler_options,
      study_review_cycle: wizardData.study_review_cycle || templateData.study_review_cycle,
    };

    // 플랜 그룹 생성 (기존 액션 재사용)
    const { syncWizardDataToCreationData } = await import(
      "@/lib/utils/planGroupDataSync"
    );
    const creationData = syncWizardDataToCreationData(mergedData as WizardData);

    // 캠프 모드에서는 block_set_id를 null로 설정
    // 템플릿의 block_set_id는 template_block_sets 테이블의 ID이므로
    // plan_groups.block_set_id (student_block_sets 참조)에 저장할 수 없음
    creationData.block_set_id = null;

    // 템플릿 블록 세트 ID를 scheduler_options에 저장
    if (templateData.block_set_id) {
      if (!creationData.scheduler_options) {
        creationData.scheduler_options = {};
      }
      (creationData.scheduler_options as any).template_block_set_id = templateData.block_set_id;
    }

    let groupId: string;

    // 기존 draft가 있으면 업데이트, 없으면 새로 생성
    if (existingGroup && existingGroup.status === "draft") {
      // 기존 draft 업데이트
      const { updatePlanGroupDraftAction } = await import("./planGroupActions");
      await updatePlanGroupDraftAction(existingGroup.id, {
        ...creationData,
        plan_type: "camp",
        camp_template_id: invitation.camp_template_id,
        camp_invitation_id: invitationId,
      });
      groupId = existingGroup.id;
    } else {
      // 새 플랜 그룹 생성
      const result = await createPlanGroupAction({
        ...creationData,
        plan_type: "camp",
        camp_template_id: invitation.camp_template_id,
        camp_invitation_id: invitationId,
      });

      if (!result.groupId) {
        // 플랜 그룹 생성 실패 시 초대 상태를 업데이트하지 않음
        console.error("[campActions] 플랜 그룹 생성 실패:", {
          invitationId,
          studentId: user.userId,
          templateId: invitation.camp_template_id,
        });
        throw new AppError(
          "플랜 그룹 생성에 실패했습니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
      groupId = result.groupId;
    }

    // 제출 완료 시 플랜 그룹 상태를 "saved"로 변경
    const { error: statusUpdateError } = await supabase
      .from("plan_groups")
      .update({ status: "saved", updated_at: new Date().toISOString() })
      .eq("id", groupId);

    if (statusUpdateError) {
      console.error("[campActions] 플랜 그룹 상태 업데이트 실패:", statusUpdateError);
      // 상태 업데이트 실패는 경고만 (플랜 그룹은 생성/업데이트됨)
      console.warn("[campActions] 플랜 그룹 상태를 saved로 변경하지 못했습니다. 관리자에게 문의해주세요.");
    }

    // 플랜 그룹이 제대로 생성되었는지 확인
    const supabaseVerify = await createSupabaseServerClient();
    const { data: createdGroup, error: verifyError } = await supabaseVerify
      .from("plan_groups")
      .select("id, camp_invitation_id, camp_template_id, plan_type")
      .eq("id", groupId)
      .single();

    if (verifyError || !createdGroup) {
      console.error("[campActions] 생성된 플랜 그룹 확인 실패:", verifyError);
      throw new AppError(
        "플랜 그룹이 생성되었지만 확인할 수 없습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    // camp_invitation_id가 제대로 저장되었는지 확인
    if (createdGroup.camp_invitation_id !== invitationId) {
      console.warn("[campActions] camp_invitation_id가 일치하지 않음, 업데이트 시도:", {
        expected: invitationId,
        actual: createdGroup.camp_invitation_id,
        groupId: groupId,
      });
      
      const { error: updateError } = await supabase
        .from("plan_groups")
        .update({ camp_invitation_id: invitationId })
        .eq("id", groupId);

      if (updateError) {
        console.error("[campActions] camp_invitation_id 업데이트 실패:", updateError);
        // 업데이트 실패해도 계속 진행 (플랜 그룹은 생성됨)
      } else {
        console.log("[campActions] camp_invitation_id 업데이트 성공");
      }
    }

    // 자동 추천 콘텐츠 생성 및 저장
    if (groupId) {
      try {
        const { getRecommendedMasterContents } = await import(
          "@/lib/recommendations/masterContentRecommendation"
        );
        const { createPlanContents } = await import("@/lib/data/planGroups");

        const supabaseRecommend = await createSupabaseServerClient();
        const recommendedContents = await getRecommendedMasterContents(
          supabaseRecommend,
          user.userId,
          tenantContext.tenantId
        );

        if (recommendedContents.length > 0) {
          // 템플릿 기본 추천 콘텐츠와 중복 제거
          const templateContentIds = new Set(
            (templateData.recommended_contents || []).map((c: any) => c.content_id)
          );
          const studentContentIds = new Set(
            (wizardData.student_contents || []).map((c: any) => c.content_id)
          );

          const uniqueRecommendedContents = recommendedContents.filter(
            (rec) =>
              !templateContentIds.has(rec.id) &&
              !studentContentIds.has(rec.id)
          );

          if (uniqueRecommendedContents.length > 0) {
            const autoRecommendedPlanContents = uniqueRecommendedContents.map(
              (rec, index) => ({
                content_type: rec.contentType,
                content_id: rec.id,
                // valid_range 제약조건을 만족하기 위해 start_range < end_range가 되어야 함
                // 관리자가 Step 6에서 올바른 범위로 수정할 예정이므로 임시로 큰 범위 설정
                start_range: 1,
                end_range: 999999,
                display_order: (creationData.contents?.length || 0) + index,
                is_auto_recommended: true,
                recommendation_source: "auto" as const,
                recommendation_reason: rec.reason,
                recommendation_metadata: {
                  scoreDetails: rec.scoreDetails,
                  priority: rec.priority,
                },
                recommended_at: new Date().toISOString(),
                recommended_by: "system",
              })
            );

            const autoRecResult = await createPlanContents(
              groupId,
              tenantContext.tenantId,
              autoRecommendedPlanContents
            );

            if (!autoRecResult.success) {
              // 자동 추천 실패는 경고만 (플랜 생성은 성공)
              console.warn(
                "[campActions] 자동 추천 콘텐츠 저장 실패:",
                autoRecResult.error
              );
            }
          }
        }
      } catch (error) {
        // 자동 추천 생성 실패는 경고만 (플랜 생성은 성공)
        console.warn("[campActions] 자동 추천 콘텐츠 생성 실패:", error);
      }
    }

    // 초대 상태 업데이트
    const updateResult = await updateCampInvitationStatus(invitationId, "accepted");
    if (!updateResult.success) {
      // 플랜은 생성되었지만 초대 상태 업데이트 실패 (경고만)
      console.warn("[campActions] 초대 상태 업데이트 실패:", updateResult.error);
    }

    return {
      success: true,
      groupId: groupId,
      invitationId: invitationId,
    };
  }
);
