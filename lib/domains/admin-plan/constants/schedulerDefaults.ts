/**
 * 스케줄러 기본값 상수
 *
 * 플래너, 플랜 그룹, 스케줄러 전반에서 사용되는 기본값들을 중앙 관리합니다.
 * 기본값 불일치 문제를 방지하고 일관성을 보장합니다.
 *
 * @module lib/domains/admin-plan/constants/schedulerDefaults
 */

/**
 * 시간 범위 타입
 */
export interface TimeRange {
  start: string;
  end: string;
}

/**
 * 1730 Timetable 스케줄러 옵션 타입
 */
export interface Timetable1730Options {
  study_days: number;
  review_days: number;
}

/**
 * 스케줄러 기본값 상수
 *
 * 모든 기본값은 이 상수에서 참조하여 일관성을 유지합니다.
 */
export const SCHEDULER_DEFAULTS = {
  /**
   * 기본 스케줄러 타입
   * - 1730_timetable: 6일 학습 + 1일 복습 사이클
   */
  TYPE: "1730_timetable" as const,

  /**
   * 1730 Timetable 스케줄러 기본 옵션
   */
  OPTIONS: {
    study_days: 6,
    review_days: 1,
  } as Timetable1730Options,

  /**
   * 기본 학습 시간 (학원 수업 등)
   */
  STUDY_HOURS: {
    start: "10:00",
    end: "19:00",
  } as TimeRange,

  /**
   * 기본 자기주도학습 시간
   */
  SELF_STUDY_HOURS: {
    start: "19:00",
    end: "22:00",
  } as TimeRange,

  /**
   * 기본 점심시간
   */
  LUNCH_TIME: {
    start: "12:00",
    end: "13:00",
  } as TimeRange,
} as const;

/**
 * 스케줄러 타입 (리터럴 타입)
 */
export type SchedulerType = typeof SCHEDULER_DEFAULTS.TYPE | "even" | "default";

/**
 * 스케줄러 옵션 타입
 */
export type SchedulerOptions = Timetable1730Options | Record<string, unknown>;
