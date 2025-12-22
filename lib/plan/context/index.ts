/**
 * Plan Generation Context Module
 *
 * 플랜 생성 파이프라인의 모드별 설정 관리
 */

export {
  // Types
  type PlanGenerationMode,
  type TimeRange,
  type NonStudyTimeBlock,
  type SchedulerSettings,
  type BlockSettings,
  type PlanGenerationContext,
  type PlanGroupData,
  type MergedSchedulerSettingsInput,
  // Functions
  detectPlanGenerationMode,
  isCampMode,
  isTemplateMode,
  createPlanGenerationContext,
  extractSchedulerOptions,
  extractScheduleCalculationOptions,
} from "./PlanGenerationContext";

export {
  // Mode-aware helpers
  getStudyHoursForMode,
  getSelfStudyHoursForMode,
  getLunchTimeForMode,
  getHolidayHoursForMode,
  isSelfStudyEnabled,
  getNonStudyBlocksForDay,
  getLogPrefix,
  shouldBypassStatusCheckForMode,
  getContextSummary,
} from "./ModeAwareHelpers";
