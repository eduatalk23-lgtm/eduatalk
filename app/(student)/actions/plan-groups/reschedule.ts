/**
 * 플랜 그룹 재조정 Server Actions
 * 
 * 재조정 기능의 미리보기 및 실행을 처리합니다.
 * 
 * @module app/(student)/actions/plan-groups/reschedule
 */

"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { executeRescheduleTransaction } from "@/lib/reschedule/transaction";
import { applyAdjustments, type AdjustmentInput } from "@/lib/reschedule/scheduleEngine";
import { isReschedulable } from "@/lib/utils/planStatusUtils";
import type { PlanGroup, PlanContent } from "@/lib/types/plan";
import type { ScheduledPlan } from "@/lib/plan/scheduler";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { getBlockSetForPlanGroup } from "@/lib/plan/blocks";
import { generatePlansFromGroup } from "@/lib/plan/scheduler";
import type { PlanGroupAllowedRole } from "@/lib/auth/planGroupAuth";
import { calculateUncompletedRangeBounds, applyUncompletedRangeToContents } from "@/lib/reschedule/uncompletedRangeCalculator";
import { getAdjustedPeriod, getTodayDateString, PeriodCalculationError } from "@/lib/reschedule/periodCalculator";
import { generatePreviewCacheKey, getCachedPreview, cachePreviewResult } from "@/lib/reschedule/previewCache";

// ============================================
// 타입 정의
// ============================================

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
  // 실제 플랜 데이터 추가
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

// ============================================
// 미리보기 함수
// ============================================

/**
 * 재조정 미리보기
 * 
 * DB에 변경을 적용하지 않고 재조정 결과를 미리 확인합니다.
 * 
 * @param groupId 플랜 그룹 ID
 * @param adjustments 조정 요청 목록
 * @param rescheduleDateRange 재조정할 플랜 범위 (선택, null이면 전체 기간)
 * @param placementDateRange 재조정 플랜 배치 범위 (선택, null이면 자동 계산)
 * @param includeToday 오늘 날짜 포함 여부 (기본값: false)
 * @returns 미리보기 결과
 */
