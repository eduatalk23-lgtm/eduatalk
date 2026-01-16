"use server";

/**
 * 콘텐츠 달력 관련 Server Actions
 *
 * 2단계 플랜 생성 시스템의 2단계 - 타임존에 콘텐츠 추가 및 플랜 생성
 */

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceContext } from "./core";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import {
  calculateStudyReviewCycle,
  calculateContentAllocationDates as calc1730AllocationDates,
  distributeContentRange,
  generateContentReviewPlan,
  getReviewDateForWeek,
  getTotalWeeks,
  type CycleDayInfo,
  type ContentSchedulerOptions as Logic1730Options,
} from "@/lib/plan/1730TimetableLogic";
import type {
  AddContentInput,
  PlanPreview,
  ContentSchedulerOptions,
  ContentSchedulerMode,
  PlanContentWithScheduler,
} from "@/lib/types/plan/timezone";

// =====================================================
// 결과 타입
// =====================================================

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// =====================================================
// 콘텐츠 추가
// =====================================================

/**
 * 타임존에 콘텐츠 추가 (Step 2)
 */
export async function addContentToTimezone(
  input: AddContentInput
): Promise<ActionResult<{ content_id: string; preview: PlanPreview[] }>> {
  try {
    const ctx = await getServiceContext();
    const supabase = await createSupabaseServerClient();

    logActionDebug(
      { domain: "plan", action: "addContentToTimezone" },
      "Processing content addition request",
      { input }
    );

    // 타임존 확인
    const { data: timezone, error: tzError } = await supabase
      .from("plan_groups")
      .select("*")
      .eq("id", input.timezone_id)
      .eq("student_id", ctx.studentId)
      .eq("is_timezone_only", true)
      .single();

    if (tzError) throw new Error("타임존을 찾을 수 없습니다");

    // 기존 콘텐츠 개수 조회 (display_order 계산용)
    const { count } = await supabase
      .from("plan_contents")
      .select("*", { count: "exact", head: true })
      .eq("plan_group_id", input.timezone_id);

    const displayOrder = (count ?? 0) + 1;

    // 새 콘텐츠 생성 (필요한 경우)
    const contentId = input.content_id;
    let masterContentId = input.master_content_id;

    if (input.new_content && !contentId) {
      // 커스텀 콘텐츠 생성
      const { data: newContent, error: contentError } = await supabase
        .from("master_custom_contents")
        .insert({
          tenant_id: ctx.tenantId,
          title: input.new_content.title,
          subject: input.new_content.subject,
          total_pages: input.new_content.total_pages,
          total_episodes: input.new_content.total_episodes,
        })
        .select("id")
        .single();

      if (contentError) throw contentError;
      masterContentId = newContent.id;
    }

    // 범위 설정
    const startRange = input.range?.start ?? 1;
    const endRange = input.range?.end ?? 100;

    // plan_contents에 저장
    const { data: planContent, error: insertError } = await supabase
      .from("plan_contents")
      .insert({
        plan_group_id: input.timezone_id,
        content_type: input.content_type,
        content_id: contentId,
        master_content_id: masterContentId,
        start_range: startRange,
        end_range: endRange,
        display_order: displayOrder,
        scheduler_mode: input.scheduler_mode,
        content_scheduler_options: input.scheduler_options,
        generation_status: "pending",
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // 플랜 미리보기 생성
    const preview = await generatePlanPreview(
      input.timezone_id,
      planContent.id,
      startRange,
      endRange,
      input.scheduler_mode,
      input.scheduler_options
    );

    // 타임존 상태를 ready로 변경 (첫 콘텐츠 추가 시)
    if (timezone.timezone_status === "draft") {
      await supabase
        .from("plan_groups")
        .update({ timezone_status: "ready" })
        .eq("id", input.timezone_id);
    }

    revalidatePath(`/plan/timezone/${input.timezone_id}`);

    return {
      success: true,
      data: { content_id: planContent.id, preview },
    };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "addContentToTimezone" },
      error,
      { timezoneId: input.timezone_id, contentType: input.content_type }
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "콘텐츠 추가 중 오류가 발생했습니다",
    };
  }
}

/**
 * 콘텐츠별 플랜 생성
 */
