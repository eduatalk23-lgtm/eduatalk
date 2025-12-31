/**
 * 캠프 플랜 그룹 진행 관련 Server Actions
 *
 * 하위 호환성을 위해 모든 함수를 re-export합니다.
 */

// Review - 리뷰 관련 함수
export {
  getCampPlanGroupForReview,
  getPlanGroupContentsForRangeAdjustment,
} from "./review";

// Status - 상태 관련 함수
export {
  updateCampPlanGroupSubjectAllocations,
  updateCampPlanGroupStatus,
  batchUpdateCampPlanGroupStatus,
} from "./status";

// Wizard - 위저드 관련 함수
export { continueCampStepsForAdmin } from "./wizard";

// Bulk - 대량 처리 함수
export {
  bulkApplyRecommendedContents,
  bulkCreatePlanGroupsForCamp,
  bulkAdjustPlanRanges,
  bulkPreviewPlans,
  bulkGeneratePlans,
} from "./bulk";
