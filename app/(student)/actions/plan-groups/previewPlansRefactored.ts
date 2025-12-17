"use server";

import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { assignPlanTimes, calculatePlanEstimatedTime } from "@/lib/plan/assignPlanTimes";
import { timeToMinutes } from "@/lib/utils/time";
import {
  getPlanGroupWithDetailsByRole,
  getStudentIdForPlanGroup,
  getSupabaseClientForStudent,
  shouldBypassStatusCheck,
  verifyPlanGroupAccess,
} from "@/lib/auth/planGroupAuth";
import { ensureAdminClient } from "@/lib/supabase/clientSelector";
import { calculateAvailableDates } from "@/lib/scheduler/calculateAvailableDates";
import { generatePlansFromGroup } from "@/lib/plan/scheduler";
import {
  resolveContentIds,
  loadContentDurations,
  loadContentMetadata,
} from "@/lib/plan/contentResolver";
import { extractScheduleMaps } from "@/lib/plan/planDataLoader";
import { getSchedulerOptionsWithTimeSettings } from "@/lib/utils/schedulerOptions";

// 프리뷰 플랜 타입
type PreviewPlan = {
  plan_date: string;
  block_index: number;
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  content_title: string | null;
  content_subject: string | null;
  content_subject_category: string | null;
  content_category: string | null;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  chapter: string | null;
  start_time: string | null;
  end_time: string | null;
  day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
  week: number | null;
  day: number | null;
  is_partial: boolean;
  is_continued: boolean;
  plan_number: number | null;
};

/**
 * 리팩토링된 _previewPlansFromGroup 함수
 * - contentResolver 모듈 사용으로 코드 중복 제거
 * - planDataLoader 모듈 사용으로 스케줄 계산 로직 분리
 */
