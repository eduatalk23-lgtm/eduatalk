"use server";

/**
 * Student Camp Actions
 *
 * Student-facing Server Actions for camp invitation management.
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  getCampInvitationsForStudent,
  getCampInvitation,
  getCampTemplate,
  updateCampInvitationStatus,
} from "@/lib/data/campTemplates";
import { createPlanGroupAction } from "@/lib/domains/plan";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SchedulerOptions } from "@/lib/types/plan";
import {
  isHigherPriorityExclusionType,
} from "@/lib/utils/exclusionHierarchy";
import type { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import type { ContentSlot, SlotTemplate } from "@/lib/types/content-selection";
import { revalidatePath } from "next/cache";

/**
 * 슬롯 템플릿을 ContentSlot으로 변환
 */
function convertSlotTemplatesToContentSlots(
  slotTemplates: SlotTemplate[]
): ContentSlot[] {
  return slotTemplates.map((template) => ({
    ...template,
    id: crypto.randomUUID(),
    content_id: null,
    start_range: undefined,
    end_range: undefined,
    start_detail_id: null,
    end_detail_id: null,
    title: undefined,
    master_content_id: null,
    is_auto_recommended: false,
    recommendation_source: template.is_ghost ? "template" : null,
  }));
}

/**
 * 학생의 캠프 초대 목록 조회
 */
