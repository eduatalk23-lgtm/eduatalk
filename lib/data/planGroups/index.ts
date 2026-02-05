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

// Contents (레거시 - 다중 콘텐츠 모드에서만 사용)
export { getPlanContents, createPlanContents } from "./contents";

// Unified Content (권장 - 단일/다중 콘텐츠 모드 통합 처리)
export {
  getUnifiedContents,
  getSingleContentFromGroup,
  hasContent,
  getContentMode,
} from "./unifiedContent";
export type { UnifiedContentInfo, ContentMode } from "./unifiedContent";

// Exclusions
export {
  getPlanExclusions,
  getStudentExclusions,
  createPlanExclusions,
  createStudentExclusions,
} from "./exclusions";

// Exclusion Overrides (플래너별 제외일 커스터마이징)
export {
  // Plan Group용 (기존 - 하위 호환성)
  getPlannerOverrides,
  getEffectiveExclusions,
  savePlannerOverrides,
  upsertPlannerOverride,
  deletePlannerOverride,
  hasPlannerOverrides,
  // Planner용 (신규)
  getPlannerOverridesForPlanner,
  getEffectiveExclusionsForPlanner,
  savePlannerOverridesForPlanner,
  upsertPlannerOverrideForPlanner,
  deletePlannerOverrideForPlanner,
  hasPlannerOverridesForPlanner,
} from "./exclusionOverrides";

// Academies
export {
  getAcademySchedules,
  getStudentAcademySchedules,
  getPlanGroupAcademySchedules,
  createAcademySchedules,
  createPlanAcademySchedules,
  createStudentAcademySchedules,
} from "./academies";

// Academy Overrides (플래너별 학원 일정 커스터마이징)
export {
  // Plan Group용 (기존 패턴과 일관성)
  getAcademyOverrides,
  getEffectiveAcademySchedules,
  saveAcademyOverrides,
  upsertAcademyOverride,
  deleteAcademyOverride,
  hasAcademyOverrides,
  // Planner용
  getAcademyOverridesForPlanner,
  getEffectiveAcademySchedulesForPlanner,
  saveAcademyOverridesForPlanner,
  upsertAcademyOverrideForPlanner,
  deleteAcademyOverrideForPlanner,
  hasAcademyOverridesForPlanner,
  // 헬퍼
  toEffectiveSchedule,
} from "./academyOverrides";

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
