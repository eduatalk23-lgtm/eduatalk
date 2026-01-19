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
 * Stage 5: 검증 및 조정
 *
 * @param input - 검증된 입력 데이터
 * @param scheduleResult - 스케줄 생성 결과
 * @returns 검증 결과 또는 에러
 */
export function validateAndAdjust(
  input: ValidatedPlanInput,
  scheduleResult: ScheduleGenerationResult
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
