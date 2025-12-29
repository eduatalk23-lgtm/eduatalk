/**
 * 진행률 계산 서비스
 *
 * 시간 기반과 페이지/에피소드 기반 진행률을 병행 계산하여
 * 더 정확한 학습 진행률을 산출합니다.
 */

import type { ContentType } from "@/lib/types/common";

// ============================================
// Types
// ============================================

/**
 * 진행률 계산 입력
 */
export type ProgressCalculationInput = {
  /** 콘텐츠 유형 */
  contentType: ContentType;
  /** 플랜된 시작 페이지/에피소드 */
  plannedStart: number;
  /** 플랜된 종료 페이지/에피소드 */
  plannedEnd: number;
  /** 실제 완료된 양 (페이지 수 또는 에피소드 수) */
  completedAmount?: number | null;
  /** 총 콘텐츠 양 (선택적, 있으면 절대 진행률 계산) */
  totalAmount?: number | null;
  /** 예상 학습 시간 (분) */
  estimatedMinutes?: number | null;
  /** 실제 학습 시간 (분) */
  actualMinutes?: number | null;
  /** 에피소드별 길이 (강의의 경우, 분 단위 배열) */
  episodeDurations?: number[] | null;
};

/**
 * 진행률 계산 결과
 */
export type ProgressCalculationResult = {
  /** 최종 진행률 (0-100) */
  progress: number;
  /** 페이지/에피소드 기반 진행률 */
  amountProgress: number | null;
  /** 시간 기반 진행률 */
  timeProgress: number | null;
  /** 진행률 계산 방식 */
  calculationMethod: "amount" | "time" | "hybrid" | "estimated";
  /** 진행 상태 */
  status: "not_started" | "in_progress" | "nearly_done" | "completed" | "over_time";
  /** 예상 남은 시간 (분) */
  estimatedRemainingMinutes: number | null;
};

/**
 * 진행률 가중치 설정
 */
export type ProgressWeights = {
  /** 페이지/에피소드 기반 가중치 (0-1) */
  amountWeight: number;
  /** 시간 기반 가중치 (0-1) */
  timeWeight: number;
};

// ============================================
// Constants
// ============================================

/** 기본 가중치 설정 */
const DEFAULT_WEIGHTS: Record<ContentType, ProgressWeights> = {
  book: { amountWeight: 0.7, timeWeight: 0.3 }, // 교재는 페이지 기반 우선
  lecture: { amountWeight: 0.4, timeWeight: 0.6 }, // 강의는 시간 기반 우선
  custom: { amountWeight: 0.5, timeWeight: 0.5 }, // 커스텀은 균등
};

/** 교재 페이지당 평균 학습 시간 (분) */
const AVG_MINUTES_PER_PAGE = 5;

/** 강의 에피소드당 평균 학습 시간 (분) - 기본값 */
const AVG_MINUTES_PER_EPISODE = 30;

// ============================================
// Main Functions
// ============================================

/**
 * 진행률 계산
 *
 * 시간과 페이지/에피소드 완료량을 모두 고려하여 진행률을 계산합니다.
 *
 * @param input - 진행률 계산 입력
 * @param customWeights - 커스텀 가중치 (선택)
 * @returns 진행률 계산 결과
 */
export function calculateProgress(
  input: ProgressCalculationInput,
  customWeights?: Partial<ProgressWeights>
): ProgressCalculationResult {
  const {
    contentType,
    plannedStart,
    plannedEnd,
    completedAmount,
    totalAmount,
    estimatedMinutes,
    actualMinutes,
    episodeDurations,
  } = input;

  // 가중치 설정
  const weights = {
    ...DEFAULT_WEIGHTS[contentType],
    ...customWeights,
  };

  // 플랜된 양 계산
  const plannedAmount = Math.max(0, plannedEnd - plannedStart);

  // 페이지/에피소드 기반 진행률
  const amountProgress = calculateAmountProgress(
    completedAmount,
    plannedAmount,
    totalAmount
  );

  // 시간 기반 진행률
  const timeProgress = calculateTimeProgress(
    actualMinutes,
    estimatedMinutes,
    contentType,
    plannedAmount,
    episodeDurations
  );

  // 최종 진행률 계산
  const progress = calculateFinalProgress(
    amountProgress,
    timeProgress,
    weights
  );

  // 진행 상태 판단
  const status = determineProgressStatus(progress, timeProgress);

  // 예상 남은 시간 계산
  const estimatedRemainingMinutes = calculateRemainingTime(
    progress,
    actualMinutes,
    estimatedMinutes,
    contentType,
    plannedAmount,
    episodeDurations
  );

  // 계산 방식 결정
  const calculationMethod = determineCalculationMethod(
    amountProgress,
    timeProgress,
    weights
  );

  return {
    progress: Math.round(progress),
    amountProgress: amountProgress !== null ? Math.round(amountProgress) : null,
    timeProgress: timeProgress !== null ? Math.round(timeProgress) : null,
    calculationMethod,
    status,
    estimatedRemainingMinutes,
  };
}