export async function generatePlansForContent(
  timezoneId: string,
  contentId: string
): Promise<ActionResult<{ count: number }>> {
  try {
    const ctx = await getServiceContext();
    const supabase = await createSupabaseServerClient();

    // 콘텐츠 정보 조회
    const { data: content, error: contentError } = await supabase
      .from("plan_contents")
      .select("*")
      .eq("id", contentId)
      .eq("plan_group_id", timezoneId)
      .single();

    if (contentError) throw new Error("콘텐츠를 찾을 수 없습니다");

    // 타임존 정보 조회
    const { data: timezone, error: tzError } = await supabase
      .from("plan_groups")
      .select(
        `
        *,
        plan_exclusions(exclusion_date, type),
        academy_schedules(day_of_week, start_time, end_time)
      `
      )
      .eq("id", timezoneId)
      .single();

    if (tzError) throw tzError;

    // 스케줄러 옵션 결정 (inherit인 경우 기본값 사용)
    const schedulerOptions: ContentSchedulerOptions =
      content.scheduler_mode === "inherit"
        ? (timezone.default_scheduler_options as ContentSchedulerOptions) || getDefaultSchedulerOptions()
        : (content.content_scheduler_options as ContentSchedulerOptions) || getDefaultSchedulerOptions();

    // 1730TimetableLogic 사용하여 주기 계산
    const cycleDays = calculateStudyReviewCycle(
      timezone.period_start,
      timezone.period_end,
      { study_days: schedulerOptions.study_days ?? 6, review_days: schedulerOptions.review_days ?? 1 },
      (timezone.plan_exclusions || []).map((e: { exclusion_date: string }) => ({
        exclusion_date: e.exclusion_date,
        type: "custom" as const,
      }))
    );

    // 1730TimetableLogic의 콘텐츠별 배정 함수 사용
    const logic1730Options: Logic1730Options = {
      subject_type: schedulerOptions.subject_type,
      weekly_allocation_days: schedulerOptions.weekly_allocation_days,
      target_type: schedulerOptions.target_type ?? "page",
      target_value: schedulerOptions.target_value ?? content.end_range - content.start_range + 1,
      auto_review: schedulerOptions.auto_review ?? true,
      review_ratio: schedulerOptions.review_ratio ?? 0.3,
      distribution_strategy: schedulerOptions.distribution_strategy ?? "even",
    };

    const allocationDates = calc1730AllocationDates(cycleDays, logic1730Options);

    // 1730TimetableLogic의 범위 분배 함수 사용
    const rangeMap = distributeContentRange(
      content.start_range,
      content.end_range,
      allocationDates,
      logic1730Options.distribution_strategy
    );

    // 플랜 생성
    const plans = [];
    for (const [date, range] of rangeMap) {
      plans.push({
        plan_group_id: timezoneId,
        student_id: ctx.studentId,
        tenant_id: ctx.tenantId,
        content_id: content.content_id,
        content_type: content.content_type,
        plan_date: date,
        day_type: "study" as const,
        range_start: range.start,
        range_end: range.end,
        status: "pending" as const,
        plan_content_id: contentId,
      });
    }

    // 플랜 저장
    if (plans.length > 0) {
      const { error: insertError } = await supabase
        .from("student_plan")
        .insert(plans);

      if (insertError) throw insertError;
    }

    // 콘텐츠 상태 업데이트
    await supabase
      .from("plan_contents")
      .update({ generation_status: "generated" })
      .eq("id", contentId);

    // 복습일 생성 (옵션에 따라)
    if (schedulerOptions.auto_review) {
      await generateReviewPlansForContentInternal(timezoneId, contentId, cycleDays, schedulerOptions);
    }

    revalidatePath(`/plan/timezone/${timezoneId}`);

    return { success: true, data: { count: plans.length } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "플랜 생성 중 오류가 발생했습니다",
    };
  }
}

/**
 * 콘텐츠 스케줄 옵션 수정
 */
export async function updateContentSchedule(
  contentId: string,
  options: Partial<ContentSchedulerOptions>
): Promise<ActionResult<void>> {
  try {
    const ctx = await getServiceContext();
    const supabase = await createSupabaseServerClient();

    // 기존 옵션 조회
    const { data: content, error: fetchError } = await supabase
      .from("plan_contents")
      .select("content_scheduler_options, plan_group_id")
      .eq("id", contentId)
      .single();

    if (fetchError) throw fetchError;

    // 옵션 병합
    const currentOptions = (content.content_scheduler_options ||
      {}) as ContentSchedulerOptions;
    const updatedOptions = { ...currentOptions, ...options };

    // 업데이트
    const { error } = await supabase
      .from("plan_contents")
      .update({
        content_scheduler_options: updatedOptions,
        scheduler_mode: "custom",
        generation_status: "modified",
      })
      .eq("id", contentId);

    if (error) throw error;

    revalidatePath(`/plan/timezone/${content.plan_group_id}`);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "스케줄 옵션 수정 중 오류가 발생했습니다",
    };
  }
}

/**
 * 콘텐츠별 플랜 재생성
 */
export async function regeneratePlansForContent(
  timezoneId: string,
  contentId: string
): Promise<ActionResult<{ count: number }>> {
  try {
    const supabase = await createSupabaseServerClient();

    // 기존 플랜 삭제
    const { error: deleteError } = await supabase
      .from("student_plan")
      .delete()
      .eq("plan_group_id", timezoneId)
      .eq("plan_content_id", contentId);

    if (deleteError) throw deleteError;

    // 새로 생성
    return generatePlansForContent(timezoneId, contentId);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "플랜 재생성 중 오류가 발생했습니다",
    };
  }
}

