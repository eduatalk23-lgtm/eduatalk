/**
 * 플랜 생성 모듈 - 공통 타입 및 유틸리티
 *
 * 모든 플랜 생성 액션에서 사용되는 공통 인터페이스와 검증 유틸리티
 *
 * @module lib/domains/admin-plan/actions/planCreation
 */

// 타입 정의
export type {
  // 기본 타입
  BasePlanCreationInput,
  PlanCreationResult,
  // 플래너 검증
  PlannerValidationResult,
  ValidatedPlanner,
  // 빠른 플랜
  QuickPlanCreationInput,
  QuickPlanCreationResult,
  // 단발성 플랜
  AdHocPlanCreationInput,
  AdHocPlanCreationResult,
  // 콘텐츠 기반 플랜
  ContentPlanCreationInput,
  ContentPlanCreationResult,
  // AI 플랜
  AIPlanCreationInput,
  AIPlanCreationResult,
  ContentInfo,
  ScoreInfo,
  // Plan Group 선택
  PlanGroupSelectorResult,
  PlanGroupInfo,
} from "./types";

// 플래너 검증 유틸리티
export {
  validatePlanner,
  validatePlannerOwnership,
  validatePlannerPeriod,
} from "./validatePlanner";

// 기존 플랜 조회
export {
  getExistingPlansForPlanGroup,
  getExistingPlansForStudent,
  groupExistingPlansByDate,
  type ExistingPlanTimeInfo,
  type ExistingPlansByDate,
} from "./existingPlansQuery";

// 타임라인 조정
export {
  adjustDateTimeSlotsWithExistingPlans,
  adjustDateAvailableTimeRangesWithExistingPlans,
  subtractTimeRange,
  timeToMinutes,
  minutesToTime,
  calculateTotalAvailableMinutes,
  canPlacePlanOnDate,
  type TimeSlot,
  type DateTimeSlots,
  type TimeRange,
} from "./timelineAdjustment";

// 스케줄 생성
export {
  generateScheduleForPlanner,
  generateScheduleForPlanGroup,
  type ScheduleGenerationResult,
} from "./scheduleGenerator";

// 단일 날짜 스케줄러
export {
  findAvailableTimeSlot,
  getAvailableMinutesForDate,
  type SingleDayScheduleInput,
  type SingleDayScheduleResult,
} from "./singleDayScheduler";
