/**
 * Stage 1: 입력 검증
 *
 * 사용자 입력을 검증하고 기본값을 적용하여 ValidatedPlanInput을 생성합니다.
 */

import { unifiedPlanGenerationInputSchema } from "../schemas";
import type {
  UnifiedPlanGenerationInput,
  ValidatedPlanInput,
  StageResult,
} from "../types";

/**
 * 두 날짜 사이의 일수를 계산합니다.
 */
function calculateDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // 시작일 포함
}

/**
 * 제외일을 제외한 학습 가능한 일수를 계산합니다.
 */
function calculateAvailableDays(
  startDate: string,
  endDate: string,
  exclusions: Array<{ date: string }>
): number {
  const totalDays = calculateDaysBetween(startDate, endDate);

  // 제외일 중 기간 내에 있는 것만 카운트
  const exclusionsInPeriod = exclusions.filter((e) => {
    return e.date >= startDate && e.date <= endDate;
  });

  return totalDays - exclusionsInPeriod.length;
}

/**
 * Stage 1: 입력 검증
 *
 * @param input - 원본 입력 데이터
 * @returns 검증된 입력 또는 에러
 */
export function validateInput(
  input: UnifiedPlanGenerationInput
): StageResult<ValidatedPlanInput> {
  // Zod 스키마로 검증
  const parseResult = unifiedPlanGenerationInputSchema.safeParse(input);

  if (!parseResult.success) {
    const errorMessages = parseResult.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    return {
      success: false,
      error: `입력 검증 실패: ${errorMessages}`,
      details: { zodErrors: parseResult.error.errors },
    };
  }

  const validated = parseResult.data;

  // 추가 비즈니스 로직 검증

  // 1. 기간이 너무 짧은지 확인 (최소 7일)
  const totalDays = calculateDaysBetween(
    validated.periodStart,
    validated.periodEnd
  );
  if (totalDays < 7) {
    return {
      success: false,
      error: "학습 기간은 최소 7일 이상이어야 합니다",
      details: { totalDays },
    };
  }

  // 2. 기간이 너무 긴지 확인 (최대 180일)
  if (totalDays > 180) {
    return {
      success: false,
      error: "학습 기간은 최대 180일을 초과할 수 없습니다",
      details: { totalDays },
    };
  }

  // 3. 학습 가능한 일수 확인
  const exclusions = validated.exclusions ?? [];
  const availableDays = calculateAvailableDays(
    validated.periodStart,
    validated.periodEnd,
    exclusions
  );

  const { studyDays, reviewDays } = validated.timetableSettings;
  const cycleDays = studyDays + reviewDays;

  if (availableDays < cycleDays) {
    return {
      success: false,
      error: `학습 가능한 일수(${availableDays}일)가 최소 사이클 일수(${cycleDays}일)보다 적습니다`,
      details: { availableDays, cycleDays },
    };
  }

  // ValidatedPlanInput 생성 (기본값 적용)
  const result: ValidatedPlanInput = {
    studentId: validated.studentId,
    tenantId: validated.tenantId,
    planName: validated.planName,
    planPurpose: validated.planPurpose,
    periodStart: validated.periodStart,
    periodEnd: validated.periodEnd,
    timeSettings: validated.timeSettings,
    academySchedules: validated.academySchedules ?? [],
    exclusions: exclusions,
    contentSelection: {
      ...validated.contentSelection,
      maxResults: validated.contentSelection.maxResults ?? 5,
    },
    timetableSettings: {
      studyDays: validated.timetableSettings.studyDays,
      reviewDays: validated.timetableSettings.reviewDays,
      studentLevel: validated.timetableSettings.studentLevel,
      subjectType: validated.timetableSettings.subjectType,
      weeklyDays: validated.timetableSettings.weeklyDays,
      distributionStrategy:
        validated.timetableSettings.distributionStrategy ?? "even",
    },
    generationOptions: {
      saveToDb: validated.generationOptions?.saveToDb ?? false,
      generateMarkdown: validated.generationOptions?.generateMarkdown ?? true,
      dryRun: validated.generationOptions?.dryRun ?? false,
    },
    // 계산된 메타데이터
    totalDays,
    availableDays,

    // Phase 3: 플래너 연계 필드
    plannerId: validated.plannerId ?? null,
    creationMode: validated.creationMode ?? "content_based",
    plannerValidationMode: validated.plannerValidationMode ?? "auto_create",
  };

  return { success: true, data: result };
}