/**
 * 타임존에서 콘텐츠 제거
 */
export async function removeContentFromTimezone(
  timezoneId: string,
  contentId: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createSupabaseServerClient();

    // 연관 플랜 삭제
    await supabase
      .from("student_plan")
      .delete()
      .eq("plan_group_id", timezoneId)
      .eq("plan_content_id", contentId);

    // 콘텐츠 삭제
    const { error } = await supabase
      .from("plan_contents")
      .delete()
      .eq("id", contentId)
      .eq("plan_group_id", timezoneId);

    if (error) throw error;

    revalidatePath(`/plan/timezone/${timezoneId}`);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "콘텐츠 제거 중 오류가 발생했습니다",
    };
  }
}

/**
 * 콘텐츠 목록 조회
 */
export async function getTimezoneContents(
  timezoneId: string
): Promise<ActionResult<PlanContentWithScheduler[]>> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("plan_contents")
      .select(
        `
        id,
        plan_group_id,
        content_type,
        content_id,
        master_content_id,
        start_range,
        end_range,
        display_order,
        scheduler_mode,
        content_scheduler_options,
        generation_status
      `
      )
      .eq("plan_group_id", timezoneId)
      .order("display_order");

    if (error) throw error;

    const contents: PlanContentWithScheduler[] = (data || []).map((c) => ({
      id: c.id,
      plan_group_id: c.plan_group_id,
      content_type: c.content_type as "book" | "lecture" | "custom",
      content_id: c.content_id,
      master_content_id: c.master_content_id,
      start_range: c.start_range,
      end_range: c.end_range,
      display_order: c.display_order,
      scheduler_mode: (c.scheduler_mode || "inherit") as ContentSchedulerMode,
      content_scheduler_options: c.content_scheduler_options as
        | ContentSchedulerOptions
        | undefined,
      generation_status: (c.generation_status || "pending") as
        | "pending"
        | "generated"
        | "modified",
    }));

    return { success: true, data: contents };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "콘텐츠 목록 조회 중 오류가 발생했습니다",
    };
  }
}

// =====================================================
// 헬퍼 함수
// =====================================================

/**
 * 기본 스케줄러 옵션
 */
function getDefaultSchedulerOptions(): ContentSchedulerOptions {
  return {
    study_days: 6,
    review_days: 1,
    target_type: "page",
    target_value: 100,
    auto_review: true,
    review_ratio: 0.3,
    distribution_strategy: "even",
  };
}

/**
 * 플랜 미리보기 생성
 */
async function generatePlanPreview(
  timezoneId: string,
  contentId: string,
  startRange: number,
  endRange: number,
  schedulerMode: ContentSchedulerMode,
  schedulerOptions?: ContentSchedulerOptions
): Promise<PlanPreview[]> {
  const supabase = await createSupabaseServerClient();

  // 타임존 정보 조회
  const { data: timezone } = await supabase
    .from("plan_groups")
    .select(
      `
      period_start,
      period_end,
      default_scheduler_options,
      plan_exclusions(exclusion_date)
    `
    )
    .eq("id", timezoneId)
    .single();

  if (!timezone) return [];

  // 스케줄러 옵션 결정
  const options: ContentSchedulerOptions =
    schedulerMode === "inherit"
      ? (timezone.default_scheduler_options as ContentSchedulerOptions) || getDefaultSchedulerOptions()
      : schedulerOptions || getDefaultSchedulerOptions();

  // 배정 날짜 계산
  const exclusionDates = (timezone.plan_exclusions || []).map(
    (e: { exclusion_date: string }) => e.exclusion_date
  );
  const dates = calculateContentAllocationDates(
    timezone.period_start,
    timezone.period_end,
    exclusionDates,
    options
  );

  // 미리보기 생성
  const totalRange = endRange - startRange + 1;
  const rangePerDay = Math.ceil(totalRange / dates.length);
  const previews: PlanPreview[] = [];

  let currentPos = startRange;

  for (let i = 0; i < dates.length && currentPos <= endRange; i++) {
    const date = dates[i];
    const isLastDay = i === dates.length - 1;
    const dayEnd = isLastDay
      ? endRange
      : Math.min(currentPos + rangePerDay - 1, endRange);

    previews.push({
      date,
      day_type: "study",
      content_id: contentId,
      content_title: "", // TODO: 콘텐츠 제목 조인
      range_start: currentPos,
      range_end: dayEnd,
      estimated_duration_minutes: (dayEnd - currentPos + 1) * 3, // 페이지당 3분 추정
    });

    currentPos = dayEnd + 1;
  }

  return previews;
}

