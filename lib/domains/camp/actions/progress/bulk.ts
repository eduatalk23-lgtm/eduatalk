"use server";

/**
 * 캠프 플랜 그룹 대량 처리 함수
 * - bulkApplyRecommendedContents: 다수 학생에게 추천 콘텐츠 일괄 적용
 * - bulkCreatePlanGroupsForCamp: 다수 학생에게 플랜 그룹 일괄 생성
 * - bulkAdjustPlanRanges: 플랜 그룹 콘텐츠 범위 일괄 조절
 * - bulkPreviewPlans: 플랜 일괄 미리보기
 * - bulkGeneratePlans: 플랜 일괄 생성
 */

import { logActionError } from "@/lib/logging/actionLogger";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCampTemplate } from "@/lib/data/campTemplates";
import {
  AppError,
  ErrorCode,
  withErrorHandling,
} from "@/lib/errors";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import type { PreviewPlan, Exclusion, AcademySchedule, StudentInfo } from "../types";
import { getPlanContents, createPlanContents } from "@/lib/data/planGroups";
import { getRecommendedMasterContents } from "@/lib/recommendations/masterContentRecommendation";
import { logError } from "@/lib/errors/handler";

/**
 * 다수 학생에게 추천 콘텐츠 일괄 적용
 */
export const bulkApplyRecommendedContents = withErrorHandling(
  async (
    templateId: string,
    groupIds: string[],
    subjectCountsMap: Record<string, Record<string, number>>, // groupId -> (subject -> count)
    options?: {
      replaceExisting?: boolean; // 기존 추천 콘텐츠 교체 여부 (기본값: false, 유지)
    }
  ): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
    errors?: Array<{ groupId: string; error: string }>;
  }> => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 템플릿 존재 및 권한 확인
    const template = await getCampTemplate(templateId);
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

    const supabase = await createSupabaseServerClient();
    const errors: Array<{ groupId: string; error: string }> = [];
    let successCount = 0;

    // 각 플랜 그룹에 대해 추천 콘텐츠 적용
    for (const groupId of groupIds) {
      try {
        // 플랜 그룹 정보 조회
        const { data: group, error: groupError } = await supabase
          .from("plan_groups")
          .select("id, student_id, tenant_id")
          .eq("id", groupId)
          .eq("tenant_id", tenantContext.tenantId)
          .maybeSingle();

        if (groupError || !group) {
          errors.push({
            groupId,
            error: groupError?.message || "플랜 그룹을 찾을 수 없습니다.",
          });
          continue;
        }

        // 학생 ID 조회
        const studentId = group.student_id;
        if (!studentId) {
          errors.push({
            groupId,
            error: "학생 ID를 찾을 수 없습니다.",
          });
          continue;
        }

        // 해당 그룹의 교과/수량 설정 조회
        const subjectCounts = subjectCountsMap[groupId];
        if (!subjectCounts || Object.keys(subjectCounts).length === 0) {
          // 수량 설정이 없으면 스킵
          continue;
        }

        // Map으로 변환
        const requestedSubjectCounts = new Map<string, number>();
        for (const [subject, count] of Object.entries(subjectCounts)) {
          if (count > 0) {
            requestedSubjectCounts.set(subject, count);
          }
        }

        if (requestedSubjectCounts.size === 0) {
          continue;
        }

        // 추천 콘텐츠 조회
        const recommendations = await getRecommendedMasterContents(
          supabase,
          studentId,
          tenantContext.tenantId,
          requestedSubjectCounts
        );

        if (recommendations.length === 0) {
          continue;
        }

        // 기존 추천 콘텐츠 처리
        if (options?.replaceExisting) {
          // 기존 추천 콘텐츠 삭제 (is_auto_recommended가 true이거나 recommendation_source가 있는 것만)
          const existingContents = await getPlanContents(
            groupId,
            tenantContext.tenantId
          );

          if (existingContents && existingContents.length > 0) {
            const recommendedContentIds = existingContents
              .filter(
                (c) =>
                  c.is_auto_recommended || c.recommendation_source !== null
              )
              .map((c) => c.id);

            if (recommendedContentIds.length > 0) {
              const { error: deleteError } = await supabase
                .from("plan_contents")
                .delete()
                .in("id", recommendedContentIds);

              if (deleteError) {
                logError(
                  deleteError,
                  {
                    function: "bulkApplyRecommendedContents",
                    message: "기존 추천 콘텐츠 삭제 실패",
                  }
                );
              }
            }
          }
        }

        // 학생이 실제로 가지고 있는 콘텐츠만 필터링
        const validContents: Array<{
          content_type: "book" | "lecture";
          content_id: string;
          start_range: number;
          end_range: number;
          display_order: number;
          master_content_id: string | null;
          is_auto_recommended: boolean;
          recommendation_source: "admin" | null;
        }> = [];

        for (const rec of recommendations) {
          let actualContentId: string | null = null;
          let isValidContent = false;

          // 학생 콘텐츠 조회
          if (rec.contentType === "book") {
            const { data: book } = await supabase
              .from("books")
              .select("id, master_content_id")
              .eq("student_id", studentId)
              .eq("master_content_id", rec.id)
              .maybeSingle();

            if (book) {
              actualContentId = book.id;
              isValidContent = true;
            }
          } else if (rec.contentType === "lecture") {
            const { data: lecture } = await supabase
              .from("lectures")
              .select("id, master_content_id")
              .eq("student_id", studentId)
              .eq("master_content_id", rec.id)
              .maybeSingle();

            if (lecture) {
              actualContentId = lecture.id;
              isValidContent = true;
            }
          }

          if (isValidContent && actualContentId) {
            // 콘텐츠 상세 정보 조회하여 범위 설정
            let startRange = 1;
            let endRange = 100;

            try {
              if (rec.contentType === "book") {
                const { data: bookDetails } = await supabase
                  .from("book_details")
                  .select("page_number")
                  .eq("book_id", actualContentId)
                  .order("page_number", { ascending: true })
                  .limit(1);

                if (bookDetails && bookDetails.length > 0) {
                  startRange = bookDetails[0].page_number || 1;
                }

                const { data: totalData } = await supabase
                  .from("books")
                  .select("total_pages")
                  .eq("id", actualContentId)
                  .maybeSingle();

                if (totalData?.total_pages) {
                  endRange = totalData.total_pages;
                }
              } else if (rec.contentType === "lecture") {
                const { data: lectureDetails } = await supabase
                  .from("lecture_episodes")
                  .select("episode_number")
                  .eq("lecture_id", actualContentId)
                  .order("episode_number", { ascending: true })
                  .limit(1);

                if (lectureDetails && lectureDetails.length > 0) {
                  startRange = lectureDetails[0].episode_number || 1;
                }

                const { data: totalData } = await supabase
                  .from("lectures")
                  .select("total_episodes")
                  .eq("id", actualContentId)
                  .maybeSingle();

                if (totalData?.total_episodes) {
                  endRange = totalData.total_episodes;
                }
              }
            } catch (infoError) {
              // 상세 정보 조회 실패는 무시 (기본값 사용)
            }

            validContents.push({
              content_type: rec.contentType,
              content_id: actualContentId,
              start_range: startRange,
              end_range: endRange,
              display_order: validContents.length,
              master_content_id: rec.id,
              is_auto_recommended: false, // 관리자 추가는 항상 false
              recommendation_source: "admin", // 관리자 추가는 항상 "admin"
            });
          }
        }

        // 학생당 최대 9개 제한 검증
        const existingPlanContents = await getPlanContents(
          groupId,
          tenantContext.tenantId
        );
        const currentCount = existingPlanContents?.length || 0;
        const newCount = validContents.length;
        const totalCount = options?.replaceExisting
          ? currentCount -
              (existingPlanContents?.filter(
                (c) => c.is_auto_recommended || c.recommendation_source !== null
              ).length || 0) +
              newCount
          : currentCount + newCount;

        if (totalCount > 9) {
          errors.push({
            groupId,
            error: `최대 콘텐츠 수(9개)를 초과합니다. 현재: ${currentCount}개, 추가 예정: ${newCount}개, 총합: ${totalCount}개`,
          });
          continue;
        }

        // 추천 콘텐츠 저장
        if (validContents.length > 0) {
          const contentsResult = await createPlanContents(
            groupId,
            tenantContext.tenantId,
            validContents.map((c) => ({
              content_type: c.content_type,
              content_id: c.content_id,
              start_range: c.start_range,
              end_range: c.end_range,
              display_order: c.display_order,
              master_content_id: c.master_content_id,
              is_auto_recommended: c.is_auto_recommended,
              recommendation_source: c.recommendation_source,
            }))
          );

          if (!contentsResult.success) {
            errors.push({
              groupId,
              error: contentsResult.error || "콘텐츠 저장에 실패했습니다.",
            });
            continue;
          }

          successCount++;
        }
      } catch (error) {
        logError(
          error,
          {
            function: "bulkApplyRecommendedContents",
            message: `그룹 ${groupId} 처리 실패`,
          }
        );
        errors.push({
          groupId,
          error:
            error instanceof Error
              ? error.message
              : "알 수 없는 오류가 발생했습니다.",
        });
      }
    }

    return {
      success: errors.length === 0,
      successCount,
      failureCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);