/**
 * 플랜 완료 시 최종 진행률 계산
 *
 * 학습 완료 시 호출되어 최종 진행률을 계산합니다.
 */
export function calculateCompletionProgress(
  input: ProgressCalculationInput,
  manualProgress?: number
): number {
  // 수동 입력된 진행률이 있으면 우선 사용
  if (manualProgress !== undefined && manualProgress >= 0) {
    return Math.min(100, Math.max(0, manualProgress));
  }

  const result = calculateProgress(input);
  return result.progress;
}

/**
 * 진행률 기반 상태 업데이트
 *
 * 진행률에 따라 플랜 상태를 결정합니다.
 */
export function determineStatusFromProgress(
  progress: number,
  currentStatus?: string | null
): "pending" | "in_progress" | "completed" {
  if (progress >= 100) return "completed";
  if (progress > 0) return "in_progress";
  if (currentStatus === "in_progress") return "in_progress";
  return "pending";
}

// ============================================
// Helper Functions
// ============================================

/**
 * 페이지/에피소드 기반 진행률 계산
 */
function calculateAmountProgress(
  completedAmount: number | null | undefined,
  plannedAmount: number,
  totalAmount: number | null | undefined
): number | null {
  if (completedAmount === null || completedAmount === undefined) {
    return null;
  }

  if (plannedAmount <= 0) {
    return completedAmount > 0 ? 100 : 0;
  }

  // 플랜된 양 대비 진행률
  const progress = (completedAmount / plannedAmount) * 100;
  return Math.min(100, Math.max(0, progress));
}

/**
 * 시간 기반 진행률 계산
 */
function calculateTimeProgress(
  actualMinutes: number | null | undefined,
  estimatedMinutes: number | null | undefined,
  contentType: ContentType,
  plannedAmount: number,
  episodeDurations?: number[] | null
): number | null {
  if (actualMinutes === null || actualMinutes === undefined) {
    return null;
  }

  // 예상 시간이 있으면 사용
  if (estimatedMinutes && estimatedMinutes > 0) {
    return Math.min(100, (actualMinutes / estimatedMinutes) * 100);
  }

  // 예상 시간이 없으면 콘텐츠 유형별 기본값 사용
  let defaultEstimatedMinutes: number;

  if (contentType === "lecture" && episodeDurations && episodeDurations.length > 0) {
    // 강의: 에피소드 길이 합계 사용
    const totalDuration = episodeDurations.reduce((sum, d) => sum + d, 0);
    defaultEstimatedMinutes = totalDuration;
  } else if (contentType === "lecture") {
    // 강의: 에피소드 수 × 평균 시간
    defaultEstimatedMinutes = plannedAmount * AVG_MINUTES_PER_EPISODE;
  } else {
    // 교재/커스텀: 페이지 수 × 평균 시간
    defaultEstimatedMinutes = plannedAmount * AVG_MINUTES_PER_PAGE;
  }

  if (defaultEstimatedMinutes <= 0) {
    return actualMinutes > 0 ? 100 : 0;
  }

  return Math.min(100, (actualMinutes / defaultEstimatedMinutes) * 100);
}

/**
 * 최종 진행률 계산 (가중 평균)
 */