export const getStudentCampInvitations = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
  }

  const invitations = await getCampInvitationsForStudent(user.userId);

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
              camp_location: template.camp_location,
              camp_start_date: template.camp_start_date,
              camp_end_date: template.camp_end_date,
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
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    if (!invitationId || typeof invitationId !== "string") {
      throw new AppError(
        "초대 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const invitation = await getCampInvitation(invitationId);
    if (!invitation) {
      throw new AppError(
        "초대를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (invitation.student_id !== user.userId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const template = await getCampTemplate(invitation.camp_template_id);
    if (!template) {
      throw new AppError(
        "템플릿을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
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
  ): Promise<{
    success: boolean;
    groupId?: string;
    invitationId?: string;
    error?: string;
  }> => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    if (!invitationId || typeof invitationId !== "string") {
      throw new AppError(
        "초대 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (!wizardData) {
      throw new AppError(
        "참여 정보가 필요합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const { validatePartialWizardDataSafe } = await import("@/lib/schemas/planWizardSchema");
    const validation = validatePartialWizardDataSafe(wizardData);
    if (!validation.success) {
      const errorMessages = validation.error.errors.map((err) => {
        const path = err.path.join(".");
        return `${path}: ${err.message}`;
      });
      throw new AppError(
        `입력 데이터 검증 실패: ${errorMessages.join(", ")}`,
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

    const invitation = await getCampInvitation(invitationId);
    if (!invitation) {
      throw new AppError(
        "초대를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (invitation.student_id !== user.userId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    if (invitation.status !== "pending") {
      throw new AppError(
        "이미 처리된 초대입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: existingGroup, error: checkError } = await supabase
      .from("plan_groups")
      .select("id, status, camp_invitation_id")
      .eq("camp_invitation_id", invitationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("[campActions] 기존 플랜 그룹 확인 중 에러:", checkError);
      throw new AppError(
        "기존 플랜 그룹 확인 중 오류가 발생했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

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
      if (existingGroup.status === "draft") {
        console.log("[campActions] 기존 draft 플랜 그룹 발견, 업데이트 진행:", {
          invitationId,
          groupId: existingGroup.id,
          status: existingGroup.status,
        });
      }
    }

    const template = await getCampTemplate(invitation.camp_template_id);
    if (!template) {
      throw new AppError(
        "템플릿을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (template.status === "archived") {
      throw new AppError(
        "보관된 템플릿에는 참여할 수 없습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const templateDataRaw = template.template_data;
    let templateData: Partial<WizardData> = {};

    if (templateDataRaw && typeof templateDataRaw === "object") {
      const templateValidation = validatePartialWizardDataSafe(templateDataRaw);
      if (templateValidation.success) {
        templateData = templateValidation.data;
      } else {
        console.warn("[campActions] 템플릿 데이터 검증 실패, 원본 데이터 사용:", {
          errors: templateValidation.error.errors.map((err) => ({
            path: err.path.join("."),
            message: err.message,
          })),
        });
        templateData = templateDataRaw as Partial<WizardData>;
      }
    }

    let templateBlockSetId: string | null = null;
    const { data: templateBlockSetLink } = await supabase
      .from("camp_template_block_sets")
      .select("tenant_block_set_id")
      .eq("camp_template_id", template.id)
      .maybeSingle();

    if (templateBlockSetLink) {
      templateBlockSetId = templateBlockSetLink.tenant_block_set_id;
    } else if (templateData.block_set_id) {
      templateBlockSetId = templateData.block_set_id;
    }

    const templateExclusions = (templateData.exclusions || []).map(
      (exclusion) => ({
        ...exclusion,
        source: "template" as const,
        is_locked: true,
      })
    );

    const templateAcademySchedules = (templateData.academy_schedules || []).map(
      (schedule) => ({
        ...schedule,
        source: "template" as const,
        is_locked: true,
      })
    );

    console.log("[campActions] 템플릿 학원 일정:", {
      templateId: invitation.camp_template_id,
      templateAcademySchedulesCount: templateAcademySchedules.length,
      templateAcademySchedules: templateAcademySchedules,
      wizardDataAcademySchedulesCount:
        wizardData.academy_schedules?.length || 0,
      wizardDataAcademySchedules: wizardData.academy_schedules,
    });

    const mergedData: Partial<WizardData> = {
      ...templateData,
      name: wizardData.name || templateData.name || "",
      plan_purpose: wizardData.plan_purpose || templateData.plan_purpose || "",
      scheduler_type:
        wizardData.scheduler_type ||
        templateData.scheduler_type ||
        "1730_timetable",
      period_start: wizardData.period_start || templateData.period_start || "",
      period_end: wizardData.period_end || templateData.period_end || "",
      block_set_id: wizardData.block_set_id || templateBlockSetId || "",
      academy_schedules: [
        ...templateAcademySchedules,
        ...(wizardData.academy_schedules?.filter(
          (s) => s.source !== "template"
        ) || []),
      ],
      student_contents: wizardData.student_contents || [],
      recommended_contents: wizardData.recommended_contents || [],
      exclusions: (() => {
        type BaseExclusion = Omit<(typeof templateExclusions)[number], "source">;
        type MergedExclusion = BaseExclusion & { source: "template" | "student"; is_locked: boolean };
        const mergedExclusions: MergedExclusion[] = templateExclusions.map(e => ({ ...e, source: e.source as "template" | "student" }));

        (wizardData.exclusions || []).forEach((studentExclusion) => {
          if (studentExclusion.source === "template") {
            return;
          }

          const templateExclusion = templateExclusions.find(
            (te) => te.exclusion_date === studentExclusion.exclusion_date
          );

          if (templateExclusion) {
            if (
              isHigherPriorityExclusionType(
                studentExclusion.exclusion_type,
                templateExclusion.exclusion_type
              )
            ) {
              const index = mergedExclusions.findIndex(
                (e) => e.exclusion_date === studentExclusion.exclusion_date
              );
              if (index !== -1) {
                mergedExclusions[index] = {
                  ...studentExclusion,
                  source: "student",
                  is_locked: false,
                } as MergedExclusion;
              }
            }
          } else {
            mergedExclusions.push({
              ...studentExclusion,
              source: "student",
              is_locked: false,
            } as MergedExclusion);
          }
        });

        return mergedExclusions;
      })(),
      subject_allocations: undefined,
      student_level:
        wizardData.student_level || templateData.student_level || undefined,
      time_settings: wizardData.time_settings || templateData.time_settings,
      scheduler_options:
        wizardData.scheduler_options || templateData.scheduler_options,
      study_review_cycle:
        wizardData.study_review_cycle || templateData.study_review_cycle,
    };

    const blockSetId = mergedData.block_set_id || templateBlockSetId;
    console.log("[campActions] template_block_set_id 저장 준비:", {
      blockSetId,
      mergedData_block_set_id: mergedData.block_set_id,
      templateBlockSetId,
      mergedData_scheduler_options_before: mergedData.scheduler_options,
    });

    if (blockSetId) {
      if (!mergedData.scheduler_options) {
        mergedData.scheduler_options = {};
      }
      if (typeof mergedData.scheduler_options === "object" && mergedData.scheduler_options !== null) {
        (mergedData.scheduler_options as Record<string, unknown>).template_block_set_id = blockSetId;
      }
      console.log(
        "[campActions] mergedData.scheduler_options에 template_block_set_id 추가:",
        {
          template_block_set_id: blockSetId,
          scheduler_options: mergedData.scheduler_options,
        }
      );
    }

    const fullWizardData: WizardData = {
      name: mergedData.name || "",
      plan_purpose: mergedData.plan_purpose || "",
      scheduler_type: mergedData.scheduler_type || "1730_timetable",
      scheduler_options: mergedData.scheduler_options,
      period_start: mergedData.period_start || "",
      period_end: mergedData.period_end || "",
      target_date: mergedData.target_date,
      block_set_id: mergedData.block_set_id || "",
      exclusions: mergedData.exclusions || [],
      academy_schedules: mergedData.academy_schedules || [],
      time_settings: mergedData.time_settings,
      student_contents: mergedData.student_contents || [],
      recommended_contents: mergedData.recommended_contents || [],
      study_review_cycle: mergedData.study_review_cycle,
      student_level: mergedData.student_level,
      subject_allocations: mergedData.subject_allocations,
      subject_constraints: mergedData.subject_constraints,
      additional_period_reallocation: mergedData.additional_period_reallocation,
      non_study_time_blocks: mergedData.non_study_time_blocks,
      daily_schedule: mergedData.daily_schedule,
      templateLockedFields: mergedData.templateLockedFields,
      plan_type: mergedData.plan_type,
      camp_template_id: mergedData.camp_template_id,
      camp_invitation_id: mergedData.camp_invitation_id,
      show_required_subjects_ui: mergedData.show_required_subjects_ui,
      content_allocations: mergedData.content_allocations,
      allocation_mode: mergedData.allocation_mode,
    };

    const { syncWizardDataToCreationData } = await import(
      "@/lib/utils/planGroupDataSync"
    );
    const creationData = syncWizardDataToCreationData(fullWizardData);

    console.log("[campActions] syncWizardDataToCreationData 호출 후:", {
      creationData_scheduler_options: creationData.scheduler_options,
      has_template_block_set_id: !!(creationData.scheduler_options && typeof creationData.scheduler_options === "object"
        ? (creationData.scheduler_options as Record<string, unknown>).template_block_set_id
        : false),
    });

    console.log("[campActions] 병합된 학원 일정:", {
      mergedAcademySchedulesCount: mergedData.academy_schedules?.length || 0,
      mergedAcademySchedules: mergedData.academy_schedules,
    });

    console.log("[campActions] 변환된 학원 일정 (creationData):", {
      creationDataAcademySchedulesCount:
        creationData.academy_schedules?.length || 0,
      creationDataAcademySchedules: creationData.academy_schedules,
    });

    const masterContentIdMap = new Map<string, string | null>();
    const studentContentIds = (wizardData.student_contents || []).filter(
      (c) => c.content_type === "book" || c.content_type === "lecture"
    );
    const bookIds = studentContentIds
      .filter((c) => c.content_type === "book")
      .map((c) => c.content_id);
    const lectureIds = studentContentIds
      .filter((c) => c.content_type === "lecture")
      .map((c) => c.content_id);

    console.log("[campActions] 학생 콘텐츠 master_content_id 조회 시작:", {
      invitationId,
      studentId: user.userId,
      bookIdsCount: bookIds.length,
      lectureIdsCount: lectureIds.length,
      bookIds,
      lectureIds,
    });

    if (bookIds.length > 0) {
      const { data: books, error: booksError } = await supabase
        .from("books")
        .select("id, master_content_id")
        .in("id", bookIds)
        .eq("student_id", user.userId);

      if (booksError) {
        console.error("[campActions] 교재 master_content_id 조회 실패:", {
          error: booksError.message,
          code: booksError.code,
          bookIds,
        });
      } else {
        books?.forEach((book) => {
          masterContentIdMap.set(book.id, book.master_content_id || null);
        });
        console.log("[campActions] 교재 master_content_id 조회 완료:", {
          foundCount: books?.length || 0,
          masterContentIds:
            books?.map((b) => ({
              id: b.id,
              master_content_id: b.master_content_id,
            })) || [],
        });
      }
    }

    if (lectureIds.length > 0) {
      const { data: lectures, error: lecturesError } = await supabase
        .from("lectures")
        .select("id, master_content_id")
        .in("id", lectureIds)
        .eq("student_id", user.userId);

      if (lecturesError) {
        console.error("[campActions] 강의 master_content_id 조회 실패:", {
          error: lecturesError.message,
          code: lecturesError.code,
          lectureIds,
        });
      } else {
        lectures?.forEach((lecture) => {
          masterContentIdMap.set(lecture.id, lecture.master_content_id || null);
        });
        console.log("[campActions] 강의 master_content_id 조회 완료:", {
          foundCount: lectures?.length || 0,
          masterContentIds:
            lectures?.map((l) => ({
              id: l.id,
              master_content_id: l.master_content_id,
            })) || [],
        });
      }
    }

    const contentsBeforeMapping = creationData.contents.length;
    creationData.contents = creationData.contents.map((c) => {
      const masterContentId = masterContentIdMap.get(c.content_id) || null;

      const startDetailId = "start_detail_id" in c ? (c.start_detail_id ?? null) : null;
      const endDetailId = "end_detail_id" in c ? (c.end_detail_id ?? null) : null;

      if (
        wizardData.student_contents?.some(
          (sc) => sc.content_id === c.content_id
        )
      ) {
        console.log("[campActions] 학생 추가 콘텐츠 정보:", {
          content_id: c.content_id,
          content_type: c.content_type,
          master_content_id: masterContentId,
          start_range: c.start_range,
          end_range: c.end_range,
          start_detail_id: startDetailId,
          end_detail_id: endDetailId,
        });
      }

      if (
        wizardData.recommended_contents?.some(
          (rc) => rc.content_id === c.content_id
        )
      ) {
        console.log("[campActions] 학생 선택 추천 콘텐츠 정보:", {
          content_id: c.content_id,
          content_type: c.content_type,
          master_content_id: masterContentId,
          start_range: c.start_range,
          end_range: c.end_range,
          start_detail_id: startDetailId,
          end_detail_id: endDetailId,
        });
      }

      return {
        ...c,
        master_content_id: masterContentId,
        start_detail_id: startDetailId,
        end_detail_id: endDetailId,
      };
    });

    console.log("[campActions] 콘텐츠 master_content_id 매핑 완료:", {
      contentsBeforeMapping,
      contentsAfterMapping: creationData.contents.length,
      contentsWithMasterId: creationData.contents.filter(
        (c) => c.master_content_id
      ).length,
      contentsWithoutMasterId: creationData.contents.filter(
        (c) => !c.master_content_id
      ).length,
      contentsWithDetailIds: creationData.contents.filter(
        (c) => ("start_detail_id" in c && c.start_detail_id) || ("end_detail_id" in c && c.end_detail_id)
      ).length,
    });

    creationData.block_set_id = null;

    type SchedulerOptionsWithTemplateBlockSet = SchedulerOptions & {
      template_block_set_id?: string;
    };

    const schedulerOptions = creationData.scheduler_options as SchedulerOptionsWithTemplateBlockSet | null | undefined;
    if (!schedulerOptions?.template_block_set_id && blockSetId) {
      console.warn(
        "[campActions] creationData.scheduler_options에 template_block_set_id가 없어 추가:",
        {
          blockSetId,
          creationData_scheduler_options: creationData.scheduler_options,
        }
      );
      if (!creationData.scheduler_options) {
        creationData.scheduler_options = {};
      }
      (creationData.scheduler_options as SchedulerOptionsWithTemplateBlockSet).template_block_set_id =
        blockSetId;
      console.log(
        "[campActions] creationData.scheduler_options에 template_block_set_id 추가 완료:",
        {
          scheduler_options: creationData.scheduler_options,
        }
      );
    } else {
      console.log(
        "[campActions] creationData.scheduler_options에 template_block_set_id 확인됨:",
        {
          template_block_set_id: schedulerOptions?.template_block_set_id,
        }
      );
    }

    if (
      creationData.academy_schedules &&
      creationData.academy_schedules.length > 0
    ) {
      const { getStudentAcademySchedules } = await import(
        "@/lib/data/planGroups"
      );
      const existingSchedules = await getStudentAcademySchedules(
        user.userId,
        tenantContext.tenantId
      );

      const existingKeys = new Set(
        existingSchedules.map(
          (s) =>
            `${s.day_of_week}:${s.start_time}:${s.end_time}:${
              s.academy_name || ""
            }:${s.subject || ""}`
        )
      );

      const newSchedules = creationData.academy_schedules.filter((s) => {
        const key = `${s.day_of_week}:${s.start_time}:${s.end_time}:${
          s.academy_name || ""
        }:${s.subject || ""}`;
        return !existingKeys.has(key);
      });

      console.log("[campActions] 학원 일정 업데이트:", {
        studentId: user.userId,
        totalSchedules: creationData.academy_schedules.length,
        existingSchedulesCount: existingSchedules.length,
        newSchedulesCount: newSchedules.length,
        skippedCount:
          creationData.academy_schedules.length - newSchedules.length,
      });

      const deleteQuery = supabase
        .from("academy_schedules")
        .delete()
        .eq("student_id", user.userId);

      if (tenantContext.tenantId) {
        deleteQuery.eq("tenant_id", tenantContext.tenantId);
      }

      const { error: deleteError } = await deleteQuery;

      if (deleteError) {
        console.warn(
          "[campActions] 기존 학원 일정 삭제 실패 (무시하고 계속 진행):",
          deleteError
        );
      } else {
        console.log("[campActions] 기존 학원 일정 삭제 완료");
      }

      if (newSchedules.length > 0) {
        const { createStudentAcademySchedules } = await import(
          "@/lib/data/planGroups"
        );
        const schedulesResult = await createStudentAcademySchedules(
          user.userId,
          tenantContext.tenantId,
          newSchedules.map((s) => ({
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            academy_name: s.academy_name || null,
            subject: s.subject || null,
          }))
        );

        if (!schedulesResult.success) {
          console.warn(
            "[campActions] 학원 일정 추가 실패 (무시하고 계속 진행):",
            schedulesResult.error
          );
        } else {
          console.log("[campActions] 학원 일정 추가 완료:", {
            addedCount: newSchedules.length,
          });
        }
      } else if (creationData.academy_schedules.length > 0) {
        console.log("[campActions] 모든 학원 일정이 이미 존재합니다.");
      }
    }

    let groupId: string;

    if (existingGroup && existingGroup.status === "draft") {
      const { updatePlanGroupDraftAction } = await import("@/lib/domains/plan");

      // 슬롯 템플릿을 content_slots로 변환 (draft 업데이트용)
      let contentSlotsForDraft: ContentSlot[] | null = null;
      const templateSlotTemplatesForDraft = template.slot_templates;
      if (Array.isArray(templateSlotTemplatesForDraft) && templateSlotTemplatesForDraft.length > 0) {
        contentSlotsForDraft = convertSlotTemplatesToContentSlots(
          templateSlotTemplatesForDraft as SlotTemplate[]
        );
        console.log("[campActions] (draft) 슬롯 템플릿을 content_slots로 변환:", {
          templateSlotTemplatesCount: templateSlotTemplatesForDraft.length,
          contentSlotsCount: contentSlotsForDraft.length,
        });
      }

      const updateData = {
        ...creationData,
        plan_type: "camp" as const,
        camp_template_id: invitation.camp_template_id,
        camp_invitation_id: invitationId,
        content_slots: contentSlotsForDraft,
        use_slot_mode: contentSlotsForDraft !== null && contentSlotsForDraft.length > 0,
      };

      type SchedulerOptionsWithTemplateBlockSet = SchedulerOptions & {
        template_block_set_id?: string;
      };

      const updateSchedulerOptions = updateData.scheduler_options as SchedulerOptionsWithTemplateBlockSet | null | undefined;
      console.log("[campActions] 플랜 그룹 업데이트 전 최종 데이터 확인:", {
        scheduler_options: updateData.scheduler_options,
        has_template_block_set_id: !!updateSchedulerOptions?.template_block_set_id,
        template_block_set_id: updateSchedulerOptions?.template_block_set_id,
      });

      await updatePlanGroupDraftAction(existingGroup.id, updateData);
      groupId = existingGroup.id;
    } else {
      const { data: existingGroupByTemplate, error: checkExistingError } = await supabase
        .from("plan_groups")
        .select("id, status, camp_invitation_id")
        .eq("camp_template_id", invitation.camp_template_id)
        .eq("student_id", user.userId)
        .eq("plan_type", "camp")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (checkExistingError && checkExistingError.code !== "PGRST116") {
        console.warn("[campActions] 기존 플랜 그룹 확인 중 에러 (무시하고 계속 진행):", checkExistingError);
      }

      if (existingGroupByTemplate && existingGroupByTemplate.camp_invitation_id !== invitationId) {
        console.log("[campActions] 재 초대 시 이전 플랜 그룹 발견, 삭제 진행:", {
          existingGroupId: existingGroupByTemplate.id,
          existingInvitationId: existingGroupByTemplate.camp_invitation_id,
          currentInvitationId: invitationId,
          status: existingGroupByTemplate.status,
        });

        const { error: deleteExistingError } = await supabase
          .from("student_plan")
          .delete()
          .eq("plan_group_id", existingGroupByTemplate.id);

        if (deleteExistingError) {
          console.warn("[campActions] 이전 플랜 삭제 실패 (무시하고 계속 진행):", deleteExistingError);
        } else {
          await supabase.from("plan_contents").delete().eq("plan_group_id", existingGroupByTemplate.id);
          await supabase.from("plan_exclusions").delete().eq("plan_group_id", existingGroupByTemplate.id);

          const { error: deleteGroupError } = await supabase
            .from("plan_groups")
            .delete()
            .eq("id", existingGroupByTemplate.id);

          if (deleteGroupError) {
            console.warn("[campActions] 이전 플랜 그룹 삭제 실패 (무시하고 계속 진행):", deleteGroupError);
          } else {
            console.log("[campActions] 이전 플랜 그룹 삭제 완료:", existingGroupByTemplate.id);
          }
        }
      }

      // 슬롯 템플릿을 content_slots로 변환
      let contentSlots: ContentSlot[] | null = null;
      const templateSlotTemplates = template.slot_templates;
      if (Array.isArray(templateSlotTemplates) && templateSlotTemplates.length > 0) {
        contentSlots = convertSlotTemplatesToContentSlots(
          templateSlotTemplates as SlotTemplate[]
        );
        console.log("[campActions] 슬롯 템플릿을 content_slots로 변환:", {
          templateSlotTemplatesCount: templateSlotTemplates.length,
          contentSlotsCount: contentSlots.length,
        });
      }

      const planGroupData = {
        ...creationData,
        plan_type: "camp" as const,
        camp_template_id: invitation.camp_template_id,
        camp_invitation_id: invitationId,
        content_slots: contentSlots,
        use_slot_mode: contentSlots !== null && contentSlots.length > 0,
      };

      type SchedulerOptionsWithTemplateBlockSet = SchedulerOptions & {
        template_block_set_id?: string;
      };

      const planGroupSchedulerOptions = planGroupData.scheduler_options as SchedulerOptionsWithTemplateBlockSet | null | undefined;
      console.log("[campActions] 플랜 그룹 생성 전 최종 데이터 확인:", {
        scheduler_options: planGroupData.scheduler_options,
        has_template_block_set_id: !!planGroupSchedulerOptions?.template_block_set_id,
        template_block_set_id: planGroupSchedulerOptions?.template_block_set_id,
      });

      let result;
      try {
        result = await createPlanGroupAction(planGroupData, {
          skipContentValidation: true,
        });
      } catch (createError) {
        // 동시 수락으로 인한 UNIQUE 제약 위반 감지 (PostgreSQL error code 23505)
        const errorMessage = createError instanceof Error ? createError.message : String(createError);
        if (errorMessage.includes("23505") || errorMessage.includes("unique") || errorMessage.includes("duplicate")) {
          console.warn("[campActions] 동시 수락 감지 - 이미 플랜 그룹이 생성됨:", {
            invitationId,
            studentId: user.userId,
            error: errorMessage,
          });
          throw new AppError(
            "이미 다른 요청에서 캠프 참여가 처리되었습니다. 페이지를 새로고침해주세요.",
            ErrorCode.DUPLICATE_ENTRY,
            409,
            true
          );
        }
        throw createError;
      }

      if (!result.groupId) {
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

    const { error: statusUpdateError } = await supabase
      .from("plan_groups")
      .update({ status: "saved", updated_at: new Date().toISOString() })
      .eq("id", groupId);

    if (statusUpdateError) {
      console.error(
        "[campActions] 플랜 그룹 상태 업데이트 실패:",
        statusUpdateError
      );
      console.warn(
        "[campActions] 플랜 그룹 상태를 saved로 변경하지 못했습니다. 관리자에게 문의해주세요."
      );
    }

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

    if (createdGroup.camp_invitation_id !== invitationId) {
      console.warn(
        "[campActions] camp_invitation_id가 일치하지 않음, 업데이트 시도:",
        {
          expected: invitationId,
          actual: createdGroup.camp_invitation_id,
          groupId: groupId,
        }
      );

      const { error: updateError } = await supabase
        .from("plan_groups")
        .update({ camp_invitation_id: invitationId })
        .eq("id", groupId);

      if (updateError) {
        console.error(
          "[campActions] camp_invitation_id 업데이트 실패:",
          updateError
        );
      } else {
        console.log("[campActions] camp_invitation_id 업데이트 성공");
      }
    }

    const updateResult = await updateCampInvitationStatus(
      invitationId,
      "accepted"
    );
    if (!updateResult.success) {
      // 트랜잭션 롤백: 초대 상태 업데이트 실패 시 생성된 플랜 그룹 삭제
      console.error(
        "[campActions] 초대 상태 업데이트 실패 - 롤백 시작:",
        {
          invitationId,
          groupId,
          studentId: user.userId,
          error: updateResult.error,
        }
      );

      try {
        // 1. 플랜 삭제
        await supabase
          .from("student_plan")
          .delete()
          .eq("plan_group_id", groupId);

        // 2. 플랜 콘텐츠 삭제
        await supabase
          .from("plan_contents")
          .delete()
          .eq("plan_group_id", groupId);

        // 3. 플랜 제외일 삭제
        await supabase
          .from("plan_exclusions")
          .delete()
          .eq("plan_group_id", groupId);

        // 4. 플랜 그룹 삭제
        await supabase
          .from("plan_groups")
          .delete()
          .eq("id", groupId);

        console.log("[campActions] 롤백 완료 - 플랜 그룹 삭제됨:", { groupId });
      } catch (rollbackError) {
        console.error("[campActions] 롤백 실패:", {
          groupId,
          error: rollbackError,
        });
      }

      throw new AppError(
        "캠프 참여 처리 중 오류가 발생했습니다. 다시 시도해주세요.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    } else {
      console.log("[campActions] 초대 상태 업데이트 성공:", {
        invitationId,
        groupId,
        studentId: user.userId,
      });

      // 관리자에게 캠프 참여 수락 알림 발송
      try {
        const { sendCampAcceptanceNotificationToAdmins } = await import(
          "@/lib/services/campNotificationService"
        );
        const { data: student } = await supabase
          .from("students")
          .select("name")
          .eq("user_id", user.userId)
          .single();

        await sendCampAcceptanceNotificationToAdmins({
          templateId: invitation.camp_template_id,
          templateName: template.name,
          studentId: user.userId,
          studentName: student?.name || "알 수 없음",
          tenantId: tenantContext.tenantId,
          groupId: groupId,
        });
      } catch (notificationError) {
        // 알림 발송 실패는 로그만 남기고 계속 진행
        console.error("[campActions] 관리자 알림 발송 실패:", notificationError);
      }
    }

    revalidatePath("/camp");
    revalidatePath(`/camp/${invitationId}`);
    revalidatePath(`/admin/camp-templates/${invitation.camp_template_id}/participants`);
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      groupId: groupId,
      invitationId: invitationId,
    };
  }
);

/**
 * 캠프 초대 거절
 */
export const declineCampInvitation = withErrorHandling(
  async (
    invitationId: string,
    declineReason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    if (!invitationId || typeof invitationId !== "string") {
      throw new AppError(
        "초대 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const invitation = await getCampInvitation(invitationId);
    if (!invitation) {
      throw new AppError(
        "초대를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (invitation.student_id !== user.userId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    if (invitation.status !== "pending") {
      throw new AppError(
        "이미 처리된 초대입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    // 기존 draft 플랜 그룹이 있으면 삭제
    const { data: draftGroup } = await supabase
      .from("plan_groups")
      .select("id")
      .eq("camp_invitation_id", invitationId)
      .eq("status", "draft")
      .maybeSingle();

    if (draftGroup) {
      // 관련 데이터 삭제
      await supabase.from("student_plan").delete().eq("plan_group_id", draftGroup.id);
      await supabase.from("plan_contents").delete().eq("plan_group_id", draftGroup.id);
      await supabase.from("plan_exclusions").delete().eq("plan_group_id", draftGroup.id);
      await supabase.from("plan_groups").delete().eq("id", draftGroup.id);
    }

    // 초대 상태를 declined로 업데이트하고 거절 사유 저장
    const { error: updateError } = await supabase
      .from("camp_invitations")
      .update({
        status: "declined",
        decline_reason: declineReason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitationId);

    if (updateError) {
      console.error("[declineCampInvitation] 초대 상태 업데이트 실패:", updateError);
      throw new AppError(
        "초대 거절 처리에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    const template = await getCampTemplate(invitation.camp_template_id);

    revalidatePath("/camp");
    revalidatePath(`/camp/${invitationId}`);
    if (template) {
      revalidatePath(`/admin/camp-templates/${template.id}/participants`);
    }

    return { success: true };
  }
);

/**
 * 캠프 참여 취소 (accepted 상태에서 취소)
 */
export const cancelCampParticipation = withErrorHandling(
  async (
    invitationId: string,
    cancelReason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    if (!invitationId || typeof invitationId !== "string") {
      throw new AppError(
        "초대 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const invitation = await getCampInvitation(invitationId);
    if (!invitation) {
      throw new AppError(
        "초대를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (invitation.student_id !== user.userId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    if (invitation.status !== "accepted") {
      throw new AppError(
        "참여 상태가 아닌 초대는 취소할 수 없습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    // 플랜 그룹 조회
    const { data: planGroup } = await supabase
      .from("plan_groups")
      .select("id, status")
      .eq("camp_invitation_id", invitationId)
      .maybeSingle();

    // 플랜 그룹이 active/paused 상태면 취소 불가 (학습이 이미 시작됨)
    if (planGroup && (planGroup.status === "active" || planGroup.status === "paused")) {
      throw new AppError(
        "학습이 시작된 캠프는 취소할 수 없습니다. 관리자에게 문의해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 플랜 그룹이 있으면 삭제
    if (planGroup) {
      await supabase.from("student_plan").delete().eq("plan_group_id", planGroup.id);
      await supabase.from("plan_contents").delete().eq("plan_group_id", planGroup.id);
      await supabase.from("plan_exclusions").delete().eq("plan_group_id", planGroup.id);
      await supabase.from("plan_groups").delete().eq("id", planGroup.id);
    }

    // 초대 상태를 cancelled로 업데이트 (사용자 취소 상태)
    const { error: updateError } = await supabase
      .from("camp_invitations")
      .update({
        status: "cancelled",
        cancel_reason: cancelReason || null,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitationId);

    if (updateError) {
      console.error("[cancelCampParticipation] 초대 상태 업데이트 실패:", updateError);
      throw new AppError(
        "참여 취소 처리에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    const template = await getCampTemplate(invitation.camp_template_id);

    revalidatePath("/camp");
    revalidatePath(`/camp/${invitationId}`);
    if (template) {
      revalidatePath(`/admin/camp-templates/${template.id}/participants`);
    }

    return { success: true };
  }
);

/**
 * 참여 정보 수정 (accepted 상태에서 수정)
 * 플랜이 아직 생성되지 않은 경우에만 수정 가능
 */
export const editCampParticipation = withErrorHandling(
  async (
    invitationId: string
  ): Promise<{ success: boolean; canEdit: boolean; redirectUrl?: string; error?: string }> => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const invitation = await getCampInvitation(invitationId);
    if (!invitation) {
      throw new AppError(
        "초대를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (invitation.student_id !== user.userId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    if (invitation.status !== "accepted") {
      return {
        success: false,
        canEdit: false,
        error: "참여 상태가 아닌 초대는 수정할 수 없습니다.",
      };
    }

    const supabase = await createSupabaseServerClient();

    // 플랜 그룹 및 플랜 존재 여부 확인
    const { data: planGroup } = await supabase
      .from("plan_groups")
      .select("id, status")
      .eq("camp_invitation_id", invitationId)
      .maybeSingle();

    if (!planGroup) {
      return {
        success: false,
        canEdit: false,
        error: "플랜 그룹을 찾을 수 없습니다.",
      };
    }

    // 플랜이 생성되었는지 확인
    const { data: plans } = await supabase
      .from("student_plan")
      .select("id")
      .eq("plan_group_id", planGroup.id)
      .limit(1);

    const hasPlans = (plans?.length || 0) > 0;

    if (hasPlans) {
      return {
        success: false,
        canEdit: false,
        error: "이미 플랜이 생성되어 참여 정보를 수정할 수 없습니다.",
      };
    }

    // 플랜 그룹 상태가 active/paused면 수정 불가
    if (planGroup.status === "active" || planGroup.status === "paused") {
      return {
        success: false,
        canEdit: false,
        error: "학습이 시작된 캠프는 수정할 수 없습니다.",
      };
    }

    // 플랜 그룹을 draft로 변경하고 초대 상태를 pending으로 변경
    const { error: groupUpdateError } = await supabase
      .from("plan_groups")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", planGroup.id);

    if (groupUpdateError) {
      console.error("[editCampParticipation] 플랜 그룹 상태 업데이트 실패:", groupUpdateError);
      throw new AppError(
        "수정 모드 전환에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    const { error: invitationUpdateError } = await supabase
      .from("camp_invitations")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", invitationId);

    if (invitationUpdateError) {
      console.error("[editCampParticipation] 초대 상태 업데이트 실패:", invitationUpdateError);
      // 롤백
      await supabase
        .from("plan_groups")
        .update({ status: "saved" })
        .eq("id", planGroup.id);
      throw new AppError(
        "수정 모드 전환에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    revalidatePath("/camp");
    revalidatePath(`/camp/${invitationId}`);

    return {
      success: true,
      canEdit: true,
      redirectUrl: `/camp/${invitationId}`,
    };
  }
);
