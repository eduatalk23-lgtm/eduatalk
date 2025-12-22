/**
 * Camp Domain Actions
 *
 * 캠프 템플릿 관련 Server Actions
 */

// Types
export type { PreviewPlan, Exclusion, AcademySchedule, StudentInfo } from "./types";

// CRUD Actions
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

// Participants Actions
export {
  sendCampInvitationsAction,
  getCampInvitationsForTemplate,
  getCampInvitationsForTemplateWithPaginationAction,
  getCampParticipantsAction,
  updateCampInvitationStatusAction,
  deleteCampInvitationAction,
  deleteCampInvitationsAction,
  resendCampInvitationsAction,
} from "./participants";

// Progress Actions
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
} from "./progress";

// Block Sets Actions
export {
  getBlockSetTemplates,
  getTemplateBlockSet,
  linkBlockSetToTemplate,
  unlinkBlockSetFromTemplate,
} from "./blockSets";

// Reschedule Actions
export {
  type ReschedulePreviewResult,
  type RescheduleResult,
  getReschedulePreviewForAdmin,
  rescheduleContentsForAdmin,
} from "./reschedule";

// Student Actions
export {
  getStudentCampInvitations,
  getCampInvitationWithTemplate,
  submitCampParticipation,
} from "./student";