function calculateFinalProgress(
  amountProgress: number | null,
  timeProgress: number | null,
  weights: ProgressWeights
): number {
  // 둘 다 없으면 0
  if (amountProgress === null && timeProgress === null) {
    return 0;
  }

  // 하나만 있으면 해당 값 사용
  if (amountProgress === null) {
    return timeProgress ?? 0;
  }
  if (timeProgress === null) {
    return amountProgress;
  }

  // 둘 다 있으면 가중 평균
  const normalizedAmountWeight =
    weights.amountWeight / (weights.amountWeight + weights.timeWeight);
  const normalizedTimeWeight =
    weights.timeWeight / (weights.amountWeight + weights.timeWeight);

  return (
    amountProgress * normalizedAmountWeight +
    timeProgress * normalizedTimeWeight
  );
}

/**
 * 진행 상태 판단
 */
function determineProgressStatus(
  progress: number,
  timeProgress: number | null
): ProgressCalculationResult["status"] {
  if (progress >= 100) return "completed";
  if (progress >= 90) return "nearly_done";
  if (progress > 0) return "in_progress";
  if (timeProgress !== null && timeProgress > 100) return "over_time";
  return "not_started";
}

/**
 * 예상 남은 시간 계산
 */
function calculateRemainingTime(
  progress: number,
  actualMinutes: number | null | undefined,
  estimatedMinutes: number | null | undefined,
  contentType: ContentType,
  plannedAmount: number,
  episodeDurations?: number[] | null
): number | null {
  if (progress >= 100) return 0;

  // 예상 시간이 있으면 사용
  if (estimatedMinutes && estimatedMinutes > 0) {
    const remaining = estimatedMinutes * (1 - progress / 100);
    return Math.max(0, Math.round(remaining));
  }

  // 실제 소요 시간과 진행률로 추정
  if (actualMinutes && actualMinutes > 0 && progress > 0) {
    const estimatedTotal = actualMinutes / (progress / 100);
    const remaining = estimatedTotal - actualMinutes;
    return Math.max(0, Math.round(remaining));
  }

  // 기본 추정 (콘텐츠 유형별)
  let defaultEstimatedMinutes: number;
  if (contentType === "lecture" && episodeDurations && episodeDurations.length > 0) {
    defaultEstimatedMinutes = episodeDurations.reduce((sum, d) => sum + d, 0);
  } else if (contentType === "lecture") {
    defaultEstimatedMinutes = plannedAmount * AVG_MINUTES_PER_EPISODE;
  } else {
    defaultEstimatedMinutes = plannedAmount * AVG_MINUTES_PER_PAGE;
  }

  return Math.max(0, Math.round(defaultEstimatedMinutes * (1 - progress / 100)));
}

/**
 * 계산 방식 결정
 */
function determineCalculationMethod(
  amountProgress: number | null,
  timeProgress: number | null,
  weights: ProgressWeights
): ProgressCalculationResult["calculationMethod"] {
  if (amountProgress !== null && timeProgress !== null) {
    return "hybrid";
  }
  if (amountProgress !== null) {
    return "amount";
  }
  if (timeProgress !== null) {
    return "time";
  }
  return "estimated";
}

// ============================================
// Utility Functions
// ============================================

/**
 * 분을 시:분 형식으로 변환
 */
export function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}시간 ${mins}분`;
  }
  return `${mins}분`;
}

/**
 * 진행률 상태 레이블 반환
 */
export function getProgressStatusLabel(
  status: ProgressCalculationResult["status"]
): string {
  switch (status) {
    case "not_started":
      return "시작 전";
    case "in_progress":
      return "진행 중";
    case "nearly_done":
      return "거의 완료";
    case "completed":
      return "완료";
    case "over_time":
      return "초과";
    default:
      return "알 수 없음";
  }
}

/**
 * 진행률 색상 클래스 반환
 */
export function getProgressColorClass(progress: number): string {
  if (progress >= 100) return "text-green-600 dark:text-green-400";
  if (progress >= 75) return "text-blue-600 dark:text-blue-400";
  if (progress >= 50) return "text-indigo-600 dark:text-indigo-400";
  if (progress >= 25) return "text-yellow-600 dark:text-yellow-400";
  return "text-gray-600 dark:text-gray-400";
}