async function _getReschedulePreview(
  groupId: string,
  adjustments: AdjustmentInput[],
  rescheduleDateRange?: { from: string; to: string } | null,
  placementDateRange?: { from: string; to: string } | null,
  includeToday: boolean = false
): Promise<ReschedulePreviewResult> {
  // 캐시 조회 (Phase 3: 성능 최적화)
  // 하위 호환성을 위해 dateRange도 캐시 키에 포함 (기존 코드와의 호환성)
  const cacheKey = generatePreviewCacheKey(
    groupId,
    adjustments,
    rescheduleDateRange || placementDateRange || null
  );
  const cachedResult = await getCachedPreview(cacheKey);
  if (cachedResult) {
    console.log("[reschedule] 캐시된 미리보기 결과 반환:", cacheKey);
    return cachedResult;
  }

  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("인증이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  
  const tenantContext = await requireTenantContext();
  const supabase = await createSupabaseServerClient();

  // 1. 플랜 그룹 및 관련 데이터 조회
  const { group, contents, exclusions, academySchedules } =
    await getPlanGroupWithDetails(
      groupId,
      user.userId,
      tenantContext?.tenantId || null
    );

    if (!group) {
      throw new AppError(
        "플랜 그룹을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (!contents || contents.length === 0) {
      throw new AppError(
        "플랜 콘텐츠를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 2. 오늘 날짜 가져오기
    const today = getTodayDateString();

    // 2.1 재조정 기간 결정: placementDateRange 우선, 없으면 자동 계산
    // adjustedPeriod를 먼저 계산하여 기존 플랜 필터링과 새 플랜 생성이 논리적으로 일관되도록 함
    let adjustedPeriod: { start: string; end: string };
    if (placementDateRange?.from && placementDateRange?.to) {
      // 수동으로 선택한 배치 범위 사용
      adjustedPeriod = {
        start: placementDateRange.from,
        end: placementDateRange.to,
      };
    } else {
      // 자동 계산: rescheduleDateRange를 기반으로 오늘 이후 기간 계산
      try {
        adjustedPeriod = getAdjustedPeriod(rescheduleDateRange || null, today, group.period_end, includeToday);
      } catch (error) {
        if (error instanceof PeriodCalculationError) {
          throw new AppError(error.message, ErrorCode.VALIDATION_ERROR, 400, true);
        }
        throw error;
      }
    }

    // 2.2 기존 플랜 조회 (재조정 대상만, 상세 정보 포함)
    // 기존 플랜 필터링: adjustedPeriod 사용 (논리적 일관성 확보)
    // rescheduleDateRange는 참고용으로만 사용 (UI 표시용)
    let query = supabase
      .from("student_plan")
      .select(
        "id, plan_date, content_id, content_type, planned_start_page_or_time, planned_end_page_or_time, start_time, end_time, status, is_active"
      )
      .eq("plan_group_id", groupId)
      .eq("student_id", group.student_id);

    // adjustedPeriod를 사용하여 기존 플랜 필터링
    if (adjustedPeriod.start && adjustedPeriod.end) {
      query = query.gte("plan_date", adjustedPeriod.start).lte("plan_date", adjustedPeriod.end);
    }

    const { data: existingPlans } = await query;

    const reschedulablePlans = (existingPlans || []).filter((plan) =>
      isReschedulable(plan)
    );

    // 2.3 오늘 이전 미진행 플랜 조회 및 미진행 범위 계산

    // 미진행 플랜 조회: includeToday에 따라 조건 변경
    let pastUncompletedQuery = supabase
      .from("student_plan")
      .select(
        "content_id, planned_start_page_or_time, planned_end_page_or_time, completed_amount"
      )
      .eq("plan_group_id", groupId)
      .eq("student_id", group.student_id)
      .eq("is_active", true)
      .in("status", ["pending", "in_progress"]);
    
    // includeToday가 true이면 오늘까지 포함, false이면 오늘 이전만
    if (includeToday) {
      pastUncompletedQuery = pastUncompletedQuery.lte("plan_date", today);
    } else {
      pastUncompletedQuery = pastUncompletedQuery.lt("plan_date", today);
    }
    
    const { data: pastUncompletedPlans } = await pastUncompletedQuery;

    // 2.7 rescheduleDateRange가 지정된 경우, 해당 범위 내 플랜의 콘텐츠만 필터링 (Phase 4)
    // 날짜 범위 필터링 일관성 개선: 선택한 범위와 관련된 미진행 플랜만 처리
    let relevantPastUncompletedPlans = pastUncompletedPlans || [];
    if (rescheduleDateRange?.from && rescheduleDateRange?.to) {
      // 날짜 범위 내에 있는 기존 플랜의 콘텐츠 ID 추출
      const contentIdsInRange = new Set(
        reschedulablePlans.map(p => p.content_id).filter(Boolean)
      );
      // 해당 콘텐츠의 미진행 플랜만 필터링
      relevantPastUncompletedPlans = relevantPastUncompletedPlans.filter(
        p => contentIdsInRange.has(p.content_id)
      );
    }

    // 미진행 범위 계산 (시작점과 종료점 포함)
    const uncompletedBoundsMap = calculateUncompletedRangeBounds(relevantPastUncompletedPlans);

    // 3. 조정된 콘텐츠 생성
    const adjustedContents = applyAdjustments(contents, adjustments);

    // 3.5 선택된 콘텐츠 ID 추출 (adjustments에서)
    // Step 1에서 선택한 콘텐츠만 미진행 범위를 적용하기 위함
    const selectedContentIds = new Set<string>(
      adjustments.map(a => {
        const content = contents.find(c => c.id === a.plan_content_id);
        return content?.content_id || '';
      }).filter(id => id !== '')
    );

    // 3.6 미진행 범위를 조정된 콘텐츠에 적용 (선택된 콘텐츠만)
    const contentsWithUncompleted = applyUncompletedRangeToContents(
      adjustedContents,
      uncompletedBoundsMap,
      selectedContentIds.size > 0 ? selectedContentIds : undefined
    );

    // 4. 블록 세트 조회
    const baseBlocksRaw = await getBlockSetForPlanGroup(
      group,
      group.student_id,
      user.userId,
      "student" as PlanGroupAllowedRole,
      tenantContext?.tenantId || null
    );

    if (baseBlocksRaw.length === 0) {
      throw new AppError(
        "블록 세트를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // BlockInfo 타입 변환 (blocks.ts의 BlockInfo → scheduler.ts의 BlockInfo)
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

    // 5. 스케줄러 설정 병합
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

    // 6. calculateAvailableDates로 스케줄 결과 계산
    const { calculateAvailableDates } = await import(
      "@/lib/scheduler/calculateAvailableDates"
    );

    // adjustedPeriod를 사용하여 조정된 기간에 대해서만 스케줄 계산 (성능 최적화)
    const scheduleResult = calculateAvailableDates(
      adjustedPeriod.start,  // 전체 기간 대신 조정된 기간 사용
      adjustedPeriod.end,    // 전체 기간 대신 조정된 기간 사용
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
          (group.scheduler_options as any)?.enable_self_study_for_holidays === true,
        enable_self_study_for_study_days:
          (group.scheduler_options as any)?.enable_self_study_for_study_days === true,
        lunch_time: schedulerOptions.lunch_time,
        camp_study_hours: schedulerOptions.camp_study_hours,
        camp_self_study_hours: schedulerOptions.self_study_hours,
        designated_holiday_hours: (group.scheduler_options as any)?.designated_holiday_hours,
        non_study_time_blocks: (group as any).non_study_time_blocks || undefined,
      }
    );

    // 7. 날짜별 사용 가능 시간 범위 및 타임라인 추출
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

    // 8. 콘텐츠 과목 정보 조회 (간단화: 빈 Map 사용)
    const contentSubjects = new Map<string, { subject?: string | null; subject_category?: string | null }>();

    // 9. 실제 플랜 생성 (미진행 범위가 적용된 콘텐츠 사용)
    // 재조정 시에는 adjustedPeriod를 직접 전달하여 기간 일관성 보장
    const generatedPlans = generatePlansFromGroup(
      group,
      contentsWithUncompleted,
      exclusions,
      academySchedules,
      baseBlocks,
      contentSubjects,
      undefined, // riskIndexMap
      dateAvailableTimeRanges,
      dateTimeSlots,
      undefined, // contentDurationMap
      adjustedPeriod.start, // 재조정 기간 시작일
      adjustedPeriod.end // 재조정 기간 종료일
    );

    // 10. 조정된 기간 내의 플랜만 필터링 (이미 adjustedPeriod로 생성되었으므로 필터링 불필요하지만 안전장치로 유지)
    const filteredPlans = generatedPlans.filter(
      (plan) => plan.plan_date >= adjustedPeriod.start && plan.plan_date <= adjustedPeriod.end
    );

    // 11. 영향받는 날짜 계산
    const affectedDatesSet = new Set<string>();
    filteredPlans.forEach((plan) => {
      affectedDatesSet.add(plan.plan_date);
    });
    const affectedDates = Array.from(affectedDatesSet).sort();

    // 12. 예상 시간 계산
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

    // 13. 기존 플랜 상세 정보 변환
    const plansBefore = reschedulablePlans.map((plan) => ({
      id: plan.id,
      plan_date: plan.plan_date,
      content_id: plan.content_id || "",
      content_type: (plan as any).content_type || "",
      planned_start_page_or_time: (plan as any).planned_start_page_or_time || null,
      planned_end_page_or_time: (plan as any).planned_end_page_or_time || null,
      start_time: plan.start_time || null,
      end_time: plan.end_time || null,
      status: plan.status || null,
    }));

    // 14. 결과 반환
    const result: ReschedulePreviewResult = {
      plans_before_count: reschedulablePlans.length,
      plans_after_count: filteredPlans.length,
      affected_dates: affectedDates,
      estimated_hours: Math.round(estimatedHours * 10) / 10,
      adjustments_summary: {
        range_changes: adjustments.filter((a) => a.change_type === "range")
          .length,
        replacements: adjustments.filter((a) => a.change_type === "replace")
          .length,
        full_regenerations: adjustments.filter(
          (a) => a.change_type === "full"
        ).length,
      },
      plans_before: plansBefore,
      plans_after: filteredPlans,
    };

    // 15. 결과 캐싱 (Phase 3: 성능 최적화)
    await cachePreviewResult(cacheKey, result);

    return result;
}

export const getReschedulePreview = withErrorHandling(_getReschedulePreview);

// ============================================
// 실행 함수
// ============================================

/**
 * 재조정 실행
 * 
 * 실제로 재조정을 수행하고 DB에 반영합니다.
 * 
 * @param groupId 플랜 그룹 ID
 * @param adjustments 조정 요청 목록
 * @param reason 재조정 사유 (선택)
 * @param rescheduleDateRange 재조정할 플랜 범위 (선택, null이면 전체 기간)
 * @param placementDateRange 재조정 플랜 배치 범위 (선택, null이면 자동 계산)
 * @param includeToday 오늘 날짜 포함 여부 (기본값: false)
 * @returns 실행 결과
 */
async function _rescheduleContents(
  groupId: string,
  adjustments: AdjustmentInput[],
  reason?: string,
  rescheduleDateRange?: { from: string; to: string } | null,
  placementDateRange?: { from: string; to: string } | null,
  includeToday: boolean = false
): Promise<RescheduleResult> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("인증이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
    const tenantContext = await requireTenantContext();

    return executeRescheduleTransaction(groupId, async (supabase) => {
      // 1. 플랜 그룹 및 콘텐츠 조회
      const { data: group } = await supabase
        .from("plan_groups")
        .select("*")
        .eq("id", groupId)
        .eq("tenant_id", tenantContext.tenantId)
        .single();

      if (!group) {
        throw new AppError(
          "플랜 그룹을 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }

      // 2. 오늘 날짜 가져오기
      const today = getTodayDateString();

      // 2.1 재조정 기간 결정: placementDateRange 우선, 없으면 자동 계산
      // adjustedPeriod를 먼저 계산하여 기존 플랜 필터링과 새 플랜 생성이 논리적으로 일관되도록 함
      let adjustedPeriod: { start: string; end: string };
      if (placementDateRange?.from && placementDateRange?.to) {
        // 수동으로 선택한 배치 범위 사용
        adjustedPeriod = {
          start: placementDateRange.from,
          end: placementDateRange.to,
        };
      } else {
        // 자동 계산: rescheduleDateRange를 기반으로 오늘 이후 기간 계산
        try {
          adjustedPeriod = getAdjustedPeriod(rescheduleDateRange || null, today, group.period_end, includeToday);
        } catch (error) {
          if (error instanceof PeriodCalculationError) {
            throw new AppError(error.message, ErrorCode.VALIDATION_ERROR, 400, true);
          }
          throw error;
        }
      }

      // 2.2 기존 플랜 조회 (재조정 대상만)
      // 기존 플랜 필터링: adjustedPeriod 사용 (논리적 일관성 확보)
      // rescheduleDateRange는 참고용으로만 사용 (UI 표시용)
      let query = supabase
        .from("student_plan")
        .select("*")
        .eq("plan_group_id", groupId)
        .eq("student_id", group.student_id);

      // adjustedPeriod를 사용하여 기존 플랜 필터링
      if (adjustedPeriod.start && adjustedPeriod.end) {
        query = query.gte("plan_date", adjustedPeriod.start).lte("plan_date", adjustedPeriod.end);
      }

      const { data: existingPlans } = await query;

      const reschedulablePlans = (existingPlans || []).filter((plan) =>
        isReschedulable(plan)
      );

      const plansBeforeCount = reschedulablePlans.length;

      // 3. 기존 플랜 히스토리 백업
      const planHistoryInserts = reschedulablePlans.map((plan) => ({
        plan_id: plan.id,
        plan_group_id: groupId,
        plan_data: plan as any, // 전체 플랜 데이터 스냅샷
        content_id: plan.content_id,
        adjustment_type: "full" as const, // TODO: 실제 조정 유형에 맞게 수정
      }));

      // 4. 재조정 로그 생성 (임시 ID)
      const tempLogId = crypto.randomUUID();

      // 5. 히스토리 저장 (reschedule_log_id는 나중에 업데이트)
      if (planHistoryInserts.length > 0) {
        const { error: historyError } = await supabase
          .from("plan_history")
          .insert(planHistoryInserts);

        if (historyError) {
          throw new AppError(
            `플랜 히스토리 저장 실패: ${historyError.message}`,
            ErrorCode.DATABASE_ERROR,
            500,
            true
          );
        }
      }

      // 6. 기존 플랜 비활성화
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

      // 7. 새 플랜 생성 - 미리보기와 동일한 로직 사용
      const previewResult = await _getReschedulePreview(
        groupId,
        adjustments,
        rescheduleDateRange,
        placementDateRange,
        includeToday
      );
      const newPlans = previewResult.plans_after;

      // 8. 새 플랜 저장
      let plansAfterCount = 0;
      if (newPlans.length > 0) {
        // ScheduledPlan을 student_plan 테이블 형식으로 변환
        const planInserts = newPlans.map((plan) => ({
          plan_group_id: groupId,
          student_id: group.student_id,
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

        // 배치 insert (Supabase는 한 번에 최대 1000개)
        const BATCH_SIZE = 100;
        for (let i = 0; i < planInserts.length; i += BATCH_SIZE) {
          const batch = planInserts.slice(i, i + BATCH_SIZE);
          const { error: insertError } = await supabase
            .from("student_plan")
            .insert(batch);

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

      // 8. 재조정 로그 저장
      const { data: rescheduleLog, error: logError } = await supabase
        .from("reschedule_log")
        .insert({
          plan_group_id: groupId,
          student_id: group.student_id,
          adjusted_contents: adjustments as any,
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

      // 9. 히스토리와 로그 연결
      if (planHistoryInserts.length > 0) {
        const { error: updateError } = await supabase
          .from("plan_history")
          .update({ reschedule_log_id: rescheduleLog.id })
          .eq("plan_group_id", groupId)
          .is("reschedule_log_id", null);

        if (updateError) {
          console.error(
            "[reschedule] 히스토리-로그 연결 실패:",
            updateError
          );
          // 에러는 로그만 남기고 계속 진행
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

export const rescheduleContents = withErrorHandling(_rescheduleContents);

