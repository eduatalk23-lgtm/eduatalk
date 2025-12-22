/**
 * Plan Domain Actions
 */

// Core Actions
// Note: createPlanExclusion, deletePlanExclusion은 plan-groups/exclusions에서 export됨
// (FormData 기반 버전 사용 - 클라이언트 호환성)
export {
  createPlanGroup,
  updatePlanGroup,
  updatePlanGroupStatusAction,
  deletePlanGroup,
  createStudentPlan,
  updateStudentPlan,
  deleteStudentPlan,
  savePlanContents,
  updateProgress,
  updatePlanProgress,
} from "./core";

// Plan Groups Actions (Student-facing)
export * from "./plan-groups";

// Student Plan Actions (FormData 기반)
export {
  createStudentPlanForm,
  updateStudentPlanForm,
  deleteStudentPlanForm,
} from "./student";

// Schedule Availability Calculator
export { calculateScheduleAvailability } from "./calculateScheduleAvailability";
