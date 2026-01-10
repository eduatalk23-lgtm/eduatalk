/**
 * 스케줄러 타입 정의
 *
 * IScheduler 인터페이스, 통합 입출력 타입, SchedulerType을 정의합니다.
 * 이 파일이 SchedulerType의 Single Source of Truth입니다.
 *
 * @module lib/scheduler/types
 */

import type { PlanGenerationFailureReason } from "@/lib/errors/planGenerationErrors";
import type {
  PlanExclusion,
  AcademySchedule,
  SchedulerOptions as DomainSchedulerOptions,
} from "@/lib/types/plan";
import type {
  BlockInfo,
  ContentInfo,
  ScheduledPlan,
  DateAvailableTimeRanges,
  DateTimeSlots,
  ContentDurationMap,
} from "@/lib/plan/scheduler";
import type { ExistingPlanInfo } from "@/lib/scheduler/SchedulerEngine";

// ============================================
// SchedulerType - Single Source of Truth
// ============================================

/**
 * 지원되는 스케줄러 타입 상수
 *
 * 새로운 스케줄러 추가 시 이 객체에 추가하세요.
 */
export const SCHEDULER_TYPES = {
  /** 1730 Timetable: 6일 학습 + 1일 복습 사이클 */
  TIMETABLE_1730: "1730_timetable",
  /** Default: 기본 균등 배분 스케줄러 */
  DEFAULT: "default",
} as const;

/**
 * 스케줄러 타입 (리터럴 유니온)
 *
 * null은 스케줄러 미지정 상태를 나타냅니다.
 */
export type SchedulerType =
  | (typeof SCHEDULER_TYPES)[keyof typeof SCHEDULER_TYPES]
  | null;

// ============================================
// Scheduler Input/Output Types
// ============================================

/**
 * 스케줄러 입력 타입
 *
 * 모든 스케줄러가 공통으로 사용하는 입력 데이터 구조입니다.
 * 기존 generatePlansFromGroup의 파라미터들을 통합한 형태입니다.
 */
export interface SchedulerInput {
  /** 학습 가능한 날짜 목록 (제외일 제외) */
  availableDates: string[];

  /** 학습할 콘텐츠 정보 목록 */
  contentInfos: ContentInfo[];

  /** 시간 블록 정보 */
  blocks: BlockInfo[];

  /** 학원 일정 */
  academySchedules: AcademySchedule[];

  /** 제외일 목록 */
  exclusions: PlanExclusion[];

  /** 스케줄러 옵션 (스케줄러별 설정) */
  options?: DomainSchedulerOptions;

  /** 콘텐츠별 위험도 정보 */
  riskIndexMap?: Map<string, { riskScore: number }>;

  /** 날짜별 사용 가능 시간 범위 (Step 2.5 스케줄 결과) */
  dateAvailableTimeRanges?: DateAvailableTimeRanges;

  /** 날짜별 시간 타임라인 (Step 2.5 스케줄 결과) */
  dateTimeSlots?: DateTimeSlots;

  /** 콘텐츠 소요시간 정보 */
  contentDurationMap?: ContentDurationMap;

  /** 콘텐츠별 과목 정보 */
  contentSubjects?: Map<
    string,
    { subject?: string | null; subject_category?: string | null }
  >;

  /** 기간 시작일 (재조정 시 사용) */
  periodStart?: string;

  /** 기존 플랜 정보 (시간 충돌 방지용) */
  existingPlans?: ExistingPlanInfo[];
}

/**
 * 스케줄러 출력 타입
 *
 * 모든 스케줄러가 반환하는 통합 결과 구조입니다.
 */
export interface SchedulerOutput {
  /** 생성된 플랜 목록 */
  plans: ScheduledPlan[];

  /** 플랜 생성 실패 원인 목록 */
  failureReasons: PlanGenerationFailureReason[];
}

// ============================================
// IScheduler Interface
// ============================================

/**
 * 스케줄러 인터페이스
 *
 * 모든 스케줄러 구현체가 따라야 하는 계약입니다.
 * Factory 패턴과 함께 사용하여 스케줄러를 동적으로 선택합니다.
 */
export interface IScheduler {
  /** 스케줄러 타입 식별자 */
  readonly type: SchedulerType;

  /** 스케줄러 이름 (디버깅/로깅용) */
  readonly name: string;

  /**
   * 이 스케줄러가 주어진 타입을 처리할 수 있는지 확인
   *
   * @param schedulerType - 확인할 스케줄러 타입
   * @returns 처리 가능 여부
   */
  canHandle(schedulerType: string | null | undefined): boolean;

  /**
   * 플랜 생성
   *
   * @param input - 스케줄러 입력 데이터
   * @returns 생성된 플랜과 실패 원인
   */
  generate(input: SchedulerInput): SchedulerOutput;
}

// ============================================
// Re-exports for convenience
// ============================================

export type { ExistingPlanInfo } from "@/lib/scheduler/SchedulerEngine";
export type {
  BlockInfo,
  ContentInfo,
  ScheduledPlan,
  DateAvailableTimeRanges,
  DateTimeSlots,
  ContentDurationMap,
} from "@/lib/plan/scheduler";
