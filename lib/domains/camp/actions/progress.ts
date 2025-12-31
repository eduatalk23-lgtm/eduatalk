/**
 * 캠프 플랜 그룹 진행 관련 Server Actions
 *
 * 이 파일은 하위 호환성을 위해 유지됩니다.
 * 실제 구현은 progress/ 디렉토리에서 모듈별로 분리되어 있습니다.
 *
 * @see progress/review.ts - 리뷰 관련 함수
 * @see progress/status.ts - 상태 관련 함수
 * @see progress/wizard.ts - 위저드 관련 함수
 * @see progress/bulk.ts - 대량 처리 함수
 *
 * NOTE: "use server"는 개별 파일에서 선언되어 있으므로 여기서는 제거합니다.
 * Turbopack에서는 re-export 파일에 "use server"를 사용할 수 없습니다.
 */

// Review - 리뷰 관련 함수
export {
  getCampPlanGroupForReview,
  getPlanGroupContentsForRangeAdjustment,
} from "./progress/review";

// Status - 상태 관련 함수
export {
  updateCampPlanGroupSubjectAllocations,
  updateCampPlanGroupStatus,
  batchUpdateCampPlanGroupStatus,
} from "./progress/status";

// Wizard - 위저드 관련 함수
export { continueCampStepsForAdmin } from "./progress/wizard";

// Bulk - 대량 처리 함수
export {
  bulkApplyRecommendedContents,
  bulkCreatePlanGroupsForCamp,
  bulkAdjustPlanRanges,
  bulkPreviewPlans,
  bulkGeneratePlans,
} from "./progress/bulk";
