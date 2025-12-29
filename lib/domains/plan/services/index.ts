/**
 * 플랜 생성 서비스 모듈
 *
 * 플랜 생성 관련 서비스들을 통합 export합니다.
 *
 * @module lib/domains/plan/services
 */

// 서비스 클래스
export {
  ContentResolutionService,
  createContentResolutionService,
} from "./contentResolutionService";

export {
  PlanPayloadBuilder,
  createPlanPayloadBuilder,
} from "./planPayloadBuilder";

export {
  PlanValidationService,
  createPlanValidationService,
} from "./planValidationService";

export {
  PlanPersistenceService,
  createPlanPersistenceService,
} from "./planPersistenceService";

// 슬롯 검증 서비스
export {
  validateSlots,
  validateRequiredSlots,
  validateSlotRelationships,
  validateSubjectConstraints,
  validateContentConnections,
  validateTimeConstraints,
  validateDuplicateContent,
  findSlotTemplate,
  isSlotLocked as isSlotLockedByTemplate,
  isSlotGhost,
  calculateSlotCompleteness,
  calculateOverallCompleteness,
  formatValidationResults,
} from "./slotValidationService";

export type {
  SlotValidationError,
  SlotValidationResult,
  SlotRelationship,
  SubjectConstraint,
  SlotValidationContext,
} from "./slotValidationService";

// 템플릿 잠금 서비스
export {
  isFieldLocked,
  isSlotLocked,
  isSlotFieldLocked,
  validateFieldChange,
  validateSlotChange,
  validateLockedFields,
  getLockedFields,
  getLockedFieldsForStep,
  getLockSummary,
  getLockIconType,
  getLockStyleClasses,
  getLockHintMessage,
  getSlotLockHintMessage,
  applyTemplateLockToSlots,
  initializeSlotsFromTemplates,
  LOCKABLE_FIELDS,
} from "./templateLockService";

export type {
  LockableFieldCategory,
  LockedFieldInfo,
  LockValidationResult,
  LockViolation,
  TemplateLockContext,
} from "./templateLockService";

// 진행률 계산 서비스
export {
  calculateProgress,
  calculateCompletionProgress,
  determineStatusFromProgress,
  formatMinutesToTime,
  getProgressStatusLabel,
  getProgressColorClass,
} from "./progressCalculator";

export type {
  ProgressCalculationInput,
  ProgressCalculationResult,
  ProgressWeights,
} from "./progressCalculator";

// 적응형 스케줄러 서비스
export {
  analyzeLearningPatterns,
  analyzeAdaptiveSchedule,
  analyzeGroupSchedule,
  generateWeakSubjectReinforcement,
  generateStudentReinforcement,
} from "./adaptiveScheduler";

export type {
  TimePeriodPerformance,
  DayOfWeekPerformance,
  SubjectPerformance,
  LearningPatternAnalysis,
  ScheduleRecommendation,
  AdaptiveScheduleAnalysis,
  WeakSubjectReinforcement,
  WeakSubjectReinforcementPlan,
} from "./adaptiveScheduler";

// 타입
export type {
  // 서비스 컨텍스트
  PlanServiceContext,
  SupabaseAnyClient,

  // ContentResolutionService 타입
  ContentResolutionInput,
  ResolvedContent,
  ContentResolutionResult,
  ContentCopyFailure,

  // PlanPayloadBuilder 타입
  DailyScheduleItem,
  PayloadBuildInput,
  PayloadBuildResult,

  // PlanValidationService 타입
  ValidationError,
  ValidationWarning,
  ValidationResult,

  // PlanPersistenceService 타입
  PlanInsertResult,
  PlanInsertError,
  BatchInsertOptions,

  // 최종 결과 타입
  GeneratePlansResult,

  // 재export된 타입
  ContentIdMap,
  ContentMetadataMap,
  ContentDurationMap,
  DetailIdMap,
  ContentChapterMap,
  GeneratePlanPayload,
  DayType,
  PlanContent,
  ContentType,
} from "./types";