async function _previewPlansFromGroupRefactored(
  groupId: string
): Promise<{ plans: PreviewPlan[] }> {
  try {
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

    const bypassStatusCheck = shouldBypassStatusCheck(
      access.role,
      group.plan_type ?? null
    );

    if (!bypassStatusCheck) {
      if (group.status !== "saved" && group.status !== "active") {
        throw new AppError(
          "플랜 그룹이 저장되거나 활성화된 상태에서만 플랜을 미리볼 수 있습니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
    }

    // 2. 안전한 배열 변환
    const safeExclusions = Array.isArray(exclusions) ? exclusions : [];
    const safeAcademySchedules = Array.isArray(academySchedules)
      ? academySchedules
      : [];

    // 3. 블록 세트 조회
    let baseBlocks: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
    }> = [];

    if (group.block_set_id) {
      const { data: blockSet } = await supabase
        .from("student_block_sets")
        .select("id, name, student_id")
        .eq("id", group.block_set_id)
        .maybeSingle();

      if (blockSet) {
        const { data: blockRows } = await supabase
          .from("student_block_schedule")
          .select("day_of_week, start_time, end_time")
          .eq("block_set_id", group.block_set_id)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true });

        if (blockRows && blockRows.length > 0) {
          baseBlocks = blockRows.map((row) => ({
            day_of_week: row.day_of_week,
            start_time: row.start_time,
            end_time: row.end_time,
          }));
        }
      }
    }

    // scheduler_options에서 TimeSettings 추출 (타입 안전하게)
    const groupSchedulerOptions = getSchedulerOptionsWithTimeSettings(group);

    // 4. 스케줄 계산
    const scheduleResult = calculateAvailableDates(
      group.period_start,
      group.period_end,
      baseBlocks,
      safeExclusions.map((e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: e.exclusion_type as
          | "휴가"
          | "개인사정"
          | "휴일지정"
          | "기타",
        reason: e.reason || undefined,
      })),
      safeAcademySchedules.map((a) => ({
        day_of_week: a.day_of_week,
        start_time: a.start_time,
        end_time: a.end_time,
        academy_name: a.academy_name || undefined,
        subject: a.subject || undefined,
        travel_time: a.travel_time || undefined,
      })),
      {
        scheduler_type: group.scheduler_type || "1730_timetable",
        scheduler_options: group.scheduler_options || null,
        use_self_study_with_blocks: true,
        enable_self_study_for_holidays:
          groupSchedulerOptions?.enable_self_study_for_holidays === true,
        enable_self_study_for_study_days:
          groupSchedulerOptions?.enable_self_study_for_study_days === true,
        lunch_time: groupSchedulerOptions?.lunch_time,
        camp_study_hours: groupSchedulerOptions?.camp_study_hours,
        camp_self_study_hours: groupSchedulerOptions?.camp_self_study_hours,
        designated_holiday_hours: groupSchedulerOptions?.designated_holiday_hours,
      }
    );

    // 5. 스케줄 맵 추출 (새 모듈 사용)
    const { dateTimeSlots, dateMetadataMap, weekDatesMap } =
      extractScheduleMaps(scheduleResult);

    // 6. 콘텐츠 ID 해석 (새 모듈 사용)
    const contentIdMap = await resolveContentIds(
      contents,
      studentId,
      queryClient,
      masterQueryClient
    );

    // 7. 콘텐츠 소요시간 조회 (새 모듈 사용)
    const contentDurationMap = await loadContentDurations(
      contents,
      contentIdMap,
      studentId,
      queryClient,
      masterQueryClient
    );

    // 8. dateAvailableTimeRanges 추출
    const dateAvailableTimeRanges = new Map<
      string,
      Array<{ start: string; end: string }>
    >();
    scheduleResult.daily_schedule.forEach((daily) => {
      if (
        daily.day_type === "학습일" &&
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

    // 9. 스케줄러 호출 (플랜 생성)
    const scheduledPlans = await generatePlansFromGroup(
      group,
      contents,
      safeExclusions,
      safeAcademySchedules,
      [],
      undefined,
      undefined,
      dateAvailableTimeRanges,
      dateTimeSlots,
      contentDurationMap
    );

    // 10. 콘텐츠 메타데이터 조회 (새 모듈 사용)
    const contentMetadataMap = await loadContentMetadata(
      contents,
      contentIdMap,
      studentId,
      queryClient,
      masterQueryClient
    );

    // 11. 플랜 미리보기 데이터 생성
    const previewPlans: PreviewPlan[] = [];
    const previewPlanNumberMap = new Map<string, number>();
    let previewNextPlanNumber = 1;

    // 날짜별로 그룹화
    const plansByDate = new Map<string, typeof scheduledPlans>();
    scheduledPlans.forEach((plan) => {
      if (!plansByDate.has(plan.plan_date)) {
        plansByDate.set(plan.plan_date, []);
      }
      plansByDate.get(plan.plan_date)!.push(plan);
    });

    // 각 날짜별로 처리
    for (const [date, datePlans] of plansByDate.entries()) {
      const timeSlotsForDate = dateTimeSlots.get(date) || [];
      const studyTimeSlots = timeSlotsForDate
        .filter((slot) => slot.type === "학습시간")
        .map((slot) => ({ start: slot.start, end: slot.end }))
        .sort((a, b) => {
          const aStart = a.start.split(":").map(Number);
          const bStart = b.start.split(":").map(Number);
          const aMinutes = aStart[0] * 60 + aStart[1];
          const bMinutes = bStart[0] * 60 + bStart[1];
          return aMinutes - bMinutes;
        });

      const dateMetadata = dateMetadataMap.get(date) || {
        day_type: null,
        week_number: null,
      };
      const dayType = dateMetadata.day_type || "학습일";

      const dailySchedule = scheduleResult.daily_schedule.find(
        (d) => d.date === date
      );
      const totalStudyHours = dailySchedule?.study_hours || 0;

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
          // Preserve pre-calculated times if available (from SchedulerEngine)
          _precalculated_start: plan.start_time,
          _precalculated_end: plan.end_time,
        };
      });

      // Check if we have pre-calculated times (from SchedulerEngine)
      // If ANY plan has pre-calculated time, we assume the scheduler provided a complete timeline for this day.
      const hasPrecalculatedTimes = plansForAssign.some(
        (p) => p._precalculated_start && p._precalculated_end
      );

      let timeSegments: import("@/lib/plan/assignPlanTimes").PlanTimeSegment[];

      if (hasPrecalculatedTimes) {
        // Use pre-calculated times directly
        timeSegments = plansForAssign.map((p) => {
          // Calculate estimated time for metadata (still useful)
          const estimatedTime = calculatePlanEstimatedTime(
            p,
            contentDurationMap,
            dayType
          );

          return {
            plan: p,
            start: p._precalculated_start!,
            end: p._precalculated_end!,
            isPartial: false, // SchedulerEngine handles splitting, so partials are pre-split plans
            isContinued: false,
            originalEstimatedTime: estimatedTime,
            estimatedTime: estimatedTime,
            remainingTime: 0,
            blockIndex: p.block_index || 0,
          };
        });

        // Sort by start time to match expected order
        timeSegments.sort(
          (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
        );
      } else {
        // Fallback to legacy assignment logic
        timeSegments = assignPlanTimes(
          plansForAssign,
          studyTimeSlots,
          contentDurationMap,
          dayType,
          totalStudyHours
        );
      }

      let blockIndex = 1;

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
          if (group.scheduler_type === "1730_timetable") {
            const weekDates = weekDatesMap.get(dateMetadata.week_number) || [];
            const dayIndex = weekDates.indexOf(date);
            if (dayIndex >= 0) {
              weekDay = dayIndex + 1;
            }
          } else {
            const start = new Date(group.period_start);
            const current = new Date(date);
            start.setHours(0, 0, 0, 0);
            current.setHours(0, 0, 0, 0);
            const diffTime = current.getTime() - start.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            weekDay = (diffDays % 7) + 1;
          }
        }

        // 플랜 번호 부여
        const planKey = `${date}:${segment.plan.content_id}:${segment.plan.planned_start_page_or_time}:${segment.plan.planned_end_page_or_time}`;
        let planNumber: number | null = null;

        if (previewPlanNumberMap.has(planKey)) {
          planNumber = previewPlanNumberMap.get(planKey)!;
        } else {
          planNumber = previewNextPlanNumber;
          previewPlanNumberMap.set(planKey, planNumber);
          previewNextPlanNumber++;
        }

        previewPlans.push({
          plan_date: date,
          block_index: blockIndex,
          content_type: segment.plan.content_type,
          content_id: segment.plan.content_id,
          content_title: metadata?.title || null,
          content_subject: metadata?.subject || null,
          content_subject_category: metadata?.subject_category || null,
          content_category: metadata?.category || null,
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
          plan_number: planNumber,
        });

        blockIndex++;
      }
    }

    console.log("[_previewPlansFromGroupRefactored] 플랜 미리보기 결과", {
      totalPlans: previewPlans.length,
      contentMetadataMapSize: contentMetadataMap.size,
    });

    return { plans: previewPlans };
  } catch (error) {
    console.error("[planGroupActions] 플랜 미리보기 실패:", error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      error instanceof Error ? error.message : "플랜 미리보기에 실패했습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true
    );
  }
}

export const previewPlansFromGroupRefactoredAction = withErrorHandling(
  _previewPlansFromGroupRefactored
);

// 기존 호환성을 위한 alias
export { _previewPlansFromGroupRefactored };
