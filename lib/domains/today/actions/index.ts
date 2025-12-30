/**
 * Today Domain Actions
 */

// Timer Actions
export {
  startPlan,
  completePlan,
  postponePlan,
  startTimer,
  endTimer,
  pausePlan,
  resumePlan,
  preparePlanCompletion,
  getServerTime,
  syncTimerProgress,
  // Unified Timer Actions (for student_plan and ad_hoc_plan)
  startPlanUnified,
  completePlanUnified,
  cancelPlanUnified,
  type PlanType,
} from "./timer";

// Memo Actions
export { getPlanMemo, savePlanMemo } from "./memo";

// Order Actions
export { updatePlanOrder } from "./order";

// Range Actions
export { adjustPlanRanges } from "./range";

// Session Time Actions
export { getTimeEventsByPlanNumber } from "./sessionTime";

// Reset Actions
export { resetPlanTimer } from "./reset";

// Device Conflict Actions
export {
  checkDeviceConflict,
  updateSessionHeartbeat,
  takeoverSession,
  setSessionDeviceInfo,
} from "./deviceConflict";

// Container Plans Actions
export {
  getTodayContainerPlans,
  moveToDaily,
  moveToWeekly,
  processEndOfDay,
  type ContainerPlan,
  type ContainerSummary,
  type TodayContainerResult,
} from "./containerPlans";

// Execution Log Actions
export {
  logPlanExecutionEvent,
  getPlanExecutionLogs,
  getTodayExecutionSummary,
  logTimerEvent,
  type LogExecutionEventResult,
  type GetExecutionLogsResult,
} from "./executionLog";

// Ad-hoc Timer Actions
export {
  startAdHocPlan,
  completeAdHocPlan,
  getAdHocPlanStatus,
  cancelAdHocPlan,
} from "./adHocTimer";
