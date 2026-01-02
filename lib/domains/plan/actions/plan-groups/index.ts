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

// Plans - 메인 엔트리포인트 (서비스 기반 구현 사용)
// PLAN-005: 이중 유지 해결 - 레거시 exports 제거
// 레거시 구현은 ENABLE_NEW_PLAN_SERVICES=false 환경변수로 롤백 시에만 내부적으로 사용됨
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
