"use server";

import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { PlanStatus } from "@/lib/types/plan";
import {
  copyMasterBookToStudent,
  copyMasterLectureToStudent,
} from "@/lib/data/contentMasters";
import { assignPlanTimes } from "@/lib/plan/assignPlanTimes";
import { updatePlanGroupStatus } from "./status";
import { timeToMinutes } from "./utils";
import {
  getPlanGroupWithDetailsByRole,
  getStudentIdForPlanGroup,
  getSupabaseClientForStudent,
  shouldBypassStatusCheck,
  verifyPlanGroupAccess,
} from "@/lib/auth/planGroupAuth";
import { ensureAdminClient } from "@/lib/supabase/clientSelector";
import {
  getBlockSetForPlanGroup,
  getBlockSetErrorMessage,
} from "@/lib/plan/blocks";
import {
  DUMMY_NON_LEARNING_CONTENT_ID,
  DUMMY_SELF_STUDY_CONTENT_ID,
  isDummyContent,
} from "@/lib/utils/planUtils";
import { calculateAvailableDates } from "@/lib/scheduler/calculateAvailableDates";
import { generatePlansFromGroup } from "@/lib/plan/scheduler";
import {
  resolveContentIds,
  loadContentDurations,
  loadContentMetadata,
} from "@/lib/plan/contentResolver";
import { extractScheduleMaps } from "@/lib/plan/planDataLoader";

/**
 * 리팩토링된 _generatePlansFromGroup 함수
 * - contentResolver 모듈 사용으로 코드 중복 제거
 * - planDataLoader 모듈 사용으로 스케줄 계산 로직 분리
 */