/**
 * 다수 학생에게 플랜 그룹 일괄 생성
 */
export const bulkCreatePlanGroupsForCamp = withErrorHandling(
  async (
    templateId: string,
    invitationIds: string[]
  ): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
    errors?: Array<{ invitationId: string; error: string }>;
  }> => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 템플릿 존재 및 권한 확인
    const template = await getCampTemplate(templateId);
    if (!template) {
      throw new AppError(
        "템플릿을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // tenantId를 변수에 저장하여 타입 좁히기
    const tenantId = tenantContext.tenantId;

    if (template.tenant_id !== tenantId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const supabase = await createSupabaseServerClient();
    const errors: Array<{ invitationId: string; error: string }> = [];
    let successCount = 0;

    // 템플릿 데이터 준비
    const templateData = template.template_data as Partial<WizardData>;

    // 연결 테이블에서 템플릿에 연결된 블록 세트 조회
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

    // 템플릿 제외일과 학원 일정에 source, is_locked 필드 추가
    const templateExclusions = (templateData.exclusions || []).map((exclusion: Exclusion) => ({
      ...exclusion,
      exclusion_type: exclusion.exclusion_type as "기타" | "휴가" | "개인사정" | "휴일지정",
      reason: exclusion.reason ?? undefined,
      source: "template" as const,
      is_locked: true,
    }));

    const templateAcademySchedules = (templateData.academy_schedules || []).map((schedule: AcademySchedule) => ({
      ...schedule,
      source: "template" as const,
      is_locked: true,
    }));

    // 병렬 처리 함수 (최대 동시 처리 수 제한)
    const MAX_CONCURRENT = 5;
    const processInvitation = async (invitationId: string): Promise<{
      success: boolean;
      invitationId: string;
      studentId?: string;
      groupId?: string;
      error?: string;
    }> => {
      try {
        // 초대 정보 조회
        const { data: invitation, error: invitationError } = await supabase
          .from("camp_invitations")
          .select("id, student_id, camp_template_id, status")
          .eq("id", invitationId)
          .maybeSingle();

        if (invitationError || !invitation) {
          return {
            success: false,
            invitationId,
            error: invitationError?.message || "초대를 찾을 수 없습니다.",
          };
        }

        // 이미 플랜 그룹이 있는지 확인
        const { data: existingGroup } = await supabase
          .from("plan_groups")
          .select("id")
          .eq("camp_invitation_id", invitationId)
          .is("deleted_at", null)
          .maybeSingle();

        if (existingGroup) {
          // 이미 플랜 그룹이 있으면 스킵
          return {
            success: true,
            invitationId,
            studentId: invitation.student_id,
            groupId: existingGroup.id,
          };
        }

        // 템플릿 기본값으로 병합된 데이터 생성
        const mergedData: Partial<WizardData> = {
          ...templateData,
          name: templateData.name || "",
          plan_purpose: templateData.plan_purpose || "",
          scheduler_type: templateData.scheduler_type || "1730_timetable",
          period_start: templateData.period_start || "",
          period_end: templateData.period_end || "",
          block_set_id: templateBlockSetId || "",
          academy_schedules: templateAcademySchedules,
          student_contents: [],
          recommended_contents: [],
          exclusions: templateExclusions,
          subject_allocations: undefined,
          student_level: templateData.student_level || undefined,
          time_settings: templateData.time_settings,
          scheduler_options: templateData.scheduler_options,
          study_review_cycle: templateData.study_review_cycle,
        };

        // 플랜 그룹 생성 데이터 변환
        const { syncWizardDataToCreationData } = await import(
          "@/lib/utils/planGroupDataSync"
        );
        const creationData = syncWizardDataToCreationData(mergedData as WizardData);

        // 플랜 그룹 생성
        const { createPlanGroup } = await import("@/lib/data/planGroups");
        const groupResult = await createPlanGroup({
          tenant_id: tenantId,
          student_id: invitation.student_id,
          name: creationData.name || null,
          plan_purpose: creationData.plan_purpose || null,
          scheduler_type: creationData.scheduler_type,
          scheduler_options: creationData.scheduler_options || null,
          period_start: creationData.period_start,
          period_end: creationData.period_end,
          target_date: creationData.target_date || null,
          block_set_id: creationData.block_set_id || null,
          status: "draft",
          subject_constraints: creationData.subject_constraints || null,
          additional_period_reallocation: creationData.additional_period_reallocation || null,
          non_study_time_blocks: creationData.non_study_time_blocks || null,
          daily_schedule: creationData.daily_schedule || null,
          plan_type: "camp",
          camp_template_id: templateId,
          camp_invitation_id: invitationId,
        });

        if (!groupResult.success || !groupResult.groupId) {
          return {
            success: false,
            invitationId,
            studentId: invitation.student_id,
            error: groupResult.error || "플랜 그룹 생성에 실패했습니다.",
          };
        }

        const groupId = groupResult.groupId;

        // 제외일 생성
        if (creationData.exclusions && creationData.exclusions.length > 0) {
          const { createPlanExclusions } = await import("@/lib/data/planGroups");
          await createPlanExclusions(
            groupId,
            tenantId,
            creationData.exclusions.map((e) => ({
              exclusion_date: e.exclusion_date,
              exclusion_type: e.exclusion_type,
              reason: e.reason || null,
            }))
          );
        }

        // 학원 일정 생성
        if (creationData.academy_schedules && creationData.academy_schedules.length > 0) {
          const { createStudentAcademySchedules } = await import("@/lib/data/planGroups");
          await createStudentAcademySchedules(
            invitation.student_id,
            tenantId,
            creationData.academy_schedules.map((s) => ({
              day_of_week: s.day_of_week,
              start_time: s.start_time,
              end_time: s.end_time,
              academy_name: s.academy_name || null,
              subject: s.subject || null,
            })),
            true // 관리자 모드: Admin 클라이언트 사용
          );
        }

        return {
          success: true,
          invitationId,
          studentId: invitation.student_id,
          groupId,
        };
      } catch (error) {
        logError(
          error,
          {
            function: "bulkCreatePlanGroupsForCamp",
            message: `초대 ${invitationId} 처리 실패`,
          }
        );
        return {
          success: false,
          invitationId,
          error:
            error instanceof Error
              ? error.message
              : "알 수 없는 오류가 발생했습니다.",
        };
      }
    };

    // 병렬 처리 실행 (배치 단위로 처리)
    const batches: string[][] = [];
    for (let i = 0; i < invitationIds.length; i += MAX_CONCURRENT) {
      batches.push(invitationIds.slice(i, i + MAX_CONCURRENT));
    }

    const results: Array<{
      success: boolean;
      invitationId: string;
      studentId?: string;
      groupId?: string;
      error?: string;
    }> = [];

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map((invitationId) => processInvitation(invitationId))
      );
      results.push(...batchResults);
    }

    // 결과 집계
    for (const result of results) {
      if (result.success) {
        successCount++;
        // 플랜 생성 완료 알림 발송 (비동기)
        if (result.studentId && result.groupId) {
          const { sendInAppNotification } = await import(
            "@/lib/services/inAppNotificationService"
          );
          sendInAppNotification(
            result.studentId,
            "plan_created",
            "캠프 플랜이 생성되었습니다",
            `${template.name} 캠프의 학습 플랜이 생성되었습니다. 확인해주세요.`,
            {
              invitationId: result.invitationId,
              templateId,
              groupId: result.groupId,
            }
          ).catch((err) => {
            logError(
              `[bulkCreatePlanGroupsForCamp] 초대 ${result.invitationId} 알림 발송 실패:`,
              err
            );
          });
        }
      } else {
        errors.push({
          invitationId: result.invitationId,
          error: result.error || "알 수 없는 오류가 발생했습니다.",
        });
      }
    }

    return {
      success: errors.length === 0,
      successCount,
      failureCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);

/**
 * 플랜 그룹 콘텐츠 범위 일괄 조절
 */
export const bulkAdjustPlanRanges = withErrorHandling(
  async (
    groupIds: string[],
    rangeAdjustments: Record<string, Array<{
      contentId: string;
      contentType: "book" | "lecture";
      startRange?: number;
      endRange?: number;
    }>>
  ): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
    errors?: Array<{ groupId: string; error: string }>;
  }> => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();
    const errors: Array<{ groupId: string; error: string }> = [];
    let successCount = 0;

    for (const groupId of groupIds) {
      try {
        // 플랜 그룹 존재 및 권한 확인
        const { data: group, error: groupError } = await supabase
          .from("plan_groups")
          .select("id, tenant_id")
          .eq("id", groupId)
          .eq("tenant_id", tenantContext.tenantId)
          .maybeSingle();

        if (groupError || !group) {
          errors.push({
            groupId,
            error: groupError?.message || "플랜 그룹을 찾을 수 없습니다.",
          });
          continue;
        }

        // 해당 그룹의 범위 조절 정보 조회
        const adjustments = rangeAdjustments[groupId];
        if (!adjustments || adjustments.length === 0) {
          // 조절할 내용이 없으면 스킵
          successCount++;
          continue;
        }

        // 각 콘텐츠의 범위 업데이트
        for (const adjustment of adjustments) {
          const updateData: {
            start_range?: number;
            end_range?: number;
            updated_at: string;
          } = {
            updated_at: new Date().toISOString(),
          };

          if (adjustment.startRange !== undefined) {
            updateData.start_range = adjustment.startRange;
          }
          if (adjustment.endRange !== undefined) {
            updateData.end_range = adjustment.endRange;
          }

          // 범위 유효성 검증
          if (
            updateData.start_range !== undefined &&
            updateData.end_range !== undefined &&
            updateData.start_range >= updateData.end_range
          ) {
            errors.push({
              groupId,
              error: `콘텐츠 ${adjustment.contentId}의 범위가 유효하지 않습니다 (시작 >= 종료).`,
            });
            continue;
          }

          const { error: updateError } = await supabase
            .from("plan_contents")
            .update(updateData)
            .eq("plan_group_id", groupId)
            .eq("content_id", adjustment.contentId)
            .eq("content_type", adjustment.contentType);

          if (updateError) {
            logError(
              updateError,
              {
                function: "bulkAdjustPlanRanges",
                message: "콘텐츠 범위 업데이트 실패",
                groupId,
                contentId: adjustment.contentId,
              }
            );
            errors.push({
              groupId,
              error: `콘텐츠 ${adjustment.contentId} 범위 업데이트 실패: ${updateError.message}`,
            });
          }
        }

        // 에러가 없으면 성공으로 카운트
        if (!errors.some((e) => e.groupId === groupId)) {
          successCount++;
        }
      } catch (error) {
        logError(
          error,
          {
            function: "bulkAdjustPlanRanges",
            message: `그룹 ${groupId} 처리 실패`,
          }
        );
        errors.push({
          groupId,
          error:
            error instanceof Error
              ? error.message
              : "알 수 없는 오류가 발생했습니다.",
        });
      }
    }

    return {
      success: errors.length === 0,
      successCount,
      failureCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);

/**
 * 플랜 일괄 미리보기
 */
export const bulkPreviewPlans = withErrorHandling(
  async (
    groupIds: string[]
  ): Promise<{
    success: boolean;
      previews: Array<{
        groupId: string;
        studentName: string;
        planCount: number;
        previewData?: PreviewPlan[];
        error?: string;
      }>;
  }> => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();
    const { previewPlansFromGroupAction } = await import(
      "@/lib/domains/plan"
    );

    const previews: Array<{
      groupId: string;
      studentName: string;
      planCount: number;
      previewData?: PreviewPlan[];
      error?: string;
    }> = [];

    for (const groupId of groupIds) {
      try {
        // 플랜 그룹 및 학생 정보 조회
        const { data: group, error: groupError } = await supabase
          .from("plan_groups")
          .select("id, student_id, tenant_id, students:student_id(name)")
          .eq("id", groupId)
          .eq("tenant_id", tenantContext.tenantId)
          .maybeSingle();

        if (groupError || !group) {
          previews.push({
            groupId,
            studentName: "알 수 없음",
            planCount: 0,
            error: groupError?.message || "플랜 그룹을 찾을 수 없습니다.",
          });
          continue;
        }

        const studentName = (Array.isArray(group.students) && group.students.length > 0
          ? (group.students[0] as StudentInfo)?.name
          : null) || "알 수 없음";

        // 플랜 미리보기 실행
        try {
          const result = await previewPlansFromGroupAction(groupId);
          previews.push({
            groupId,
            studentName,
            planCount: result.plans.length,
            previewData: result.plans,
          });
        } catch (previewError) {
          previews.push({
            groupId,
            studentName,
            planCount: 0,
            error:
              previewError instanceof Error
                ? previewError.message
                : "플랜 미리보기에 실패했습니다.",
          });
        }
      } catch (error) {
        logError(error, {
          context: "[bulkPreviewPlans]",
          operation: "플랜 미리보기",
          groupId,
        });
        previews.push({
          groupId,
          studentName: "알 수 없음",
          planCount: 0,
          error:
            error instanceof Error
              ? error.message
              : "알 수 없는 오류가 발생했습니다.",
        });
      }
    }

    return {
      success: true,
      previews,
    };
  }
);

