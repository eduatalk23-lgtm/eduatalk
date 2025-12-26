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
  getCampParticipantsWithPaginationAction,
  updateCampInvitationStatusAction,
  deleteCampInvitationAction,
  deleteCampInvitationsAction,
  resendCampInvitationsAction,
  recoverMissingPlanGroupsAction, // Phase 6 P3
} from "./participants";

// Participants Types
export type {
  ParticipantSortColumn,
  ParticipantSortOrder,
  ParticipantStatusFilter,
  PaginatedParticipantsResult,
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
  declineCampInvitation,
  cancelCampParticipation,
  editCampParticipation,
} from "./student";

// Slot Template Presets Actions
export {
  getSlotTemplatePresets,
  getSlotTemplatePresetsForStudent,
  createSlotTemplatePreset,
  updateSlotTemplatePreset,
  deleteSlotTemplatePreset,
  setDefaultPreset,
} from "./slotPresets";
