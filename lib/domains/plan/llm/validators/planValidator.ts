/**
 * AI 플랜 검증기
 *
 * AI가 생성한 플랜의 유효성을 검증합니다.
 *
 * @module lib/domains/plan/llm/validators/planValidator
 */

import type { GeneratedPlanItem } from "../types";
import type {
  AcademyScheduleForPrompt,
  BlockInfoForPrompt,
} from "../transformers/requestBuilder";

// ============================================
// 검증 결과 타입
// ============================================

export interface ValidationError {
  type:
    | "academy_conflict"
    | "excluded_date"
    | "excluded_day"
    | "time_overflow"
    | "block_mismatch"
    | "invalid_time";
  planIndex: number;
  date: string;
  message: string;
  suggestion?: string;
}

export interface ValidationWarning {
  type: "time_gap" | "long_session" | "late_night" | "early_morning" | "content_dependency";
  planIndex: number;
  date: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 시간 문자열을 분으로 변환
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 두 시간 범위가 겹치는지 확인
 */
function isTimeOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  return s1 < e2 && s2 < e1;
}

/**
 * 시간이 유효한 HH:mm 형식인지 확인
 */
function isValidTimeFormat(time: string): boolean {
  const match = time.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/);
  return !!match;
}

// ============================================
// 검증 함수
// ============================================

/**
 * 학원 일정 충돌 검증
 *
 * 학원 시간(이동시간 포함)과 겹치는 플랜이 있는지 확인합니다.
 */
