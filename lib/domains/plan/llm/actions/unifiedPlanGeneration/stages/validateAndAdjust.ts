/**
 * Stage 5: 검증 및 조정
 *
 * 생성된 스케줄의 유효성을 검증하고 필요시 시간 겹침을 자동 조정합니다.
 */

import {
  validateNoInternalOverlaps,
  adjustOverlappingTimes,
} from "@/lib/scheduler/utils/timeOverlapValidator";
import type { ScheduledPlan } from "@/lib/plan/scheduler";
import type {
  ScheduleGenerationResult,
  ValidationResult,
  ValidationWarning,
  StageResult,
  ValidatedPlanInput,
} from "../types";

/**
 * 플랜 통계를 계산합니다.
 */
function calculatePlanStats(plans: ScheduledPlan[]): {
  totalPlans: number;
  studyPlans: number;
  reviewPlans: number;
  uniqueDates: number;
} {
  const studyPlans = plans.filter((p) => p.date_type === "study").length;
  const reviewPlans = plans.filter((p) => p.date_type === "review").length;
  const uniqueDates = new Set(plans.map((p) => p.plan_date)).size;

  return {
    totalPlans: plans.length,
    studyPlans,
    reviewPlans,
    uniqueDates,
  };
}

/**
 * 비즈니스 규칙 검증을 수행합니다.
 */
function validateBusinessRules(
  plans: ScheduledPlan[],
  input: ValidatedPlanInput
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const stats = calculatePlanStats(plans);

  // 1. 플랜 수가 너무 적은 경우 경고
  if (stats.totalPlans < 5) {
    warnings.push({
      code: "LOW_PLAN_COUNT",
      message: `생성된 플랜이 ${stats.totalPlans}개로 적습니다. 기간이나 콘텐츠를 확인해주세요.`,
      severity: "warning",
      context: { totalPlans: stats.totalPlans },
    });
  }

  // 2. 복습일이 없는 경우 (설정했는데 생성 안 된 경우)
  if (input.timetableSettings.reviewDays > 0 && stats.reviewPlans === 0) {
    warnings.push({
      code: "NO_REVIEW_PLANS",
      message: "복습 플랜이 생성되지 않았습니다. 기간이 충분한지 확인해주세요.",
      severity: "warning",
      context: { expectedReviewDays: input.timetableSettings.reviewDays },
    });
  }

  // 3. 일부 날짜에만 플랜이 있는 경우
  const expectedDays = Math.min(input.availableDays, stats.totalPlans);
  if (stats.uniqueDates < expectedDays * 0.5) {
    warnings.push({
      code: "SPARSE_SCHEDULE",
      message: `플랜이 ${stats.uniqueDates}일에만 배치되어 있습니다. 시간 설정을 확인해주세요.`,
      severity: "info",
      context: { uniqueDates: stats.uniqueDates, expectedDays },
    });
  }

  // 4. 시간 정보가 없는 플랜이 있는 경우
  const plansWithoutTime = plans.filter(
    (p) => !p.start_time || !p.end_time
  ).length;
  if (plansWithoutTime > 0) {
    warnings.push({
      code: "PLANS_WITHOUT_TIME",
      message: `${plansWithoutTime}개의 플랜에 시간이 배정되지 않았습니다.`,
      severity: "warning",
      context: { count: plansWithoutTime },
    });
  }

  return warnings;
}

/**
 * 플랜 품질 검증을 수행합니다.
 * - 중복 콘텐츠 검증 (같은 날짜에 동일 콘텐츠가 동일 범위로 배치)
 * - 불필요한 분할 여부 (슬롯 시간이 충분한데 분할된 경우)
 */
function validatePlanQuality(
  plans: ScheduledPlan[],
  contentDurations?: Map<string, number>
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // 그룹핑용 Map (한 번 순회로 두 가지 검증에 사용)
  // Key에 "|"를 구분자로 사용 (content_id에 ":"가 포함될 수 있음)
  const dateContentRangeMap = new Map<string, ScheduledPlan[]>();
  const dateContentMap = new Map<string, ScheduledPlan[]>();

  for (const plan of plans) {
    // 중복 검증용 키: 날짜|콘텐츠|범위
    const rangeKey = `${plan.plan_date}|${plan.content_id}|${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}`;
    const rangeGroup = dateContentRangeMap.get(rangeKey) || [];
    rangeGroup.push(plan);
    dateContentRangeMap.set(rangeKey, rangeGroup);

    // 분할 검증용 키: 날짜|콘텐츠
    const contentKey = `${plan.plan_date}|${plan.content_id}`;
    const contentGroup = dateContentMap.get(contentKey) || [];
    contentGroup.push(plan);
    dateContentMap.set(contentKey, contentGroup);
  }

  // 1. 동일 날짜+콘텐츠+범위 중복 검증
  // 같은 날짜에 같은 콘텐츠가 같은 범위로 배치되면 진짜 중복
  // 다른 범위면 의도적 분할 (partial)로 판단
  for (const duplicatePlans of dateContentRangeMap.values()) {
    if (duplicatePlans.length > 1) {
      // 원본 플랜에서 직접 추출 (key 파싱 불필요)
      const firstPlan = duplicatePlans[0];
      const date = firstPlan.plan_date;
      const contentId = firstPlan.content_id;
      const range = `${firstPlan.planned_start_page_or_time}-${firstPlan.planned_end_page_or_time}`;
      warnings.push({
        code: "DUPLICATE_CONTENT_SAME_DATE",
        message: `${date}에 동일 콘텐츠(${contentId})가 같은 범위(${range})로 ${duplicatePlans.length}번 배치되었습니다.`,
        severity: "warning",
        context: { date, contentId, range, count: duplicatePlans.length },
      });
    }
  }

  // 2. 불필요한 분할 검증 (에피소드 시간이 슬롯 시간보다 작은데 분할된 경우)
  // 같은 날짜+콘텐츠에 여러 범위가 있으면 분할된 것으로 간주
  if (contentDurations && contentDurations.size > 0) {
    for (const sameDatePlans of dateContentMap.values()) {
      // 같은 날짜에 같은 콘텐츠가 2개 이상이면 분할된 것
      if (sameDatePlans.length < 2) continue;

      // 원본 플랜에서 직접 추출
      const firstPlan = sameDatePlans[0];
      const contentId = firstPlan.content_id;
      const planDate = firstPlan.plan_date;

      const episodeDuration = contentDurations.get(contentId);
      if (!episodeDuration) continue;

      // 각 플랜의 슬롯 시간 확인
      for (const plan of sameDatePlans) {
        if (plan.start_time && plan.end_time) {
          const slotMinutes = calculateSlotMinutes(plan.start_time, plan.end_time);

          // 에피소드 시간이 슬롯 시간보다 작거나 같은데 분할된 경우
          if (episodeDuration <= slotMinutes) {
            warnings.push({
              code: "UNNECESSARY_SPLIT",
              message: `콘텐츠(${contentId})가 불필요하게 분할되었습니다. 에피소드 시간(${episodeDuration}분) ≤ 슬롯 시간(${slotMinutes}분)`,
              severity: "info",
              context: {
                contentId,
                episodeDuration,
                slotMinutes,
                planDate,
                splitCount: sameDatePlans.length,
              },
            });
            break; // 한 번만 경고
          }
        }
      }
    }
  }

  return warnings;
}

