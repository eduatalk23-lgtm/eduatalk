/**
 * 재조정 핵심 로직
 * 
 * 역할에 독립적인 재조정 로직을 제공합니다.
 * 권한 검증과 플랜 그룹 조회는 외부에서 주입받습니다.
 * 
 * @module lib/reschedule/core
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode } from "@/lib/errors";
import { executeRescheduleTransaction } from "@/lib/reschedule/transaction";
import { applyAdjustments, type AdjustmentInput } from "@/lib/reschedule/scheduleEngine";
import { isReschedulable } from "@/lib/utils/planStatusUtils";
import type { PlanGroup, PlanContent, PlanStatus } from "@/lib/types/plan";
import type { ScheduledPlan } from "@/lib/plan/scheduler";
import { getBlockSetForPlanGroup } from "@/lib/plan/blocks";
import { generatePlansFromGroup } from "@/lib/plan/scheduler";
import type { PlanGroupAllowedRole } from "@/lib/auth/planGroupAuth";
import { calculateUncompletedRangeBounds, applyUncompletedRangeToContents } from "@/lib/reschedule/uncompletedRangeCalculator";
import { getTodayDateString, calculateAdjustedPeriodUnified, PeriodCalculationError } from "@/lib/reschedule/periodCalculator";
import { generatePreviewCacheKey, getCachedPreview, cachePreviewResult } from "@/lib/reschedule/previewCache";
import { getMergedSchedulerSettings } from "@/lib/data/schedulerSettings";
import { calculateAvailableDates } from "@/lib/scheduler/calculateAvailableDates";
import { getSchedulerOptionsWithTimeSettings } from "@/lib/utils/schedulerOptions";

// ============================================
// 타입 정의
// ============================================

/**
 * 재조정 컨텍스트
 */
export interface RescheduleContext {
  /** 현재 사용자 ID */
  userId: string;
  /** 학생 ID (역할에 따라 결정) */
  studentId: string;
  /** 사용자 역할 */
  role: PlanGroupAllowedRole;
  /** 테넌트 ID */
  tenantId: string | null;
}

/**
 * 재조정 미리보기 결과
 */
export interface ReschedulePreviewResult {
  plans_before_count: number;
  plans_after_count: number;
  affected_dates: string[];
  estimated_hours: number;
  adjustments_summary: {
    range_changes: number;
    replacements: number;
    full_regenerations: number;
  };
  plans_before: Array<{
    id: string;
    plan_date: string;
    content_id: string;
    content_type: string;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    start_time: string | null;
    end_time: string | null;
    status: string | null;
  }>;
  plans_after: ScheduledPlan[];
}

/**
 * 재조정 실행 결과
 */
export interface RescheduleResult {
  success: boolean;
  reschedule_log_id: string;
  plans_before_count: number;
  plans_after_count: number;
  error?: string;
}

/**
 * 재조정 입력값 검증 결과
 */
export interface RescheduleValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================
// 입력값 검증
// ============================================

/**
 * 재조정 입력값 검증
 * 
 * @param adjustments 조정 요청 목록
 * @param contents 플랜 콘텐츠 목록
 * @returns 검증 결과
 */
export function validateRescheduleInput(
  adjustments: AdjustmentInput[],
  contents: PlanContent[]
): RescheduleValidationResult {
  if (!adjustments || adjustments.length === 0) {
    return {
      valid: false,
      error: "조정 요청이 없습니다.",
    };
  }

  if (!contents || contents.length === 0) {
    return {
      valid: false,
      error: "플랜 콘텐츠가 없습니다.",
    };
  }

  // 각 조정 요청이 유효한 콘텐츠를 참조하는지 확인
  const contentIds = new Set(contents.map((c) => c.id).filter(Boolean));
  for (const adjustment of adjustments) {
    if (!contentIds.has(adjustment.plan_content_id)) {
      return {
        valid: false,
        error: `유효하지 않은 플랜 콘텐츠 ID: ${adjustment.plan_content_id}`,
      };
    }
  }

  return { valid: true };
}


// ============================================
// 재조정 미리보기 계산
// ============================================

