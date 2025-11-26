/**
 * Plan 도메인 Public API
 *
 * Plan 도메인은 복잡한 구조를 가지고 있어, 점진적으로 마이그레이션합니다.
 * 현재는 기존 파일들을 re-export하는 방식으로 구성합니다.
 */

// 타입 re-export
export type {
  PlanGroup,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
  PlanGroupCreationData,
  PlanFilters,
} from "@/lib/types/plan";

// 데이터 조회 함수 re-export
export {
  // Plan Groups
  getPlanGroupsForStudent,
  getPlanGroupById,
  getPlanGroupByIdForAdmin,
  createPlanGroup,
  updatePlanGroup,
  deletePlanGroup,
  deletePlanGroupByInvitationId,
  getPlanGroupWithDetails,
  getPlanGroupWithDetailsForAdmin,
  getPlanGroupsWithStats,
  type PlanGroupFilters,
  type PlanGroupStats,
  // Plan Contents
  getPlanContents,
  createPlanContents,
  // Plan Exclusions
  getPlanExclusions,
  getStudentExclusions,
  createPlanExclusions,
  createStudentExclusions,
  // Academy Schedules
  getAcademySchedules,
  getStudentAcademySchedules,
  createAcademySchedules,
  createStudentAcademySchedules,
} from "@/lib/data/planGroups";

// Student Plans re-export
export {
  getPlansForStudent,
  getPlanById,
  createPlan,
  createPlans,
  updatePlan,
  updatePlanProgress,
  deletePlan,
  deletePlansByGroupId,
} from "@/lib/data/studentPlans";

// Plan Contents re-export
export {
  getPlanContentsByGroupId,
  createPlanContent,
  updatePlanContent,
  deletePlanContent,
  deletePlanContentsByGroupId,
} from "@/lib/data/planContents";

/**
 * 향후 마이그레이션 계획:
 *
 * 1. actions.ts 통합
 *    - app/(student)/actions/planActions.ts
 *    - app/(student)/actions/planGroupActions.ts
 *    - app/(student)/actions/plan-groups/*.ts (9개 파일)
 *
 * 2. types.ts 개선
 *    - lib/types/plan.ts 기반으로 도메인 타입 정리
 *    - Supabase 자동 생성 타입과 연동
 *
 * 3. validation.ts 추가
 *    - Zod 스키마 통합
 *
 * 4. queries.ts 분리
 *    - lib/data/planGroups.ts 내용을 도메인 구조로 이동
 */

