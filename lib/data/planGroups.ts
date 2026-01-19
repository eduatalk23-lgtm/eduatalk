/**
 * 플랜 그룹 데이터 액세스 레이어
 *
 * 모든 함수와 타입은 ./planGroups/ 모듈에서 re-export됩니다.
 * 하위 호환성을 위해 이 파일을 유지합니다.
 *
 * @module lib/data/planGroups
 * @see ./planGroups/index.ts 실제 구현
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
} from "./planGroups/types";

// Utils
export { getSupabaseClient, getOrCreateAcademy } from "./planGroups/utils";

// Core CRUD
export {
  getPlanGroupsForStudent,
  getPlanGroupById,
  createPlanGroup,
  updatePlanGroup,
  deletePlanGroup,
} from "./planGroups/core";

// Deletion
export {
  deletePlanGroupByInvitationId,
  deletePlanGroupsByTemplateId,
} from "./planGroups/deletion";

// Contents (레거시 - 다중 콘텐츠 모드에서만 사용)
export { getPlanContents, createPlanContents } from "./planGroups/contents";

// Unified Content (권장 - 단일/다중 콘텐츠 모드 통합 처리)
export {
  getUnifiedContents,
  getSingleContentFromGroup,
  hasContent,
  getContentMode,
} from "./planGroups/unifiedContent";
export type { UnifiedContentInfo, ContentMode } from "./planGroups/unifiedContent";

// Exclusions
export {
  getPlanExclusions,
  getStudentExclusions,
  createPlanExclusions,
  createStudentExclusions,
} from "./planGroups/exclusions";

// Academies
export {
  getAcademySchedules,
  getStudentAcademySchedules,
  getPlanGroupAcademySchedules,
  createAcademySchedules,
  createPlanAcademySchedules,
  createStudentAcademySchedules,
} from "./planGroups/academies";

// Admin
export {
  getPlanGroupByIdForAdmin,
  getPlanGroupWithDetails,
  getPlanGroupWithDetailsForAdmin,
} from "./planGroups/admin";

// Summary
export {
  getPlanGroupsWithStats,
  getPlanGroupContentSummary,
  getPlanGroupContentSummaries,
} from "./planGroups/summary";