/**
 * 재조정 미리보기 계산
 * 
 * 역할에 독립적인 재조정 미리보기 로직입니다.
 * 
 * @param groupId 플랜 그룹 ID
 * @param context 재조정 컨텍스트
 * @param group 플랜 그룹 데이터
 * @param contents 플랜 콘텐츠 목록
 * @param exclusions 제외일 목록
 * @param academySchedules 학원 일정 목록
 * @param adjustments 조정 요청 목록
 * @param rescheduleDateRange 재조정할 플랜 범위
 * @param placementDateRange 재조정 플랜 배치 범위
 * @param includeToday 오늘 날짜 포함 여부
 * @returns 미리보기 결과
 */
export async function calculateReschedulePreview(
  groupId: string,
  context: RescheduleContext,
  group: PlanGroup,
  contents: PlanContent[],
  exclusions: Array<{ exclusion_date: string; exclusion_type: string; reason?: string | null }>,
  academySchedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
    travel_time?: number | null;
  }>,
  adjustments: AdjustmentInput[],
  rescheduleDateRange?: { from: string; to: string } | null,
  placementDateRange?: { from: string; to: string } | null,
  includeToday: boolean = false
): Promise<ReschedulePreviewResult> {
  // 캐시 조회
  const cacheKey = generatePreviewCacheKey(
    groupId,
    adjustments,
    rescheduleDateRange || null,
    placementDateRange || null,
    includeToday
  );
  const cachedResult = await getCachedPreview(cacheKey);
  if (cachedResult) {
    console.log("[reschedule/core] 캐시된 미리보기 결과 반환:", cacheKey);
    return cachedResult;
  }

  const supabase = await createSupabaseServerClient();

  // 입력값 검증
  const validation = validateRescheduleInput(adjustments, contents);
  if (!validation.valid) {
    throw new AppError(
      validation.error || "입력값 검증 실패",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 오늘 날짜 가져오기
  const today = getTodayDateString();

  // 재조정 기간 결정
  let adjustedPeriod: { start: string; end: string };
  try {
    adjustedPeriod = calculateAdjustedPeriodUnified(
      placementDateRange,
      rescheduleDateRange,
      today,
      group.period_end,
      includeToday
    );
  } catch (error) {
    if (error instanceof PeriodCalculationError) {
      throw new AppError(error.message, ErrorCode.VALIDATION_ERROR, 400, true);
    }
    throw error;
  }

  // 기존 플랜 조회 (재조정 대상만)
  let query = supabase
    .from("student_plan")
    .select(
      "id, plan_date, content_id, content_type, planned_start_page_or_time, planned_end_page_or_time, start_time, end_time, status, is_active"
    )
    .eq("plan_group_id", groupId)
    .eq("student_id", context.studentId);

  if (adjustedPeriod.start && adjustedPeriod.end) {
    query = query.gte("plan_date", adjustedPeriod.start).lte("plan_date", adjustedPeriod.end);
  }

  const { data: existingPlans } = await query;

  type StudentPlanRow = {
    id: string;
    plan_date: string;
    content_id: string | null;
    content_type: string;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    start_time: string | null;
    end_time: string | null;
    status: string | null;
    is_active: boolean | null;
  };

  const reschedulablePlans = ((existingPlans as StudentPlanRow[] | null) || []).filter((plan) =>
    isReschedulable({
      status: (plan.status as PlanStatus) || "pending",
      is_active: plan.is_active ?? true,
    })
  );

  // 오늘 이전 미진행 플랜 조회
  let pastUncompletedQuery = supabase
    .from("student_plan")
    .select(
      "content_id, planned_start_page_or_time, planned_end_page_or_time, completed_amount"
    )
    .eq("plan_group_id", groupId)
    .eq("student_id", context.studentId)
    .eq("is_active", true)
    .in("status", ["pending", "in_progress"]);

  if (includeToday) {
    pastUncompletedQuery = pastUncompletedQuery.lte("plan_date", today);
  } else {
    pastUncompletedQuery = pastUncompletedQuery.lt("plan_date", today);
  }

  const { data: pastUncompletedPlans } = await pastUncompletedQuery;

  // rescheduleDateRange가 지정된 경우, 해당 범위 내 플랜의 콘텐츠만 필터링
  let relevantPastUncompletedPlans = pastUncompletedPlans || [];
  if (rescheduleDateRange?.from && rescheduleDateRange?.to) {
    const contentIdsInRange = new Set(
      reschedulablePlans.map((p) => p.content_id).filter(Boolean)
    );
    relevantPastUncompletedPlans = relevantPastUncompletedPlans.filter(
      (p) => contentIdsInRange.has(p.content_id)
    );
  }

  // 미진행 범위 계산
  const uncompletedBoundsMap = calculateUncompletedRangeBounds(relevantPastUncompletedPlans);

  // 조정된 콘텐츠 생성
  const adjustedContents = applyAdjustments(contents, adjustments);

  // 선택된 콘텐츠 ID 추출
  const selectedContentIds = new Set<string>(
    adjustments
      .map((a) => {
        const content = contents.find((c) => c.id === a.plan_content_id);
        return content?.content_id || "";
      })
      .filter((id) => id !== "")
  );

  // 미진행 범위를 조정된 콘텐츠에 적용
  const contentsWithUncompleted = applyUncompletedRangeToContents(
    adjustedContents,
    uncompletedBoundsMap,
    selectedContentIds.size > 0 ? selectedContentIds : undefined
  );

  // 블록 세트 조회
  const baseBlocksRaw = await getBlockSetForPlanGroup(
    group,
    context.studentId,
    context.userId,
    context.role,
    context.tenantId
  );

  if (baseBlocksRaw.length === 0) {
    throw new AppError(
      "블록 세트를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // BlockInfo 타입 변환
  const baseBlocks: Array<{
    id: string;
    day_of_week: number;
    block_index: number;
    start_time: string;
    end_time: string;
    duration_minutes: number;
  }> = baseBlocksRaw.map((block, index) => {
    const start = block.start_time.split(":").map(Number);
    const end = block.end_time.split(":").map(Number);
    const startMinutes = start[0] * 60 + start[1];
    const endMinutes = end[0] * 60 + end[1];
    const durationMinutes = endMinutes - startMinutes;

    return {
      id: `block-${index}`,
      day_of_week: block.day_of_week,
      block_index: index,
      start_time: block.start_time,
      end_time: block.end_time,
      duration_minutes: durationMinutes,
    };
  });

  // 스케줄러 설정 병합
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

  // calculateAvailableDates로 스케줄 결과 계산
  const groupSchedulerOptions = getSchedulerOptionsWithTimeSettings(group);
  const scheduleResult = calculateAvailableDates(
    adjustedPeriod.start,
    adjustedPeriod.end,
    baseBlocks.map((b) => ({
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
    })),
    exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type as "휴가" | "개인사정" | "휴일지정" | "기타",
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
        groupSchedulerOptions?.enable_self_study_for_holidays === true,
      enable_self_study_for_study_days:
        groupSchedulerOptions?.enable_self_study_for_study_days === true,
      lunch_time: schedulerOptions.lunch_time,
      camp_study_hours: schedulerOptions.camp_study_hours,
      camp_self_study_hours: schedulerOptions.self_study_hours,
      designated_holiday_hours: groupSchedulerOptions?.designated_holiday_hours,
      non_study_time_blocks: group.non_study_time_blocks || undefined,
    }
  );

  // 날짜별 사용 가능 시간 범위 및 타임라인 추출
  const dateAvailableTimeRanges = new Map<
    string,
    Array<{ start: string; end: string }>
  >();
  const dateTimeSlots = new Map<
    string,
    Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>
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

    if (daily.time_slots && daily.time_slots.length > 0) {
      dateTimeSlots.set(
        daily.date,
        daily.time_slots.map((slot) => ({
          type: slot.type,
          start: slot.start,
          end: slot.end,
          label: slot.label,
        }))
      );
    }
  });

  // 콘텐츠 과목 정보 조회 (간단화: 빈 Map 사용)
  const contentSubjects = new Map<string, { subject?: string | null; subject_category?: string | null }>();

  // 실제 플랜 생성
  const generatedPlans = await generatePlansFromGroup(
    group,
    contentsWithUncompleted,
    exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type,
      reason: e.reason || null,
    })) as any,
    academySchedules.map((a) => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      academy_name: a.academy_name || null,
      subject: a.subject || null,
      travel_time: a.travel_time || null,
    })) as any,
    baseBlocks,
    contentSubjects,
    undefined, // riskIndexMap
    dateAvailableTimeRanges,
    dateTimeSlots,
    undefined, // contentDurationMap
    adjustedPeriod.start,
    adjustedPeriod.end
  );

  // 조정된 기간 내의 플랜만 필터링
  const filteredPlans = generatedPlans.filter(
    (plan) => plan.plan_date >= adjustedPeriod.start && plan.plan_date <= adjustedPeriod.end
  );

  // 영향받는 날짜 계산
  const affectedDatesSet = new Set<string>();
  filteredPlans.forEach((plan) => {
    affectedDatesSet.add(plan.plan_date);
  });
  const affectedDates = Array.from(affectedDatesSet).sort();

  // 예상 시간 계산
  let estimatedHours = 0;
  filteredPlans.forEach((plan) => {
    if (plan.start_time && plan.end_time) {
      const [startHour, startMin] = plan.start_time.split(":").map(Number);
      const [endHour, endMin] = plan.end_time.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      estimatedHours += (endMinutes - startMinutes) / 60;
    }
  });

  // 기존 플랜 상세 정보 변환
  const plansBefore = reschedulablePlans.map((plan) => ({
    id: plan.id,
    plan_date: plan.plan_date,
    content_id: plan.content_id || "",
    content_type: plan.content_type || "",
    planned_start_page_or_time: plan.planned_start_page_or_time ?? null,
    planned_end_page_or_time: plan.planned_end_page_or_time ?? null,
    start_time: plan.start_time || null,
    end_time: plan.end_time || null,
    status: plan.status || null,
  }));

  // 결과 반환
  const result: ReschedulePreviewResult = {
    plans_before_count: reschedulablePlans.length,
    plans_after_count: filteredPlans.length,
    affected_dates: affectedDates,
    estimated_hours: Math.round(estimatedHours * 10) / 10,
    adjustments_summary: {
      range_changes: adjustments.filter((a) => a.change_type === "range").length,
      replacements: adjustments.filter((a) => a.change_type === "replace").length,
      full_regenerations: adjustments.filter((a) => a.change_type === "full").length,
    },
    plans_before: plansBefore,
    plans_after: filteredPlans,
  };

  // 결과 캐싱
  await cachePreviewResult(cacheKey, result);

  return result;
}

