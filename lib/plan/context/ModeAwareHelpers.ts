/**
 * ModeAwareHelpers
 *
 * 플랜 생성 모드에 따른 조건부 로직을 캡슐화하는 헬퍼 함수
 * - 모드별 시간 설정 선택
 * - 모드별 검증 로직
 * - 모드별 기본값 제공
 */

import type {
  PlanGenerationContext,
  TimeRange,
  NonStudyTimeBlock,
} from "./PlanGenerationContext";

/**
 * 모드에 따른 학습 시간 범위 반환
 *
 * 캠프 모드: campStudyHours 우선 사용
 * 일반 모드: 블록 시간 또는 기본 시간 사용
 *
 * @param context - 플랜 생성 컨텍스트
 * @param fallback - 폴백 시간 범위
 * @returns 학습 시간 범위
 */
export function getStudyHoursForMode(
  context: PlanGenerationContext,
  fallback?: TimeRange
): TimeRange | undefined {
  if (context.isCampMode && context.schedulerSettings.campStudyHours) {
    return context.schedulerSettings.campStudyHours;
  }
  return fallback;
}

/**
 * 모드에 따른 자기주도 학습 시간 범위 반환
 *
 * 캠프 모드: campSelfStudyHours 우선 사용
 * 일반 모드: selfStudyHours 사용
 *
 * @param context - 플랜 생성 컨텍스트
 * @returns 자기주도 학습 시간 범위
 */
export function getSelfStudyHoursForMode(
  context: PlanGenerationContext
): TimeRange | undefined {
  if (context.isCampMode && context.schedulerSettings.campSelfStudyHours) {
    return context.schedulerSettings.campSelfStudyHours;
  }
  return context.schedulerSettings.selfStudyHours;
}

/**
 * 모드에 따른 점심 시간 반환
 *
 * @param context - 플랜 생성 컨텍스트
 * @param fallback - 폴백 점심 시간
 * @returns 점심 시간 범위
 */
export function getLunchTimeForMode(
  context: PlanGenerationContext,
  fallback?: TimeRange
): TimeRange | undefined {
  return context.schedulerSettings.lunchTime || fallback;
}

/**
 * 모드에 따른 휴일 학습 시간 반환
 *
 * @param context - 플랜 생성 컨텍스트
 * @returns 휴일 학습 시간 범위
 */
export function getHolidayHoursForMode(
  context: PlanGenerationContext
): TimeRange | undefined {
  return context.schedulerSettings.designatedHolidayHours;
}

/**
 * 자기주도 학습이 활성화되어 있는지 확인
 *
 * @param context - 플랜 생성 컨텍스트
 * @param isHoliday - 휴일 여부
 * @returns 자기주도 학습 활성화 여부
 */
export function isSelfStudyEnabled(
  context: PlanGenerationContext,
  isHoliday: boolean
): boolean {
  if (isHoliday) {
    return context.blockSettings.enableSelfStudyForHolidays;
  }
  return context.blockSettings.enableSelfStudyForStudyDays;
}

/**
 * 비학습 시간 블록이 특정 요일에 적용되는지 확인
 *
 * @param context - 플랜 생성 컨텍스트
 * @param dayOfWeek - 요일 (0: 일요일, 1: 월요일, ...)
 * @returns 해당 요일에 적용되는 비학습 시간 블록 배열
 */
export function getNonStudyBlocksForDay(
  context: PlanGenerationContext,
  dayOfWeek: number
): NonStudyTimeBlock[] {
  const blocks = context.schedulerSettings.nonStudyTimeBlocks || [];

  return blocks.filter((block) => {
    // day_of_week가 없으면 모든 요일에 적용
    if (!block.day_of_week || block.day_of_week.length === 0) {
      return true;
    }
    return block.day_of_week.includes(dayOfWeek);
  });
}

/**
 * 모드별 로그 프리픽스 반환 (디버깅용)
 *
 * @param context - 플랜 생성 컨텍스트
 * @returns 로그 프리픽스 문자열
 */
export function getLogPrefix(context: PlanGenerationContext): string {
  const modeLabel =
    context.mode === "camp"
      ? "캠프"
      : context.mode === "template"
        ? "템플릿"
        : "일반";

  return `[${modeLabel}:${context.planGroupId.slice(0, 8)}]`;
}

/**
 * 모드별 상태 체크 우회 여부 결정
 *
 * 캠프/템플릿 모드에서는 특정 상태 체크를 우회할 수 있음
 *
 * @param context - 플랜 생성 컨텍스트
 * @returns 상태 체크 우회 여부
 */
export function shouldBypassStatusCheckForMode(
  context: PlanGenerationContext
): boolean {
  // 캠프나 템플릿 모드에서는 일부 상태 체크를 우회
  return context.isCampMode || context.isTemplateMode;
}

/**
 * 컨텍스트 요약 정보 반환 (디버깅용)
 *
 * @param context - 플랜 생성 컨텍스트
 * @returns 요약 정보 객체
 */
export function getContextSummary(context: PlanGenerationContext): {
  mode: string;
  schedulerType: string;
  studyDays: number;
  reviewDays: number;
  period: string;
  hasCampStudyHours: boolean;
  hasSelfStudyHours: boolean;
} {
  return {
    mode: context.mode,
    schedulerType: context.schedulerType,
    studyDays: context.schedulerSettings.studyDays,
    reviewDays: context.schedulerSettings.reviewDays,
    period: `${context.period.start} ~ ${context.period.end}`,
    hasCampStudyHours: !!context.schedulerSettings.campStudyHours,
    hasSelfStudyHours: !!context.schedulerSettings.selfStudyHours,
  };
}
