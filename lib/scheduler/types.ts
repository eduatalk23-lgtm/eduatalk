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
// Overlap Validation Types
// ============================================

/**
 * 시간 겹침 정보
 */
export interface TimeOverlap {
  /** 겹침이 발생한 날짜 (YYYY-MM-DD) */
  date: string;
  /** 새로 생성된 플랜 정보 */
  newPlan: { content_id: string; start_time: string; end_time: string };
  /** 기존 플랜 정보 */
  existingPlan: { start_time: string; end_time: string };
  /** 겹치는 시간 (분) */
  overlapMinutes: number;
}

/**
 * 겹침 검증 결과
 */
export interface OverlapValidationResult {
  /** 겹침이 있는지 여부 */
  hasOverlaps: boolean;
  /** 겹침 목록 */
  overlaps: TimeOverlap[];
  /** 총 겹침 시간 (분) */
  totalOverlapMinutes: number;
}

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

  /** 콘텐츠별 subject_type 정보 (전략/취약 구분, 스케줄링 우선순위에 사용) */
  subjectTypeMap?: Map<string, "strategy" | "weakness">;

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

  /** 기존 플랜과의 시간 겹침 검증 결과 (Phase 4) */
  overlapValidation?: OverlapValidationResult;
}

/**
 * generatePlansFromGroup 함수의 반환 타입
 *
 * 생성된 플랜과 함께 충돌 검증 결과를 반환합니다.
 */
export interface GeneratePlansResult {
  /** 생성된 플랜 목록 */
  plans: ScheduledPlan[];

  /** 기존 플랜과의 시간 겹침 검증 결과 */
  overlapValidation?: OverlapValidationResult;

  /** 자동 조정이 적용되었는지 여부 */
  wasAutoAdjusted?: boolean;

  /** 자동 조정된 플랜 개수 */
  autoAdjustedCount?: number;

  /** 조정 불가능한 플랜 목록 (시간대 부족 등) */
  unadjustablePlans?: Array<{
    plan: ScheduledPlan;
    reason: string;
  }>;
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
// Study Day Plan Generation Helper Types
// ============================================

/**
 * 주기 정보 맵 타입
 */
export type CycleDayMap = Map<
  string,
  { cycle_day_number: number; day_type: "study" | "review" | "exclusion" }
>;

/**
 * 플랜 항목 (콘텐츠 + 범위)
 */
export interface PlanItem {
  content: ContentInfo;
  start: number;
  end: number;
}

/**
 * 소요시간이 포함된 플랜 항목
 */
export interface PlanWithDuration extends PlanItem {
  requiredMinutes: number;
  remainingMinutes: number;
}

/**
 * 날짜별 플랜 맵 타입
 */
export type StudyPlansByDate = Map<string, PlanItem[]>;

/**
 * 시간 슬롯 가용성 추적 타입
 */
export interface SlotAvailability {
  slot: {
    start: string;
    end: string;
    type: string;
    label?: string;
    source?: string;
  };
  usedTime: number;
  occupiedIntervals: [number, number][];
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
