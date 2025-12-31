"use server";

/**
 * 캠프 플랜 그룹 리뷰 관련 함수
 */

import { logActionDebug } from "@/lib/logging/actionLogger";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SchedulerOptions, DailyScheduleInfo } from "@/lib/types/plan";
import { getPlanContents } from "@/lib/data/planGroups";
import { getMasterBookById, getMasterLectureById } from "@/lib/data/contentMasters";
import { getRangeRecommendationConfig } from "@/lib/recommendations/config/configManager";
import { calculateRecommendedRanges } from "@/lib/plan/rangeRecommendation";
import { timeToMinutes } from "@/lib/utils/time";
import { logError } from "@/lib/errors/handler";

/**
 * 캠프 플랜 그룹 리뷰를 위한 상세 정보 조회
 */
export const getCampPlanGroupForReview = withErrorHandling(
  async (groupId: string) => {
    logActionDebug(
      { domain: "camp", action: "getCampPlanGroupForReview" },
      "함수 호출됨",
      { groupId }
    );

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

    logActionDebug(
      { domain: "camp", action: "getCampPlanGroupForReview" },
      "플랜 그룹 조회 시작",
      { tenantId: tenantContext.tenantId }
    );

    const { getPlanGroupWithDetailsForAdmin } = await import(
      "@/lib/data/planGroups"
    );
    const result = await getPlanGroupWithDetailsForAdmin(
      groupId,
      tenantContext.tenantId
    );

    if (!result.group) {
      logError(new Error("플랜 그룹을 찾을 수 없음"), {
        function: "getCampPlanGroupForReview",
        groupId,
      });
      throw new AppError(
        "플랜 그룹을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    logActionDebug(
      { domain: "camp", action: "getCampPlanGroupForReview" },
      "플랜 그룹 조회 성공",
      { groupId: result.group.id, planType: result.group.plan_type, campTemplateId: result.group.camp_template_id }
    );

    // 캠프 플랜 그룹인지 확인
    if (result.group.plan_type !== "camp") {
      throw new AppError(
        "캠프 플랜 그룹이 아닙니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 템플릿 블록 정보 조회
    let templateBlocks: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }> = [];
    let templateBlockSetName: string | null = null;
    let templateBlockSetId: string | null = null;

    if (result.group.camp_template_id) {
      const supabase = await createSupabaseServerClient();

      // 템플릿 조회
      const { data: template, error: templateError } = await supabase
        .from("camp_templates")
        .select("template_data")
        .eq("id", result.group.camp_template_id)
        .maybeSingle();

      if (templateError) {
        logError(templateError, {
          function: "getCampPlanGroupForReview",
          templateId: result.group.camp_template_id,
        });
      } else if (!template) {
        logActionDebug(
          { domain: "camp", action: "getCampPlanGroupForReview" },
          "템플릿을 찾을 수 없음",
          { campTemplateId: result.group.camp_template_id }
        );
      } else {
        // block_set_id 찾기: 공통 함수 사용
        const { getTemplateBlockSetId } = await import("@/lib/plan/blocks");
        const schedulerOptions: SchedulerOptions = (result.group.scheduler_options as SchedulerOptions | null) ?? {};
        const tenantBlockSetId = await getTemplateBlockSetId(
          result.group.camp_template_id,
          schedulerOptions,
          tenantContext.tenantId
        );

        if (tenantBlockSetId) {
          // 2. tenant_block_sets에서 블록 세트 정보 조회
          const { data: templateBlockSet, error: blockSetError } =
            await supabase
              .from("tenant_block_sets")
              .select("id, name")
              .eq("id", tenantBlockSetId)
              .eq("tenant_id", tenantContext.tenantId)
              .maybeSingle();

          if (blockSetError) {
            logError(blockSetError, {
              function: "getCampPlanGroupForReview",
              templateId: result.group.camp_template_id,
                tenantBlockSetId,
              }
            );
          } else if (templateBlockSet) {
            templateBlockSetName = templateBlockSet.name;
            templateBlockSetId = templateBlockSet.id;

            // 3. tenant_blocks 테이블에서 블록 조회
            const { data: blocks, error: blocksError } = await supabase
              .from("tenant_blocks")
              .select("id, day_of_week, start_time, end_time")
              .eq("tenant_block_set_id", tenantBlockSetId)
              .order("day_of_week", { ascending: true })
              .order("start_time", { ascending: true });

            if (blocksError) {
              logError(
                blocksError,
                {
                  function: "getCampPlanGroupForReview",
                  message: "템플릿 블록 조회 에러",
                  tenantBlockSetId,
                }
              );
            } else if (blocks && blocks.length > 0) {
              templateBlocks = blocks.map((b) => ({
                id: b.id,
                day_of_week: b.day_of_week,
                start_time: b.start_time,
                end_time: b.end_time,
              }));

              logActionDebug(
                { domain: "camp", action: "getCampPlanGroupForReview" },
                "템플릿 블록 조회 성공",
                { blockSetName: templateBlockSetName, blockCount: templateBlocks.length }
              );
            } else {
              logActionDebug(
                { domain: "camp", action: "getCampPlanGroupForReview" },
                "템플릿 블록이 없음",
                { tenantBlockSetId, templateBlockSetName }
              );
            }
          } else {
            logActionDebug(
              { domain: "camp", action: "getCampPlanGroupForReview" },
              "템플릿 블록 세트를 찾을 수 없음",
              { tenantBlockSetId, templateId: result.group.camp_template_id }
            );
          }
        } else {
          logActionDebug(
            { domain: "camp", action: "getCampPlanGroupForReview" },
            "template_block_set_id를 찾을 수 없음",
            {
              campTemplateId: result.group.camp_template_id,
              schedulerOptions: JSON.stringify(schedulerOptions),
              hasTemplateData: !!template.template_data,
            }
          );
        }
      }
    } else {
      logActionDebug(
        { domain: "camp", action: "getCampPlanGroupForReview" },
        "camp_template_id가 없음",
        { groupId }
      );
    }

    logActionDebug(
      { domain: "camp", action: "getCampPlanGroupForReview" },
      "최종 결과",
      {
        templateBlocksCount: templateBlocks.length,
        templateBlockSetName,
        exclusionsCount: result.exclusions.length,
        academySchedulesCount: result.academySchedules.length,
      }
    );

    // 콘텐츠 상세 정보 조회 (관리자가 학생의 추가 콘텐츠 정보를 제대로 볼 수 있도록)
    let contentsWithDetails = result.contents;
    if (result.group.student_id && result.contents.length > 0) {
      try {
        // 입력 데이터 검증 및 로그
        logActionDebug(
          { domain: "camp", action: "getCampPlanGroupForReview" },
          "콘텐츠 상세 정보 조회 시작",
          {
            groupId: result.group.id,
            studentId: result.group.student_id,
            contentsCount: result.contents.length,
            contents: result.contents.map((c) => ({
              content_type: c.content_type,
              content_id: c.content_id,
              master_content_id: c.master_content_id,
              start_range: c.start_range,
              end_range: c.end_range,
            })),
        });

        const { classifyPlanContents } = await import(
          "@/lib/data/planContents"
        );
        // 관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때는 역할 정보 전달 (RLS 우회)
        const { role, userId } = await requireAdminOrConsultant();
        // superadmin은 admin으로 매핑
        const mappedRole = role === "superadmin" ? "admin" : role;
        const { studentContents, recommendedContents } =
          await classifyPlanContents(result.contents, result.group.student_id, {
            currentUserRole: mappedRole || undefined,
            currentUserId: userId || undefined,
          });

        // 조회된 콘텐츠 개수 검증
        const totalClassifiedContents = studentContents.length + recommendedContents.length;
        const totalOriginalContents = result.contents.length;

        if (totalClassifiedContents !== totalOriginalContents) {
          logActionDebug(
            { domain: "camp", action: "getCampPlanGroupForReview" },
            "콘텐츠 개수 불일치",
            {
              groupId: result.group.id,
              studentId: result.group.student_id,
              originalCount: totalOriginalContents,
              classifiedCount: totalClassifiedContents,
              studentContentsCount: studentContents.length,
              recommendedContentsCount: recommendedContents.length,
              missingCount: totalOriginalContents - totalClassifiedContents,
            }
          );
        }

        // 상세 페이지 형식으로 변환
        const allContents = [...studentContents, ...recommendedContents];
        const contentsMap = new Map(allContents.map((c) => [c.content_id, c]));

        // 각 타입별 누락 개수 집계
        const missingByType = {
          book: 0,
          lecture: 0,
          custom: 0,
        };

        contentsWithDetails = result.contents.map((content) => {
          const detail = contentsMap.get(content.content_id);
          if (!detail) {
            missingByType[content.content_type]++;
            logActionDebug(
              { domain: "camp", action: "getCampPlanGroupForReview" },
              "콘텐츠를 찾을 수 없음",
              {
                content_type: content.content_type,
                content_id: content.content_id,
                studentId: result.group?.student_id,
                groupId: result.group?.id,
              }
            );
            return {
              ...content,
              contentTitle: "알 수 없음",
              contentSubtitle: null,
              isRecommended: false,
            };
          }

          return {
            ...content,
            contentTitle: detail.title || "알 수 없음",
            contentSubtitle: detail.subject_category || null,
            isRecommended: detail.isRecommended,
          };
        });

        // 누락된 콘텐츠가 있는 경우 경고 로그
        const totalMissing =
          missingByType.book + missingByType.lecture + missingByType.custom;
        if (totalMissing > 0) {
          logActionDebug(
            { domain: "camp", action: "getCampPlanGroupForReview" },
            "누락된 콘텐츠 집계",
            {
              groupId: result.group.id,
              studentId: result.group.student_id,
              missingByType,
              totalMissing,
              totalContents: result.contents.length,
            }
          );
        }

        logActionDebug(
          { domain: "camp", action: "getCampPlanGroupForReview" },
          "콘텐츠 상세 정보 조회 완료",
          {
            groupId: result.group.id,
            studentId: result.group.student_id,
            originalContentsCount: result.contents.length,
            studentContentsCount: studentContents.length,
            recommendedContentsCount: recommendedContents.length,
            totalClassifiedCount: studentContents.length + recommendedContents.length,
            missingCount: totalMissing,
            missingByType,
          }
        );
      } catch (error) {
        logError(
          error,
          {
            function: "getCampPlanGroupForReview",
            message: "콘텐츠 상세 정보 조회 실패",
            stack: error instanceof Error ? error.stack : undefined,
            groupId: result.group.id,
            studentId: result.group.student_id,
            contentsCount: result.contents.length,
            contents: result.contents.map((c) => ({
              content_type: c.content_type,
              content_id: c.content_id,
            })),
          }
        );
        // 에러가 발생해도 원본 contents 반환
      }
    }

    return {
      success: true,
      group: result.group,
      contents: contentsWithDetails,
      originalContents: result.contents, // 원본 contents (master_content_id 포함) - classifyPlanContents 호출용
      exclusions: result.exclusions,
      academySchedules: result.academySchedules,
      templateBlocks,
      templateBlockSetName,
      templateBlockSetId,
      student_id: result.group.student_id, // 관리자 모드에서 Step6FinalReview에 전달하기 위해
    };
  }
);

/**
 * 범위 조절을 위한 플랜 그룹 콘텐츠 정보 조회
 */
export const getPlanGroupContentsForRangeAdjustment = withErrorHandling(
  async (
    groupId: string
  ): Promise<{
    success: boolean;
    contents?: Array<{
      contentId: string;
      contentType: "book" | "lecture";
      title: string;
      totalAmount: number;
      currentStartRange: number;
      currentEndRange: number;
    }>;
    scheduleSummary?: {
      total_study_days: number;
      total_study_hours: number;
    } | null;
    recommendedRanges?: Record<string, { start: number; end: number; reason: string }>;
    unavailableReasons?: Record<string, string>;
    error?: string;
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
    const adminSupabase = await createSupabaseAdminClient();

    if (!adminSupabase) {
      return {
        success: false,
        error: "Admin 클라이언트를 생성할 수 없습니다.",
      };
    }

    try {
      // 플랜 그룹 정보 조회 (period_start, period_end, daily_schedule 포함)
      const { data: group, error: groupError } = await supabase
        .from("plan_groups")
        .select("id, period_start, period_end, daily_schedule")
        .eq("id", groupId)
        .eq("tenant_id", tenantContext.tenantId)
        .maybeSingle();

      if (groupError || !group) {
        return {
          success: false,
          error: groupError?.message || "플랜 그룹을 찾을 수 없습니다.",
        };
      }

      // 콘텐츠 조회
      const contents = await getPlanContents(groupId, tenantContext.tenantId);

      // 콘텐츠 상세 정보 조회 (총량 정보 포함)
      // Admin 클라이언트를 사용하여 RLS 정책 우회
      const contentInfos: Array<{
        contentId: string;
        contentType: "book" | "lecture";
        title: string;
        totalAmount: number;
        currentStartRange: number;
        currentEndRange: number;
      }> = [];

      for (const content of contents) {
        // custom 콘텐츠는 범위 조절 대상이 아니므로 제외
        if (content.content_type === "custom") {
          continue;
        }

        try {
          let totalAmount = 0;
          let title = "알 수 없음";

          if (content.content_type === "book") {
            // Admin 클라이언트를 사용하여 학생 교재 조회 (RLS 우회)
            const { data: book } = await adminSupabase
              .from("books")
              .select("title, master_content_id")
              .eq("id", content.content_id)
              .maybeSingle();

            if (book) {
              title = book.title || "알 수 없음";

              // 마스터 콘텐츠 정보 조회 (Admin 클라이언트 사용 - RLS 우회)
              if (book.master_content_id) {
                try {
                  const { book: masterBook } = await getMasterBookById(book.master_content_id, adminSupabase);
                  if (masterBook) {
                    totalAmount = masterBook.total_pages || 0;
                  } else {
                    // 마스터 교재 조회 실패 시 Admin 클라이언트로 직접 조회 시도
                    const { data: bookInfo } = await adminSupabase
                      .from("master_books")
                      .select("total_pages")
                      .eq("id", book.master_content_id)
                      .maybeSingle();
                    totalAmount = bookInfo?.total_pages || 0;
                  }
                } catch (error) {
                  logError(error, {
                    function: "getPlanGroupContentsForRangeAdjustment",
                    masterContentId: book.master_content_id,
                    contentType: "book",
                  });
                  // 마스터 교재 조회 실패 시 Admin 클라이언트로 직접 조회 시도
                  const { data: bookInfo } = await adminSupabase
                    .from("master_books")
                    .select("total_pages")
                    .eq("id", book.master_content_id)
                    .maybeSingle();
                  totalAmount = bookInfo?.total_pages || 0;
                }
              } else {
                // 마스터 콘텐츠 ID가 없으면 직접 조회 시도
                const { data: bookInfo } = await adminSupabase
                  .from("master_books")
                  .select("total_pages")
                  .eq("id", content.content_id)
                  .maybeSingle();
                totalAmount = bookInfo?.total_pages || 0;
              }
            }
          } else if (content.content_type === "lecture") {
            // Admin 클라이언트를 사용하여 학생 강의 조회 (RLS 우회)
            const { data: lecture } = await adminSupabase
              .from("lectures")
              .select("title, master_content_id")
              .eq("id", content.content_id)
              .maybeSingle();

            if (lecture) {
              title = lecture.title || "알 수 없음";

              // 마스터 콘텐츠 정보 조회 (Admin 클라이언트 사용 - RLS 우회)
              if (lecture.master_content_id) {
                try {
                  const { lecture: masterLecture } = await getMasterLectureById(lecture.master_content_id, adminSupabase);
                  if (masterLecture) {
                    totalAmount = masterLecture.total_episodes || 0;
                  } else {
                    // 마스터 강의 조회 실패 시 Admin 클라이언트로 직접 조회 시도
                    const { data: lectureInfo } = await adminSupabase
                      .from("master_lectures")
                      .select("total_episodes")
                      .eq("id", lecture.master_content_id)
                      .maybeSingle();
                    totalAmount = lectureInfo?.total_episodes || 0;
                  }
                } catch (error) {
                  logError(error, {
                    function: "getPlanGroupContentsForRangeAdjustment",
                    masterContentId: lecture.master_content_id,
                    contentType: "lecture",
                  });
                  // 마스터 강의 조회 실패 시 Admin 클라이언트로 직접 조회 시도
                  const { data: lectureInfo } = await adminSupabase
                    .from("master_lectures")
                    .select("total_episodes")
                    .eq("id", lecture.master_content_id)
                    .maybeSingle();
                  totalAmount = lectureInfo?.total_episodes || 0;
                }
              } else {
                // 마스터 콘텐츠 ID가 없으면 직접 조회 시도
                const { data: lectureInfo } = await adminSupabase
                  .from("master_lectures")
                  .select("total_episodes")
                  .eq("id", content.content_id)
                  .maybeSingle();
                totalAmount = lectureInfo?.total_episodes || 0;
              }
            }
          }

          contentInfos.push({
            contentId: content.content_id,
            contentType: content.content_type,
            title,
            totalAmount,
            currentStartRange: content.start_range,
            currentEndRange: content.end_range,
          });
        } catch (error) {
          logError(error, {
            function: "getPlanGroupContentsForRangeAdjustment",
            contentId: content.content_id,
            contentType: content.content_type,
          });
        }
      }

      // 스케줄 요약 정보 계산
      let scheduleSummary: {
        total_study_days: number;
        total_study_hours: number;
      } | null = null;

      if (group.period_start && group.period_end) {
        let totalStudyDays = 0;
        let totalHours = 0;

        // daily_schedule이 있으면 그것을 기반으로 계산
        if (group.daily_schedule && Array.isArray(group.daily_schedule)) {
          const dailySchedule = group.daily_schedule as DailyScheduleInfo[];

          dailySchedule.forEach((day) => {
            // 학습일만 카운트
            if (day.day_type === "학습일" || day.day_type === "복습일") {
              totalStudyDays++;
            }

            // study_hours가 있으면 합산
            if (typeof day.study_hours === "number") {
              totalHours += day.study_hours;
            } else if (day.time_slots && Array.isArray(day.time_slots)) {
              // time_slots가 있으면 그것을 기반으로 계산
              day.time_slots.forEach((slot) => {
                if (slot.type === "학습시간" && slot.start && slot.end) {
                  try {
                    const startMinutes = timeToMinutes(slot.start);
                    const endMinutes = timeToMinutes(slot.end);
                    const hours = (endMinutes - startMinutes) / 60;
                    totalHours += hours;
                  } catch (error) {
                    // 시간 파싱 실패 시 무시
                  }
                }
              });
            }
          });
        }

        // daily_schedule이 없거나 비어있으면 기간 기반으로 기본값 계산
        if (totalStudyDays === 0 || totalHours === 0) {
          const startDate = new Date(group.period_start);
          const endDate = new Date(group.period_end);
          const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // 시작일과 종료일 포함

          totalStudyDays = diffDays;
          totalHours = diffDays * 3; // 기본값: 하루 3시간
        }

        scheduleSummary = {
          total_study_days: totalStudyDays,
          total_study_hours: totalHours,
        };
      }

      // 범위 추천 계산 (서버에서만 실행)
      let recommendedRanges: Map<string, { start: number; end: number; reason: string }> = new Map();
      let unavailableReasons: Map<string, string> = new Map();

      if (scheduleSummary && contentInfos.length > 0) {
        try {
          // 테넌트별 설정 조회
          const config = await getRangeRecommendationConfig(tenantContext.tenantId);

          const recommendationResult = await calculateRecommendedRanges(
            scheduleSummary,
            contentInfos.map((c) => ({
              content_id: c.contentId,
              content_type: c.contentType,
              total_amount: c.totalAmount,
            })),
            { config }
          );

          recommendedRanges = recommendationResult.ranges;
          unavailableReasons = recommendationResult.unavailableReasons;
        } catch (error) {
          logError(error, {
            context: "[getPlanGroupContentsForRangeAdjustment]",
            operation: "범위 추천 계산",
            groupId,
          });
          // 범위 추천 실패해도 기본 정보는 반환
        }
      }

      return {
        success: true,
        contents: contentInfos,
        scheduleSummary,
        recommendedRanges: Object.fromEntries(recommendedRanges),
        unavailableReasons: Object.fromEntries(unavailableReasons),
      };
    } catch (error) {
      logError(error, {
        context: "[getPlanGroupContentsForRangeAdjustment]",
        operation: "그룹 처리",
        groupId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      };
    }
  }
);
