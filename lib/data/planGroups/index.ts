/**
 * 플랜 그룹 데이터 모듈
 *
 * 하위 호환성을 위해 모든 함수와 타입을 re-export합니다.
 */

// Types
export type {
  PlanGroupInsert,
  PlanGroupUpdate,
  PlanGroupPayload,
  PlanGroupFilters,
  PlanGroupStats,
  PlanGroupDetailedStats,
  PlanGroupContentSummary,
  PlanGroup,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
  SchedulerOptions,
  SubjectConstraints,
  AdditionalPeriodReallocation,
  NonStudyTimeBlock,
  DailyScheduleInfo,
  PlanContentWithDetails,
  ExclusionType,
  ContentSlot,
  SupabaseClient,
} from "./types";

// Utils
export { getSupabaseClient, getOrCreateAcademy } from "./utils";

// Core CRUD
export {
  getPlanGroupsForStudent,
  getPlanGroupById,
  createPlanGroup,
  updatePlanGroup,
  deletePlanGroup,
} from "./core";

// Deletion
export {
  deletePlanGroupByInvitationId,
  deletePlanGroupsByTemplateId,
} from "./deletion";

// Contents
export { getPlanContents, createPlanContents } from "./contents";

// Exclusions
export {
  getPlanExclusions,
  getStudentExclusions,
  createPlanExclusions,
  createStudentExclusions,
} from "./exclusions";

// Academies
export {
  getAcademySchedules,
  getStudentAcademySchedules,
  getPlanGroupAcademySchedules,
  createAcademySchedules,
  createPlanAcademySchedules,
  createStudentAcademySchedules,
} from "./academies";

// Admin
export {
  getPlanGroupByIdForAdmin,
  getPlanGroupWithDetails,
  getPlanGroupWithDetailsForAdmin,
} from "./admin";

// Summary
export {
  getPlanGroupsWithStats,
  getPlanGroupContentSummary,
  getPlanGroupContentSummaries,
} from "./summary";