/**
 * 슬롯 시간을 분 단위로 계산합니다.
 */
function calculateSlotMinutes(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  return (endHour * 60 + endMin) - (startHour * 60 + startMin);
}

/**
 * Stage 5 검증 옵션
 */
export interface ValidateAndAdjustOptions {
  /** 콘텐츠별 에피소드 시간 맵 (불필요 분할 검증용) */
  contentDurations?: Map<string, number>;
}

/**
 * Stage 5: 검증 및 조정
 *
 * @param input - 검증된 입력 데이터
 * @param scheduleResult - 스케줄 생성 결과
 * @param options - 검증 옵션 (contentDurations 등)
 * @returns 검증 결과 또는 에러
 */
export function validateAndAdjust(
  input: ValidatedPlanInput,
  scheduleResult: ScheduleGenerationResult,
  options?: ValidateAndAdjustOptions
): StageResult<ValidationResult> {
  let plans = [...scheduleResult.plans];
  const warnings: ValidationWarning[] = [];
  let autoAdjustedCount = 0;
  const unadjustablePlans: Array<{ plan: ScheduledPlan; reason: string }> = [];

  // 1. 내부 시간 겹침 검증
  const internalOverlapResult = validateNoInternalOverlaps(plans);

  if (internalOverlapResult.hasOverlaps) {
    // 자동 조정 시도
    const adjustmentResult = adjustOverlappingTimes(plans, [], "23:59");

    if (adjustmentResult.adjustedCount > 0) {
      plans = adjustmentResult.adjustedPlans;
      autoAdjustedCount = adjustmentResult.adjustedCount;

      warnings.push({
        code: "TIME_OVERLAP_ADJUSTED",
        message: `${autoAdjustedCount}개의 플랜 시간이 자동 조정되었습니다.`,
        severity: "info",
        context: {
          adjustedCount: autoAdjustedCount,
          originalOverlaps: internalOverlapResult.overlaps.length,
        },
      });
    }

    // 조정 불가능한 플랜 기록
    for (const item of adjustmentResult.unadjustablePlans) {
      unadjustablePlans.push({
        plan: item.plan,
        reason: item.reason,
      });
    }

    if (unadjustablePlans.length > 0) {
      warnings.push({
        code: "UNADJUSTABLE_OVERLAPS",
        message: `${unadjustablePlans.length}개의 플랜은 시간 조정이 불가능합니다.`,
        severity: "warning",
        context: { count: unadjustablePlans.length },
      });
    }
  }

  // 2. 비즈니스 규칙 검증
  const businessWarnings = validateBusinessRules(plans, input);
  warnings.push(...businessWarnings);

  // 3. 플랜 품질 검증 (중복, 불필요 분할)
  const qualityWarnings = validatePlanQuality(plans, options?.contentDurations);
  warnings.push(...qualityWarnings);

  // 3. 스케줄 생성 중 발생한 실패 원인을 경고로 변환
  for (const failure of scheduleResult.failureReasons) {
    warnings.push({
      code: failure.code,
      message: failure.message,
      severity: "warning",
      context: failure.context,
    });
  }

  // 4. 최종 겹침 상태 재검증
  const finalOverlapResult = validateNoInternalOverlaps(plans);

  // 심각한 에러 체크 (조정 후에도 겹침이 남아있는 경우)
  const hasUnresolvedOverlaps =
    finalOverlapResult.hasOverlaps && unadjustablePlans.length > 0;

  const result: ValidationResult = {
    isValid: !hasUnresolvedOverlaps,
    plans,
    overlapValidation: finalOverlapResult,
    warnings,
    autoAdjustedCount,
    unadjustablePlans,
  };

  return { success: true, data: result };
}
