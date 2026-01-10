/**
 * 스케줄러 모듈 Public API
 *
 * 스케줄러 관련 타입, Factory, 구현체를 내보냅니다.
 *
 * @module lib/scheduler
 */

// ============================================
// Types
// ============================================

export {
  // SchedulerType - Single Source of Truth
  SCHEDULER_TYPES,
  type SchedulerType,
  // Interface and I/O types
  type IScheduler,
  type SchedulerInput,
  type SchedulerOutput,
  // Re-exported types
  type ExistingPlanInfo,
  type BlockInfo,
  type ContentInfo,
  type ScheduledPlan,
  type DateAvailableTimeRanges,
  type DateTimeSlots,
  type ContentDurationMap,
} from "./types";

// ============================================
// Factory
// ============================================

export {
  generateScheduledPlans,
  getScheduler,
  registerScheduler,
  getRegisteredSchedulerTypes,
} from "./SchedulerFactory";

// ============================================
// Scheduler Implementations (for direct access if needed)
// ============================================

export { Timetable1730Scheduler, DefaultScheduler } from "./schedulers";

// ============================================
// Engine (for advanced usage)
// ============================================

export { SchedulerEngine, type SchedulerContext } from "./SchedulerEngine";
