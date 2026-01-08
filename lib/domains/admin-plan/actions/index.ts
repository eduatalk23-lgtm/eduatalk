/**
 * Admin Plan Management Actions
 * 관리자용 플랜 관리 서버 액션 모음
 */

// Flexible Content Actions
export {
  getFlexibleContents,
  getFlexibleContent,
  createFlexibleContent,
  updateFlexibleContent,
  deleteFlexibleContent,
  linkMasterContent,
  unlinkMasterContent,
} from './flexibleContent';

// Unified Plan Creation (New - replaces ad-hoc plan creation)
export {
  createUnifiedPlan,
  createUnifiedAdhocPlan,
  ensurePlanGroup,
  type UnifiedPlanInput,
  type UnifiedPlanResult,
} from './unifiedPlanCreate';

// Ad-hoc Plan Actions
// @deprecated Use createUnifiedPlan for creating plans
export {
  getAdHocPlans,
  getAdHocPlan,
  getTodayAdHocPlans,
  /** @deprecated Use createUnifiedPlan instead */
  createAdHocPlan,
  updateAdHocPlan,
  updateAdHocPlanStatus,
  deleteAdHocPlan,
  moveAdHocPlanToContainer,
  carryoverAdHocPlans,
} from './adHocPlan';

// Plan Event Actions
export {
  createPlanEvent,
  createPlanEvents,
  generateCorrelationId,
  getPlanEvents,
  getPlanGroupEventHistory,
  getStudentRecentEvents,
  getCorrelatedEvents,
  getEventStats,
  // Helper functions
  logPlanCompleted,
  logVolumeAdjusted,
  logVolumeRedistributed,
  logPlanCarryover,
  logTimerStarted,
  logTimerCompleted,
  logContainerMoved,
  logPlanDeleted,
  logPlanCreated,
} from './planEvent';

// Container Operations (with event logging)
export {
  movePlanToContainer,
  deletePlanWithLogging,
} from './containerOperations';

// Carryover Operations
export {
  runCarryoverForStudent,
  runBulkCarryover,
  getCarryoverPreview,
} from './carryover';

// Filter Operations
export {
  getFilteredPlans,
  getStudentSubjects,
  type PlanFilterParams,
  type FilteredPlan,
  type FilterResult,
} from './filter';

// Student Contents and Plan Groups for Admin
export {
  getStudentContentsForAdmin,
  getPlanGroupDetailsForAdminAction,
  getStudentContentsForAIPlanAction,
  type StudentContentItem,
  type AIPlanStudentData,
  type AIPlanContentData,
  type AIPlanScoreData,
  type GetStudentContentsForAIPlanInput,
  type GetStudentContentsForAIPlanResult,
} from './studentContents';

// AI Plan Generation Actions
export { saveAIGeneratedPlansAction } from './aiPlanGeneration';

// LLM Response Transformers
export { transformLLMResponseToPlans } from '../transformers/llmResponseTransformer';

// Batch AI Plan Generation
export {
  generateBatchPlansWithAI,
  estimateBatchPlanCost,
  getStudentsContentsForBatch,
  type BatchPlanSettings,
  type BatchPlanGenerationInput,
  type StudentPlanResult,
  type BatchProgressEvent,
  type BatchPlanGenerationResult,
} from './batchAIPlanGeneration';

// Create Plan from Content
export {
  createPlanFromContent,
  createPlanFromContentWithScheduler,
  type DistributionMode,
  type CreatePlanFromContentInput,
  type CreatePlanFromContentResult,
} from './createPlanFromContent';

// Copy Plan Actions
export {
  copyPlansToDate,
  type CopyPlanInput,
  type CopyPlanResult,
} from './copyPlan';

// Edit Plan Actions
export {
  getStudentPlanForEdit,
  adminUpdateStudentPlan,
  adminBulkUpdatePlans,
  type StudentPlanUpdateInput,
  type StudentPlanDetail,
} from './editPlan';

// Move to Group Actions
export {
  getStudentPlanGroups,
  movePlansToGroup,
  type MoveToGroupInput,
  type MoveToGroupResult,
  type PlanGroupInfo,
} from './moveToGroup';

// Planner Actions
export {
  createPlannerAction,
  getPlannerAction,
  getStudentPlannersAction,
  updatePlannerAction,
  deletePlannerAction,
  updatePlannerStatusAction,
  addPlannerExclusionAction,
  removePlannerExclusionAction,
  setPlannerExclusionsAction,
  addPlannerAcademyScheduleAction,
  removePlannerAcademyScheduleAction,
  setPlannerAcademySchedulesAction,
  type PlannerStatus,
  type ExclusionType,
  type NonStudyTimeBlock,
  type CreatePlannerInput,
  type UpdatePlannerInput,
  type PlannerExclusionInput,
  type PlannerAcademyScheduleInput,
  type Planner,
  type PlannerExclusion,
  type PlannerAcademySchedule,
} from './planners';

// Time Management Actions (Admin)
export {
  addStudentAcademyScheduleForAdmin,
  addStudentExclusionForAdmin,
  type AddAcademyScheduleInput,
  type AddExclusionInput,
  type TimeManagementActionResult,
} from './timeManagement';