/**
 * 콘텐츠별 학습일 배정 날짜 계산
 */
function calculateContentAllocationDates(
  periodStart: string,
  periodEnd: string,
  exclusionDates: string[],
  options: ContentSchedulerOptions
): string[] {
  const dates: string[] = [];
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const exclusionSet = new Set(exclusionDates);

  const studyDays = options.study_days ?? 6;
  const reviewDays = options.review_days ?? 1;
  const cycleLength = studyDays + reviewDays;

  // 전략/취약 과목 모드에 따른 배정
  const weeklyAllocationDays = options.weekly_allocation_days ?? 7;
  const isStrategySubject = options.subject_type === "strategy";

  let dayIndex = 0;
  let weekDayCount = 0;
  let lastWeekNumber = -1;

  for (
    let current = new Date(start);
    current <= end;
    current.setDate(current.getDate() + 1)
  ) {
    const dateStr = current.toISOString().split("T")[0];

    // 제외일 건너뛰기
    if (exclusionSet.has(dateStr)) {
      continue;
    }

    // 복습일 건너뛰기 (학습일만 포함)
    const cyclePosition = dayIndex % cycleLength;
    if (cyclePosition >= studyDays) {
      dayIndex++;
      continue;
    }

    // 전략과목 모드: 주당 N일만 배정
    if (isStrategySubject) {
      const weekNumber = getWeekNumber(current);
      if (weekNumber !== lastWeekNumber) {
        weekDayCount = 0;
        lastWeekNumber = weekNumber;
      }

      if (weekDayCount >= weeklyAllocationDays) {
        dayIndex++;
        continue;
      }
      weekDayCount++;
    }

    dates.push(dateStr);
    dayIndex++;
  }

  return dates;
}

/**
 * 주차 번호 계산
 */
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * 콘텐츠별 복습 플랜 생성 (1730TimetableLogic 사용)
 */
async function generateReviewPlansForContentInternal(
  timezoneId: string,
  contentId: string,
  cycleDays: CycleDayInfo[],
  options: ContentSchedulerOptions
): Promise<void> {
  const ctx = await getServiceContext();
  const supabase = await createSupabaseServerClient();

  // 생성된 학습 플랜 조회
  const { data: studyPlans } = await supabase
    .from("student_plan")
    .select("*")
    .eq("plan_group_id", timezoneId)
    .eq("plan_content_id", contentId)
    .eq("day_type", "study")
    .order("plan_date");

  if (!studyPlans || studyPlans.length === 0) return;

  const totalWeeks = getTotalWeeks(cycleDays);
  const reviewPlans = [];

  const logic1730Options: Logic1730Options = {
    target_type: options.target_type ?? "page",
    target_value: options.target_value ?? 100,
    auto_review: options.auto_review ?? true,
    review_ratio: options.review_ratio ?? 0.3,
    distribution_strategy: options.distribution_strategy ?? "even",
  };

  // 각 주차에 대해 복습 플랜 생성
  for (let weekNum = 1; weekNum <= totalWeeks; weekNum++) {
    // 해당 주차의 복습일 날짜 찾기
    const reviewDate = getReviewDateForWeek(cycleDays, weekNum);
    if (!reviewDate) continue;

    // 해당 주차의 학습 플랜 필터링
    const weekStudyPlans = studyPlans
      .filter((p) => {
        const planCycleDay = cycleDays.find((cd) => cd.date === p.plan_date);
        return planCycleDay && planCycleDay.cycle_number === weekNum;
      })
      .map((p) => ({
        date: p.plan_date,
        range_start: p.range_start,
        range_end: p.range_end,
        estimated_duration: (p.range_end - p.range_start + 1) * 3, // 페이지당 3분 추정
      }));

    if (weekStudyPlans.length === 0) continue;

    // 1730TimetableLogic의 복습 플랜 생성 함수 사용
    const reviewPlan = generateContentReviewPlan(
      contentId,
      weekStudyPlans,
      reviewDate,
      weekNum,
      logic1730Options
    );

    if (reviewPlan) {
      reviewPlans.push({
        plan_group_id: timezoneId,
        student_id: ctx.studentId,
        tenant_id: ctx.tenantId,
        content_id: studyPlans[0].content_id,
        content_type: studyPlans[0].content_type,
        plan_date: reviewPlan.plan_date,
        day_type: "review" as const,
        range_start: reviewPlan.range_start,
        range_end: reviewPlan.range_end,
        status: "pending" as const,
        plan_content_id: contentId,
        review_group_id: crypto.randomUUID(),
        review_source_content_ids: weekStudyPlans.map(() => contentId),
      });
    }
  }

  // 복습 플랜 저장
  if (reviewPlans.length > 0) {
    await supabase.from("student_plan").insert(reviewPlans);
  }
}