async function _generatePlansFromGroupRefactored(
  groupId: string
): Promise<{ count: number }> {
  const access = await verifyPlanGroupAccess();
  const tenantContext = await requireTenantContext();
  const supabase = await createSupabaseServerClient();

  // 1. 플랜 그룹 및 관련 데이터 조회
  const { group, contents, exclusions, academySchedules } =
    await getPlanGroupWithDetailsByRole(
      groupId,
      access.user.userId,
      access.role,
      tenantContext.tenantId
    );

  if (!group) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  const studentId = getStudentIdForPlanGroup(
    group,
    access.user.userId,
    access.role
  );

  const bypassStatusCheck = shouldBypassStatusCheck(
    access.role,
    group.plan_type ?? null
  );

  if (!bypassStatusCheck) {
    if (group.status !== "saved" && group.status !== "active") {
      throw new AppError(
        "플랜 그룹이 저장되거나 활성화된 상태에서만 플랜을 생성할 수 있습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
  }

  // 2. 블록 세트 조회
  const baseBlocks = await getBlockSetForPlanGroup(
    group,
    studentId,
    access.user.userId,
    access.role,
    tenantContext.tenantId
  );

  if (baseBlocks.length === 0) {
    const errorMessage = getBlockSetErrorMessage(group, false);
    throw new AppError(errorMessage, ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 3. 병합된 스케줄러 설정
  const { getMergedSchedulerSettings } = await import(
    "@/lib/data/schedulerSettings"
  );
  const mergedSettings = await getMergedSchedulerSettings(
    group.tenant_id,
    group.camp_template_id,
    group.scheduler_options as Record<string, unknown>
  );

  const schedulerOptions = {
    study_days: mergedSettings.study_review_ratio.study_days,
    review_days: mergedSettings.study_review_ratio.review_days,
    weak_subject_focus: mergedSettings.weak_subject_focus,
    review_scope: mergedSettings.review_scope,
    lunch_time: mergedSettings.lunch_time,
    camp_study_hours: mergedSettings.study_hours,
    self_study_hours: mergedSettings.self_study_hours,
  };

  // 4. 스케줄 계산
  const scheduleResult = calculateAvailableDates(
    group.period_start,
    group.period_end,
    baseBlocks.map((b) => ({
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
    })),
    exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type as
        | "휴가"
        | "개인사정"
        | "휴일지정"
        | "기타",
      reason: e.reason || undefined,
    })),
    academySchedules.map((a) => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      academy_name: a.academy_name || undefined,
      subject: a.subject || undefined,
      travel_time: a.travel_time || undefined,
    })),
    {
      scheduler_type: "1730_timetable",
      scheduler_options: schedulerOptions || null,
      use_self_study_with_blocks: true,
      enable_self_study_for_holidays:
        (group.scheduler_options as any)?.enable_self_study_for_holidays ===
        true,
      enable_self_study_for_study_days:
        (group.scheduler_options as any)?.enable_self_study_for_study_days ===
        true,
      lunch_time: schedulerOptions.lunch_time,
      camp_study_hours: schedulerOptions.camp_study_hours,
      camp_self_study_hours: schedulerOptions.self_study_hours,
      designated_holiday_hours: (group.scheduler_options as any)
        ?.designated_holiday_hours,
      non_study_time_blocks: (group as any).non_study_time_blocks || undefined,
    }
  );

  // 5. 스케줄 맵 추출 (새 모듈 사용)
  const { dateTimeSlots, dateMetadataMap, weekDatesMap } =
    extractScheduleMaps(scheduleResult);

  // dateAvailableTimeRanges 추출
  const dateAvailableTimeRanges = new Map<
    string,
    Array<{ start: string; end: string }>
  >();
  scheduleResult.daily_schedule.forEach((daily) => {
    if (
      (daily.day_type === "학습일" || daily.day_type === "복습일") &&
      daily.available_time_ranges.length > 0
    ) {
      dateAvailableTimeRanges.set(
        daily.date,
        daily.available_time_ranges.map((range) => ({
          start: range.start,
          end: range.end,
        }))
      );
    }
  });

  // 6. Supabase 클라이언트 설정
  const isAdminOrConsultant =
    access.role === "admin" || access.role === "consultant";
  const queryClient = await getSupabaseClientForStudent(
    studentId,
    access.user.userId,
    access.role
  );
  const masterQueryClient = isAdminOrConsultant
    ? ensureAdminClient()
    : supabase;

  if (!queryClient || !masterQueryClient) {
    throw new AppError(
      "Supabase 클라이언트를 생성할 수 없습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true
    );
  }

  // 7. 콘텐츠 ID 해석 및 복사 (새 모듈 사용)
  // 마스터 콘텐츠를 학생 콘텐츠로 복사 (generate에서는 실제 복사 수행)
  const contentIdMap = new Map<string, string>();

  for (const content of contents) {
    if (isDummyContent(content.content_id)) {
      contentIdMap.set(content.content_id, content.content_id);
      continue;
    }

    if (content.content_type === "book") {
      // 학생 교재 존재 여부 확인
      const { data: existingBook } = await queryClient
        .from("books")
        .select("id")
        .eq("master_content_id", content.content_id)
        .eq("student_id", studentId)
        .maybeSingle();

      if (existingBook) {
        contentIdMap.set(content.content_id, existingBook.id);
      } else {
        // 마스터 교재인지 확인
        const { data: masterBook } = await masterQueryClient
          .from("master_books")
          .select("id")
          .eq("id", content.content_id)
          .maybeSingle();

        if (masterBook) {
          // 마스터 교재 복사
          const copiedBook = await copyMasterBookToStudent(
            content.content_id,
            studentId,
            group.tenant_id
          );
          if (copiedBook) {
            contentIdMap.set(content.content_id, copiedBook.bookId);
          } else {
            contentIdMap.set(content.content_id, content.content_id);
          }
        } else {
          contentIdMap.set(content.content_id, content.content_id);
        }
      }
    } else if (content.content_type === "lecture") {
      // 학생 강의 존재 여부 확인
      const { data: existingLecture } = await queryClient
        .from("lectures")
        .select("id")
        .eq("master_content_id", content.content_id)
        .eq("student_id", studentId)
        .maybeSingle();

      if (existingLecture) {
        contentIdMap.set(content.content_id, existingLecture.id);
      } else {
        // 마스터 강의인지 확인
        const { data: masterLecture } = await masterQueryClient
          .from("master_lectures")
          .select("id")
          .eq("id", content.content_id)
          .maybeSingle();

        if (masterLecture) {
          // 마스터 강의 복사
          const copiedLecture = await copyMasterLectureToStudent(
            content.content_id,
            studentId,
            group.tenant_id
          );
          if (copiedLecture) {
            contentIdMap.set(content.content_id, copiedLecture.lectureId);
          } else {
            contentIdMap.set(content.content_id, content.content_id);
          }
        } else {
          contentIdMap.set(content.content_id, content.content_id);
        }
      }
    } else {
      // custom 콘텐츠
      contentIdMap.set(content.content_id, content.content_id);
    }
  }

  // 8. 콘텐츠 소요시간 조회 (새 모듈 사용)
  const contentDurationMap = await loadContentDurations(
    contents,
    contentIdMap,
    studentId,
    queryClient,
    masterQueryClient
  );

  // 9. 콘텐츠 메타데이터 조회 (새 모듈 사용)
  const contentMetadataMap = await loadContentMetadata(
    contents,
    contentIdMap,
    studentId,
    queryClient,
    masterQueryClient
  );

  // 10. 스케줄러 호출 (플랜 생성)
  const scheduledPlans = generatePlansFromGroup(
    group,
    contents,
    exclusions,
    academySchedules,
    [],
    undefined,
    undefined,
    dateAvailableTimeRanges,
    dateTimeSlots,
    contentDurationMap
  );

  console.log("[_generatePlansFromGroupRefactored] 스케줄러 결과:", {
    scheduledPlansCount: scheduledPlans.length,
  });

  if (scheduledPlans.length === 0) {
    throw new AppError(
      "일정에 맞는 플랜을 생성할 수 없습니다. 기간과 콘텐츠 양을 확인해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 11. 기존 플랜 삭제
  const { error: deleteError } = await supabase
    .from("plans")
    .delete()
    .eq("plan_group_id", groupId);

  if (deleteError) {
    throw new AppError(
      "기존 플랜 삭제에 실패했습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true
    );
  }

  // 12. 플랜 저장 준비 (날짜별로 그룹화하여 시간 배정)
  const planPayloads: Array<{
    plan_group_id: string;
    student_id: string;
    plan_date: string;
    block_index: number;
    status: string;
    content_type: string;
    content_id: string;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    chapter: string | null;
    start_time: string | null;
    end_time: string | null;
    day_type: string | null;
    week: number | null;
    day: number | null;
    is_partial: boolean;
    is_continued: boolean;
    content_title: string | null;
    content_subject: string | null;
    content_subject_category: string | null;
    created_at: string;
    updated_at: string;
    sequence: number | null;
  }> = [];

  // 날짜별로 그룹화
  const plansByDate = new Map<string, typeof scheduledPlans>();
  scheduledPlans.forEach((plan) => {
    if (!plansByDate.has(plan.plan_date)) {
      plansByDate.set(plan.plan_date, []);
    }
    plansByDate.get(plan.plan_date)!.push(plan);
  });

  let globalSequence = 1;

  // 각 날짜별로 처리
  for (const [date, datePlans] of plansByDate.entries()) {
    const timeSlotsForDate = dateTimeSlots.get(date) || [];
    const studyTimeSlots = timeSlotsForDate
      .filter((slot) => slot.type === "학습시간")
      .map((slot) => ({ start: slot.start, end: slot.end }))
      .sort((a, b) => {
        const aMinutes = timeToMinutes(a.start);
        const bMinutes = timeToMinutes(b.start);
        return aMinutes - bMinutes;
      });

    const dateMetadata = dateMetadataMap.get(date) || {
      day_type: null,
      week_number: null,
    };

    const dailySchedule = scheduleResult.daily_schedule.find(
      (d) => d.date === date
    );
    const totalStudyHours = dailySchedule?.study_hours || 0;
    const dayType = dateMetadata.day_type || "학습일";

    const plansForAssign = datePlans.map((plan) => {
      const finalContentId =
        contentIdMap.get(plan.content_id) || plan.content_id;
      return {
        content_id: finalContentId,
        content_type: plan.content_type,
        planned_start_page_or_time: plan.planned_start_page_or_time,
        planned_end_page_or_time: plan.planned_end_page_or_time,
        chapter: plan.chapter || null,
        block_index: plan.block_index,
      };
    });

    const timeSegments = assignPlanTimes(
      plansForAssign,
      studyTimeSlots,
      contentDurationMap,
      dayType,
      totalStudyHours
    );

    let blockIndex = 1;
    const now = new Date().toISOString();

    for (const segment of timeSegments) {
      const originalContentId =
        datePlans.find(
          (p) =>
            p.content_id === segment.plan.content_id ||
            contentIdMap.get(p.content_id) === segment.plan.content_id
        )?.content_id || segment.plan.content_id;
      const metadata = contentMetadataMap.get(originalContentId) || {};

      // 주차별 일차 계산
      let weekDay: number | null = null;
      if (dateMetadata.week_number) {
        const weekDates = weekDatesMap.get(dateMetadata.week_number) || [];
        const dayIndex = weekDates.indexOf(date);
        if (dayIndex >= 0) {
          weekDay = dayIndex + 1;
        }
      }

      planPayloads.push({
        plan_group_id: groupId,
        student_id: studentId,
        plan_date: date,
        block_index: blockIndex,
        status: "pending",
        content_type: segment.plan.content_type,
        content_id: segment.plan.content_id,
        planned_start_page_or_time: segment.plan.planned_start_page_or_time,
        planned_end_page_or_time: segment.plan.planned_end_page_or_time,
        chapter: segment.plan.chapter || null,
        start_time: segment.start,
        end_time: segment.end,
        day_type: dateMetadata.day_type,
        week: dateMetadata.week_number,
        day: weekDay,
        is_partial: segment.isPartial,
        is_continued: segment.isContinued,
        content_title: metadata?.title || null,
        content_subject: metadata?.subject || null,
        content_subject_category: metadata?.subject_category || null,
        created_at: now,
        updated_at: now,
        sequence: globalSequence++,
      });

      blockIndex++;
    }
  }

  // 13. 플랜 일괄 저장
  const { error: insertError } = await supabase.from("plans").insert(planPayloads);

  if (insertError) {
    console.error("[_generatePlansFromGroupRefactored] 플랜 저장 실패:", insertError);
    throw new AppError(
      "플랜 저장에 실패했습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true
    );
  }

  // 14. 플랜 그룹 상태 업데이트
  if ((group.status as PlanStatus) === "draft") {
    try {
      await updatePlanGroupStatus(groupId, "saved");
    } catch (error) {
      console.warn("[_generatePlansFromGroupRefactored] 플랜 그룹 상태 변경 실패:", error);
    }
  }

  return { count: scheduledPlans.length };
}

export const generatePlansFromGroupRefactoredAction = withErrorHandling(
  _generatePlansFromGroupRefactored
);

export { _generatePlansFromGroupRefactored };