/**
 * 플랜 일괄 생성
 */
export const bulkGeneratePlans = withErrorHandling(
  async (
    groupIds: string[]
  ): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
    errors?: Array<{ groupId: string; error: string }>;
  }> => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();
    const { generatePlansFromGroupAction } = await import(
      "@/lib/domains/plan"
    );

    const errors: Array<{ groupId: string; error: string }> = [];
    let successCount = 0;

    for (const groupId of groupIds) {
      try {
        // 플랜 그룹 존재 및 권한 확인
        const { data: group, error: groupError } = await supabase
          .from("plan_groups")
          .select("id, tenant_id, student_id, camp_template_id, plan_type")
          .eq("id", groupId)
          .eq("tenant_id", tenantContext.tenantId)
          .maybeSingle();

        if (groupError || !group) {
          errors.push({
            groupId,
            error: groupError?.message || "플랜 그룹을 찾을 수 없습니다.",
          });
          continue;
        }

        // 플랜 생성 실행
        try {
          await generatePlansFromGroupAction(groupId);
          successCount++;

          // 캠프 모드인 경우 학생에게 알림 발송
          if (group.plan_type === "camp" && group.camp_template_id && group.student_id) {
            try {
              const [studentData, templateData] = await Promise.all([
                supabase
                  .from("students")
                  .select("name")
                  .eq("user_id", group.student_id)
                  .single(),
                supabase
                  .from("camp_templates")
                  .select("name")
                  .eq("id", group.camp_template_id)
                  .single(),
              ]);

              if (studentData.data && templateData.data) {
                const {
                  sendPlanCreatedNotificationToStudent,
                  sendPlanCreatedNotificationToParents,
                } = await import(
                  "@/lib/services/campNotificationService"
                );
                await sendPlanCreatedNotificationToStudent({
                  studentId: group.student_id,
                  studentName: studentData.data.name || "학생",
                  templateId: group.camp_template_id,
                  templateName: templateData.data.name,
                  groupId,
                  tenantId: tenantContext.tenantId,
                });

                // A4 개선: 학부모에게도 플랜 생성 알림 발송 (비동기)
                sendPlanCreatedNotificationToParents({
                  studentId: group.student_id,
                  studentName: studentData.data.name || "학생",
                  templateId: group.camp_template_id,
                  templateName: templateData.data.name,
                  groupId,
                  tenantId: tenantContext.tenantId,
                }).catch((err) => {
                  logActionError(
                    { domain: "camp", action: "generatePlansFromGroupBulkAction" },
                    err,
                    { context: "학부모 알림 발송 실패" }
                  );
                });
              }
            } catch (notificationError) {
              // 알림 발송 실패는 로그만 남기고 계속 진행
              logActionError(
                { domain: "camp", action: "bulkGeneratePlans" },
                notificationError,
                { context: "학생 알림 발송 실패" }
              );
            }
          }
        } catch (generateError) {
          logError(
            generateError,
            {
              function: "bulkGeneratePlans",
              message: `그룹 ${groupId} 플랜 생성 실패`,
            }
          );
          errors.push({
            groupId,
            error:
              generateError instanceof Error
                ? generateError.message
                : "플랜 생성에 실패했습니다.",
          });
        }
      } catch (error) {
        logError(
          error,
          {
            function: "bulkGeneratePlans",
            message: `그룹 ${groupId} 처리 실패`,
          }
        );
        errors.push({
          groupId,
          error:
            error instanceof Error
              ? error.message
              : "알 수 없는 오류가 발생했습니다.",
        });
      }
    }

    return {
      success: errors.length === 0,
      successCount,
      failureCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);