// ============================================
// 재조정 실행
// ============================================

/**
 * 재조정 실행
 * 
 * 역할에 독립적인 재조정 실행 로직입니다.
 * 
 * @param groupId 플랜 그룹 ID
 * @param context 재조정 컨텍스트
 * @param group 플랜 그룹 데이터
 * @param previewResult 미리보기 결과
 * @param adjustments 조정 요청 목록
 * @param reason 재조정 사유
 * @param rescheduleDateRange 재조정할 플랜 범위
 * @param placementDateRange 재조정 플랜 배치 범위
 * @param includeToday 오늘 날짜 포함 여부
 * @returns 실행 결과
 */
export async function executeRescheduleOperation(
  groupId: string,
  context: RescheduleContext,
  group: PlanGroup,
  previewResult: ReschedulePreviewResult,
  adjustments: AdjustmentInput[],
  reason?: string,
  rescheduleDateRange?: { from: string; to: string } | null,
  placementDateRange?: { from: string; to: string } | null,
  includeToday: boolean = false
): Promise<RescheduleResult> {
  const newPlans = previewResult.plans_after;

  return executeRescheduleTransaction(groupId, async (supabase) => {
    // 오늘 날짜 가져오기
    const today = getTodayDateString();

    // 재조정 기간 결정
    let adjustedPeriod: { start: string; end: string };
    try {
      adjustedPeriod = calculateAdjustedPeriodUnified(
        placementDateRange,
        rescheduleDateRange,
        today,
        group.period_end,
        includeToday
      );
    } catch (error) {
      if (error instanceof PeriodCalculationError) {
        throw new AppError(error.message, ErrorCode.VALIDATION_ERROR, 400, true);
      }
      throw error;
    }

    // 기존 플랜 조회 (재조정 대상만)
    let query = supabase
      .from("student_plan")
      .select("*")
      .eq("plan_group_id", groupId)
      .eq("student_id", context.studentId);

    if (adjustedPeriod.start && adjustedPeriod.end) {
      query = query.gte("plan_date", adjustedPeriod.start).lte("plan_date", adjustedPeriod.end);
    }

    const { data: existingPlans } = await query;

    type StudentPlanFullRow = {
      id: string;
      plan_date: string;
      content_id: string | null;
      content_type: string;
      planned_start_page_or_time: number | null;
      planned_end_page_or_time: number | null;
      start_time: string | null;
      end_time: string | null;
      status: string | null;
      is_active: boolean | null;
      [key: string]: unknown;
    };

    const reschedulablePlans = ((existingPlans as StudentPlanFullRow[] | null) || []).filter((plan) =>
      isReschedulable({
        status: (plan.status as PlanStatus) || "pending",
        is_active: plan.is_active ?? true,
      })
    );

    const plansBeforeCount = reschedulablePlans.length;

    // 기존 플랜 히스토리 백업
    const planHistoryInserts = reschedulablePlans.map((plan) => ({
      plan_id: plan.id,
      plan_group_id: groupId,
      plan_data: plan as Record<string, unknown>,
      content_id: plan.content_id,
      adjustment_type: "full" as const,
    }));

    // 히스토리 저장
    if (planHistoryInserts.length > 0) {
      const { error: historyError } = await supabase.from("plan_history").insert(planHistoryInserts);

      if (historyError) {
        throw new AppError(
          `플랜 히스토리 저장 실패: ${historyError.message}`,
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
    }

    // 기존 플랜 비활성화
    const planIds = reschedulablePlans.map((p) => p.id);
    if (planIds.length > 0) {
      const { error: deactivateError } = await supabase
        .from("student_plan")
        .update({ is_active: false })
        .in("id", planIds);

      if (deactivateError) {
        throw new AppError(
          `기존 플랜 비활성화 실패: ${deactivateError.message}`,
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
    }

    // 새 플랜 저장
    let plansAfterCount = 0;
    if (newPlans.length > 0) {
      const planInserts = newPlans.map((plan) => ({
        plan_group_id: groupId,
        student_id: context.studentId,
        tenant_id: group.tenant_id,
        plan_date: plan.plan_date,
        content_id: plan.content_id,
        content_type: plan.content_type,
        planned_start_page_or_time: plan.planned_start_page_or_time,
        planned_end_page_or_time: plan.planned_end_page_or_time,
        start_time: plan.start_time,
        end_time: plan.end_time,
        status: "pending",
        is_active: true,
      }));

      // 배치 insert
      const BATCH_SIZE = 100;
      for (let i = 0; i < planInserts.length; i += BATCH_SIZE) {
        const batch = planInserts.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from("student_plan").insert(batch);

        if (insertError) {
          throw new AppError(
            `새 플랜 저장 실패: ${insertError.message}`,
            ErrorCode.DATABASE_ERROR,
            500,
            true
          );
        }
      }

      plansAfterCount = newPlans.length;
    }

    // 재조정 로그 저장
    const { data: rescheduleLog, error: logError } = await supabase
      .from("reschedule_log")
      .insert({
        plan_group_id: groupId,
        student_id: context.studentId,
        adjusted_contents: adjustments as AdjustmentInput[],
        plans_before_count: plansBeforeCount,
        plans_after_count: plansAfterCount,
        reason: reason || null,
        status: "completed",
      })
      .select("id")
      .single();

    if (logError || !rescheduleLog) {
      throw new AppError(
        `재조정 로그 저장 실패: ${logError?.message || "Unknown error"}`,
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    // 히스토리와 로그 연결
    if (planHistoryInserts.length > 0) {
      const { error: updateError } = await supabase
        .from("plan_history")
        .update({ reschedule_log_id: rescheduleLog.id })
        .eq("plan_group_id", groupId)
        .is("reschedule_log_id", null);

      if (updateError) {
        console.error("[reschedule/core] 히스토리-로그 연결 실패:", updateError);
      }
    }

    return {
      success: true,
      reschedule_log_id: rescheduleLog.id,
      plans_before_count: plansBeforeCount,
      plans_after_count: plansAfterCount,
    };
  });
}

