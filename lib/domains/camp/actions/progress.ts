"use server";

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
 */

// Re-export all functions from modular structure
export {
  // Review
  getCampPlanGroupForReview,
  getPlanGroupContentsForRangeAdjustment,
  // Status
  updateCampPlanGroupSubjectAllocations,
  updateCampPlanGroupStatus,
  batchUpdateCampPlanGroupStatus,
  // Wizard
  continueCampStepsForAdmin,
  // Bulk
  bulkApplyRecommendedContents,
  bulkCreatePlanGroupsForCamp,
  bulkAdjustPlanRanges,
  bulkPreviewPlans,
  bulkGeneratePlans,
} from "./progress/index";
