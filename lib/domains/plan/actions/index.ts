/**
 * Plan Domain Actions
 */

// Core Actions
// Note: createPlanExclusion, deletePlanExclusion은 plan-groups/exclusions에서 export됨
// (FormData 기반 버전 사용 - 클라이언트 호환성)
export {
  createPlanGroup,
  updatePlanGroup,
  updatePlanGroupStatusAction,
  deletePlanGroup,
  createStudentPlan,
  updateStudentPlan,
  deleteStudentPlan,
  savePlanContents,
  updateProgress,
  updatePlanProgress,
} from "./core";

// Plan Groups Actions (Student-facing)
export * from "./plan-groups";

// Student Plan Actions (FormData 기반)
export {
  createStudentPlanForm,
  updateStudentPlanForm,
  deleteStudentPlanForm,
} from "./student";

// Schedule Availability Calculator
export { calculateScheduleAvailability } from "./calculateScheduleAvailability";

// Plan Movement Actions
export {
  movePlanToDate,
  movePlansToDate,
  reorderPlans,
  movePlanToContainer,
  handlePlanDrop,
  moveAdHocPlan,
  type ContainerType,
  type MovePlanResult,
  type MovePlansResult,
  type ReorderResult,
  type DropTarget,
} from "./move";

// Content Schedule Actions
export {
  getPlansForContent,
  getContentProgress,
  updateContentSchedule,
  reorderContents,
  addContentToGroup,
  removeContentFromGroup,
  getContentsForPlanGroup,
  type ContentScheduleUpdate,
  type ContentAddInput,
  type ContentProgress,
} from "./contentSchedule";

// Content Individualization Actions
export {
  splitContentSchedule,
  pauseContent,
  resumeContent,
  setContentPriority,
  getContentDetailedProgress,
  getAllContentsProgress,
  type Priority,
  type IndividualSchedule,
} from "./contentIndividualization";
export type { ContentProgress as DetailedContentProgress } from "./contentIndividualization";

// Timezone Actions (달력 기반 플랜 생성 시스템)
export {
  createTimezone,
  getTimezones,
  getTimezone,
  getTimezoneCalendarData,
  updateTimezoneStatus,
  deleteTimezone,
  activateTimezone,
} from "./timezone";

// Content Calendar Actions (타임존에 콘텐츠 추가)
export {
  addContentToTimezone,
  generatePlansForContent,
  updateContentSchedule as updateTimezoneContentSchedule,
  regeneratePlansForContent,
  removeContentFromTimezone,
  getTimezoneContents,
} from "./content-calendar";

// Review Group Actions (복습 그룹 관리)
export {
  getReviewGroups,
  getReviewGroupsForContent,
  updateReviewGroupDate,
  deleteReviewGroup,
  completeReviewGroup,
  regenerateReviewForWeek,
} from "./review-group";

// Content-based PlanGroup Actions (4단계 간소화 플로우)
export {
  getContentPlanGroupCount,
  getTemplateSettings,
  previewContentPlanGroup,
  createContentPlanGroup,
  getContentPlanGroups,
  getTemplatePlanGroups,
  // Quick Create (빠른 플랜 생성)
  quickCreateFromContent,
  getSmartScheduleRecommendation,
  createQuickPlan,
  type QuickCreateInput,
  type CreateQuickPlanInput,
  type CreateQuickPlanResult,
  // Calendar-Only Group (캘린더 전용 그룹에 콘텐츠 추가)
  addContentToCalendarOnlyGroup,
  // Existing Group (기존 그룹에 추가 콘텐츠 추가)
  addContentToExistingPlanGroup,
  type AddContentToCalendarOnlyInput,
} from "./contentPlanGroup";

// Link Content Actions (콘텐츠 연결/변경)
export {
  linkContentToVirtualPlan,
  updatePlanContent,
  getAvailableContentsForSlot,
  type ContentLinkInfo,
  type LinkContentResult,
} from "./linkContent";

// Planner Actions (플래너 관리 - 학생용)
export {
  getOrCreateDefaultPlannerAction,
  type GetOrCreateDefaultPlannerResult,
  type CreateDefaultPlannerOptions,
} from "./planners";