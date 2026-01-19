/**
 * 플랜 생성 Server Actions 내보내기
 */

export {
  getTemplates,
  getTemplate,
  getDefaultTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
} from "./templateActions";

export {
  getHistoryList,
  getHistory,
  createHistory,
  updateHistory,
  getHistoryStats,
} from "./historyActions";

export {
  createBatchQuickPlans,
  createBatchPlanGroups,
  createBatchUnifiedPlans,
  addBatchContents,
  type BatchStudentInput,
  type BatchResult,
  type BatchResponse,
  type QuickPlanBatchInput,
  type PlanGroupBatchInput,
  type ContentBatchInput,
  type ContentInfo,
  type UnifiedPlanBatchInput,
  type UnifiedPlanBatchResult,
  type UnifiedPlanBatchResponse,
} from "./batchActions";
