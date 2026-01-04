/**
 * 플랜 생성 서비스 모듈
 *
 * 플랜 생성 관련 서비스들을 통합 export합니다.
 *
 * NOTE: ContentResolutionService와 PlanPersistenceService는
 * @/lib/plan/shared에서 re-export됩니다. 직접 import 시 shared를 권장합니다.
 *
 * @module lib/domains/plan/services
 */

// ============================================
// 핵심 서비스 (lib/plan/shared에서 re-export)
// ============================================

export {
  ContentResolutionService,
  ContentResolutionServiceWithContext,
  createContentResolutionService,
  getContentResolutionService,
  ContentResolutionErrorCodes,
} from "@/lib/plan/shared";

export {
  PlanPersistenceService,
  PlanPersistenceServiceWithContext,
  createPlanPersistenceService,
  getPlanPersistenceService,
  createPlanServiceContext,
  PlanPersistenceErrorCodes,
} from "@/lib/plan/shared";

// ============================================
// 로컬 전용 서비스 (이 모듈에서만 제공)
// ============================================

export {
  PlanPayloadBuilder,
  createPlanPayloadBuilder,
} from "./planPayloadBuilder";

export {
  PlanValidationService,
  createPlanValidationService,
} from "./planValidationService";

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

// ============================================
// 타입 (lib/plan/shared에서 re-export)
// ============================================

export type {
  // 서비스 컨텍스트
  PlanServiceContext,
  ServiceContext,
  ServiceResult,
  SupabaseAnyClient,

  // ContentResolutionService 타입
  ContentResolutionInput,
  ContentResolutionContextInput,
  ContentResolutionOutput,
  IContentResolutionService,
  ResolvedContent,
  ContentResolutionResult,
  ContentCopyFailure,

  // PlanPersistenceService 타입
  PlanPersistenceInput,
  PlanPersistenceOutput,
  IPlanPersistenceService,
  PlanInsertResult,
  PlanInsertError,
  BatchInsertOptions,

  // 검증 타입
  ValidationError,
  ValidationWarning,
  ValidationResult,

  // 최종 결과 타입
  GeneratePlansResult,

  // 공통 타입
  ContentIdMap,
  ContentMetadataMap,
  ContentDurationMap,
  DetailIdMap,
  ContentChapterMap,
  GeneratePlanPayload,
  DayType,
  PlanContent,
  ContentType,
} from "@/lib/plan/shared";

// ============================================
// 로컬 전용 타입
// ============================================

export type {
  // PlanPayloadBuilder 타입
  DailyScheduleItem,
  PayloadBuildInput,
  PayloadBuildResult,
} from "./types";
