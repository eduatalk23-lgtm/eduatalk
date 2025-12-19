/**
 * 캠프 템플릿 액션 Barrel 파일
 * 기존 campTemplateActions.ts의 모든 함수를 re-export하여 호환성 유지
 */

// CRUD 함수들
export {
  getCampTemplates,
  getCampTemplateById,
  createCampTemplateDraftAction,
  createCampTemplateAction,
  updateCampTemplateAction,
  updateCampTemplateStatusAction,
  deleteCampTemplateAction,
  copyCampTemplateAction,
} from "./crud";

// 참여자 관리 함수들
export {
  sendCampInvitationsAction,
  getCampInvitationsForTemplate,
  getCampInvitationsForTemplateWithPaginationAction,
  updateCampInvitationStatusAction,
  deleteCampInvitationAction,
  deleteCampInvitationsAction,
  resendCampInvitationsAction,
} from "./participants";

// 진행/검토 함수들은 아직 분리 중이므로 기존 파일에서 import
// TODO: progress.ts 파일 생성 후 이동
export {
  getCampPlanGroupForReview,
  continueCampStepsForAdmin,
  updateCampPlanGroupSubjectAllocations,
  updateCampPlanGroupStatus,
  batchUpdateCampPlanGroupStatus,
  bulkApplyRecommendedContents,
  bulkCreatePlanGroupsForCamp,
  bulkAdjustPlanRanges,
  getPlanGroupContentsForRangeAdjustment,
  bulkPreviewPlans,
  bulkGeneratePlans,
} from "../campTemplateActions";

