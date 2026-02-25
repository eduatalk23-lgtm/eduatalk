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
export { getSupabaseClient } from "./utils";

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

// Exclusions (calendar_events 기반 어댑터)
export {
  getPlanExclusionsFromCalendar as getPlanExclusions,
  getStudentExclusionsFromCalendar as getStudentExclusions,
  createPlanExclusionsViaCalendar as createPlanExclusions,
  createStudentExclusionsViaCalendar as createStudentExclusions,
} from "../calendarExclusions";

// Academies (calendar_events 기반 어댑터)
export {
  getAcademySchedulesFromCalendar as getAcademySchedules,
  getStudentAcademySchedulesFromCalendar as getStudentAcademySchedules,
  getPlanGroupAcademySchedulesFromCalendar as getPlanGroupAcademySchedules,
  createAcademySchedulesViaCalendar as createAcademySchedules,
  createPlanAcademySchedulesViaCalendar as createPlanAcademySchedules,
  createStudentAcademySchedulesViaCalendar as createStudentAcademySchedules,
  // Virtual Academy CRUD (academies 테이블 대체)
  getDistinctAcademiesFromCalendar,
  renameAcademyViaCalendar,
  updateAcademyTravelTimeViaCalendar,
  deleteAcademyViaCalendar,
} from "../calendarAcademySchedules";
export type { VirtualAcademy } from "../calendarAcademySchedules";

// Academy Effective Schedules (전역 학원 일정 → EffectiveAcademySchedule 래핑)
export {
  getEffectiveAcademySchedules,
  getEffectiveAcademySchedulesForCalendar,
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
