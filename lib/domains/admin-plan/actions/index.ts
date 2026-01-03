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

// Ad-hoc Plan Actions
export {
  getAdHocPlans,
  getAdHocPlan,
  getTodayAdHocPlans,
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