export function validateAcademyConflicts(
  plans: GeneratedPlanItem[],
  academySchedules: AcademyScheduleForPrompt[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (academySchedules.length === 0) {
    return { valid: true, errors, warnings };
  }

  plans.forEach((plan, index) => {
    const planDayOfWeek = new Date(plan.date).getDay();

    // 해당 요일의 학원 일정 찾기
    const daySchedules = academySchedules.filter(
      (s) => s.dayOfWeek === planDayOfWeek
    );

    for (const schedule of daySchedules) {
      // 이동 시간 고려
      const travelMinutes = schedule.travelTime || 0;
      const adjustedStart = subtractMinutes(schedule.startTime, travelMinutes);

      if (isTimeOverlap(plan.startTime, plan.endTime, adjustedStart, schedule.endTime)) {
        errors.push({
          type: "academy_conflict",
          planIndex: index,
          date: plan.date,
          message: `${plan.startTime}-${plan.endTime} 플랜이 학원 일정(${schedule.startTime}-${schedule.endTime}, ${schedule.academyName || "학원"})과 충돌합니다.`,
          suggestion: `${schedule.endTime} 이후 또는 ${adjustedStart} 이전으로 이동하세요.`,
        });
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 시간에서 분을 뺀 결과 반환
 */
function subtractMinutes(time: string, minutes: number): string {
  const totalMinutes = timeToMinutes(time) - minutes;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * 제외 날짜/요일 검증
 *
 * 제외 요일이나 제외 날짜에 플랜이 배치되었는지 확인합니다.
 */
export function validateExcludedDates(
  plans: GeneratedPlanItem[],
  excludeDays: number[],
  excludeDates: string[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const excludeDatesSet = new Set(excludeDates);

  plans.forEach((plan, index) => {
    // 제외 날짜 확인
    if (excludeDatesSet.has(plan.date)) {
      errors.push({
        type: "excluded_date",
        planIndex: index,
        date: plan.date,
        message: `${plan.date}는 제외 날짜입니다.`,
        suggestion: "해당 날짜의 플랜을 다른 날로 이동하세요.",
      });
      return;
    }

    // 제외 요일 확인
    const dayOfWeek = new Date(plan.date).getDay();
    if (excludeDays.includes(dayOfWeek)) {
      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      errors.push({
        type: "excluded_day",
        planIndex: index,
        date: plan.date,
        message: `${dayNames[dayOfWeek]}요일은 제외 요일입니다.`,
        suggestion: "해당 요일의 플랜을 다른 요일로 이동하세요.",
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 일일 학습량 검증
 *
 * 일별 총 학습 시간이 제한을 초과하는지 확인합니다.
 */
export function validateDailyStudyMinutes(
  plans: GeneratedPlanItem[],
  dailyStudyMinutes: number
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 날짜별 총 시간 계산
  const dailyTotals = new Map<string, number>();
  plans.forEach((plan) => {
    const current = dailyTotals.get(plan.date) || 0;
    dailyTotals.set(plan.date, current + plan.estimatedMinutes);
  });

  // 초과 확인
  const tolerance = 1.2; // 20% 허용
  dailyTotals.forEach((total, date) => {
    if (total > dailyStudyMinutes * tolerance) {
      errors.push({
        type: "time_overflow",
        planIndex: -1, // 일별 검증이므로 특정 플랜 인덱스 없음
        date,
        message: `${date}의 총 학습 시간(${total}분)이 일일 제한(${dailyStudyMinutes}분)의 ${Math.round(tolerance * 100)}%를 초과합니다.`,
        suggestion: "일부 플랜을 다른 날짜로 이동하거나 학습 범위를 줄이세요.",
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 시간 블록 호환성 검증
 *
 * 플랜 시간이 블록 범위 내에 있는지 확인합니다.
 */
export function validateBlockCompatibility(
  plans: GeneratedPlanItem[],
  blockSets: BlockInfoForPrompt[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (blockSets.length === 0) {
    return { valid: true, errors, warnings };
  }

  plans.forEach((plan, index) => {
    const planDayOfWeek = new Date(plan.date).getDay();

    // 해당 요일의 블록들 필터링
    const dayBlocks = blockSets.filter((b) => b.dayOfWeek === planDayOfWeek);

    if (dayBlocks.length === 0) {
      // 해당 요일에 블록이 없으면 경고
      warnings.push({
        type: "time_gap",
        planIndex: index,
        date: plan.date,
        message: `${plan.date}에 정의된 시간 블록이 없습니다.`,
      });
      return;
    }

    // 플랜 시간이 어떤 블록에도 맞지 않는지 확인
    const planStart = timeToMinutes(plan.startTime);
    const planEnd = timeToMinutes(plan.endTime);

    let foundMatchingBlock = false;
    for (const block of dayBlocks) {
      const blockStart = timeToMinutes(block.startTime);
      const blockEnd = timeToMinutes(block.endTime);

      // 플랜이 블록 범위 내에 있거나 부분적으로 겹치면 OK
      if (planStart >= blockStart && planEnd <= blockEnd) {
        foundMatchingBlock = true;
        break;
      }
      // 부분 겹침도 허용
      if (planStart < blockEnd && planEnd > blockStart) {
        foundMatchingBlock = true;
        break;
      }
    }

    if (!foundMatchingBlock) {
      warnings.push({
        type: "time_gap",
        planIndex: index,
        date: plan.date,
        message: `${plan.startTime}-${plan.endTime} 플랜이 정의된 블록 범위 밖에 있습니다.`,
      });
    }
  });

  return {
    valid: true, // 블록 불일치는 경고만
    errors,
    warnings,
  };
}

/**
 * 시간 형식 검증
 */
export function validateTimeFormats(
  plans: GeneratedPlanItem[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  plans.forEach((plan, index) => {
    if (!isValidTimeFormat(plan.startTime)) {
      errors.push({
        type: "invalid_time",
        planIndex: index,
        date: plan.date,
        message: `시작 시간 형식이 잘못되었습니다: ${plan.startTime}`,
        suggestion: "HH:mm 형식 (예: 09:00)을 사용하세요.",
      });
    }
    if (!isValidTimeFormat(plan.endTime)) {
      errors.push({
        type: "invalid_time",
        planIndex: index,
        date: plan.date,
        message: `종료 시간 형식이 잘못되었습니다: ${plan.endTime}`,
        suggestion: "HH:mm 형식 (예: 10:00)을 사용하세요.",
      });
    }

    // 시작 시간이 종료 시간보다 늦은 경우
    if (
      isValidTimeFormat(plan.startTime) &&
      isValidTimeFormat(plan.endTime) &&
      timeToMinutes(plan.startTime) >= timeToMinutes(plan.endTime)
    ) {
      errors.push({
        type: "invalid_time",
        planIndex: index,
        date: plan.date,
        message: `시작 시간(${plan.startTime})이 종료 시간(${plan.endTime})보다 같거나 늦습니다.`,
      });
    }

    // 늦은 밤 학습 경고
    const endMinutes = timeToMinutes(plan.endTime);
    if (endMinutes >= 23 * 60) {
      warnings.push({
        type: "late_night",
        planIndex: index,
        date: plan.date,
        message: `${plan.endTime}까지 학습은 수면에 영향을 줄 수 있습니다.`,
      });
    }

    // 이른 아침 학습 경고
    const startMinutes = timeToMinutes(plan.startTime);
    if (startMinutes < 6 * 60) {
      warnings.push({
        type: "early_morning",
        planIndex: index,
        date: plan.date,
        message: `${plan.startTime}부터 학습은 수면 부족을 유발할 수 있습니다.`,
      });
    }

    // 긴 세션 경고 (90분 초과)
    if (plan.estimatedMinutes > 90) {
      warnings.push({
        type: "long_session",
        planIndex: index,
        date: plan.date,
        message: `${plan.estimatedMinutes}분 세션은 집중력 저하를 유발할 수 있습니다. 50-60분 단위로 분할을 권장합니다.`,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// 통합 검증 함수
// ============================================

export interface ValidatePlansOptions {
  plans: GeneratedPlanItem[];
  academySchedules?: AcademyScheduleForPrompt[];
  blockSets?: BlockInfoForPrompt[];
  excludeDays?: number[];
  excludeDates?: string[];
  dailyStudyMinutes?: number;
}

/**
 * 모든 검증을 통합 실행
 */
export function validatePlans(options: ValidatePlansOptions): ValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];

  // 1. 시간 형식 검증
  const timeResult = validateTimeFormats(options.plans);
  allErrors.push(...timeResult.errors);
  allWarnings.push(...timeResult.warnings);

  // 2. 학원 일정 충돌 검증
  if (options.academySchedules && options.academySchedules.length > 0) {
    const academyResult = validateAcademyConflicts(
      options.plans,
      options.academySchedules
    );
    allErrors.push(...academyResult.errors);
    allWarnings.push(...academyResult.warnings);
  }

  // 3. 제외일 검증
  const excludeResult = validateExcludedDates(
    options.plans,
    options.excludeDays || [],
    options.excludeDates || []
  );
  allErrors.push(...excludeResult.errors);
  allWarnings.push(...excludeResult.warnings);

  // 4. 일일 학습량 검증
  if (options.dailyStudyMinutes) {
    const dailyResult = validateDailyStudyMinutes(
      options.plans,
      options.dailyStudyMinutes
    );
    allErrors.push(...dailyResult.errors);
    allWarnings.push(...dailyResult.warnings);
  }

  // 5. 블록 호환성 검증
  if (options.blockSets && options.blockSets.length > 0) {
    const blockResult = validateBlockCompatibility(
      options.plans,
      options.blockSets
    );
    allErrors.push(...blockResult.errors);
    allWarnings.push(...blockResult.warnings);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}
