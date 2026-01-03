/**
 * Plan Groups Actions
 *
 * Student-facing Server Actions for plan group management.
 */

// Utils
export { normalizePlanPurpose, timeToMinutes } from "./utils";

// Queries
export {
  getPlansByGroupIdAction,
  checkPlansExistAction,
  getScheduleResultDataAction,
  getActivePlanGroups,
} from "./queries";

// Create
export {
  createPlanGroupAction,
  savePlanGroupDraftAction,
  copyPlanGroupAction,
  saveCalendarOnlyPlanGroupAction,
} from "./create";

// Update
export {
  updatePlanGroupDraftAction,
  updatePlanGroupAction,
} from "./update";

// Delete
export { deletePlanGroupAction } from "./delete";

// Status
export { updatePlanGroupStatus } from "./status";

// Plans - 서비스 기반 구현
export {
  generatePlansFromGroupAction,
  previewPlansFromGroupAction,
} from "./plans";

// Items (Logical Plans)
export {
  getLogicalPlans,
  createLogicalPlan,
  createLogicalPlans,
  updateLogicalPlan,
  deleteLogicalPlan,
  deleteAllLogicalPlans,
} from "./items";

// Academy
export {
  syncTimeManagementAcademySchedulesAction,
  addAcademySchedule,
  updateAcademySchedule,
  deleteAcademySchedule,
  getAcademySchedulesAction,
  createAcademy,
  updateAcademy,
  deleteAcademy,
} from "./academy";

// Exclusions
export {
  syncTimeManagementExclusionsAction,
  addPlanExclusion,
  deletePlanExclusion,
  // Recurring Exclusions
  getRecurringExclusions,
  createRecurringExclusion,
  deleteRecurringExclusion,
  expandRecurringExclusions,
  type RecurringExclusion,
  type ExpandedExclusion,
} from "./exclusions";

// Reschedule
export {
  type ReschedulePreviewResult,
  type RescheduleResult,
  getReschedulePreview,
  rescheduleContents,
} from "./reschedule";

// Reschedule History
export {
  type RescheduleLogItem,
  type RescheduleHistoryResult,
  getRescheduleHistory,
  getRescheduleLogDetail,
} from "./rescheduleHistory";

// Rollback
export {
  type RollbackResult,
  rollbackReschedule,
} from "./rollback";

// Adaptive Analysis
export {
  type AdaptiveAnalysisResult,
  type ReinforcementPlanResult,
  getAdaptiveScheduleAnalysis,
  getGroupScheduleAnalysis,
  getWeakSubjectReinforcement,
} from "./adaptiveAnalysis";
