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

// NOTE: progressCalculator removed - using binary completion (status + actual_end_time) instead

// 적응형 스케줄러 서비스
export {
  analyzeLearningPatterns,
  analyzeAdaptiveSchedule,
  analyzeGroupSchedule,
  generateWeakSubjectReinforcement,
  generateStudentReinforcement,
  generateEnhancedAdaptiveSchedule,
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
  EnhancedAdaptiveOptions,
  EnhancedAdaptiveScheduleAnalysis,
  EnhancedRecommendation,
} from "./adaptiveScheduler";

// 피로도 모델링 서비스
export {
  calculateFatigueScore,
  suggestRestDays,
  adjustLearningIntensity,
  generateFatigueWarnings,
} from "./fatigueModelingService";

export type {
  IntensityLevel,
  FatigueMetrics,
  FatigueAnalysisInput,
  RestDaySuggestion,
  FatigueAnalysisResult,
} from "./fatigueModelingService";

// 학습 속도 예측 서비스
export {
  predictLearningPace,
  getStudentLearningProfile,
  adjustEstimatedDuration,
} from "./learningPacePredictor";

export type {
  TimePeriod,
  ConfidenceLevel,
  SubjectVelocityData,
  TimePeriodEfficiency,
  LearningPacePredictionInput,
  PredictedLearningPace,
  StudentLearningProfile,
  LearningPaceResult,
} from "./learningPacePredictor";

// 동적 난이도 조정 서비스
export {
  inferPlanDifficultyFeedback,
  getStudentDifficultyProfile,
  getSubjectDifficultyAdjustment,
  getSubjectsNeedingAdjustment,
} from "./dynamicDifficultyService";

export type {
  DifficultyFeedback,
  SubjectDifficultyData,
  StudentDifficultyProfile,
  DifficultyAnalysisInput,
  DifficultyResult,
} from "./dynamicDifficultyService";

// 학습 데이터 기반 추천 가중치 서비스
export {
  calculateLearningWeights,
  getTimeSlotWeight,
  getSubjectWeight,
  applyLearningWeights,
} from "./learningWeightService";

export type {
  SubjectWeight,
  TimeSlotWeight,
  LearningWeightResult,
  WeightServiceResult,
} from "./learningWeightService";

// 지연 예측 서비스
export {
  analyzeStudentPattern,
  predictPlanDelays,
  getHighRiskPlans,
} from "./delayPredictionService";

export type {
  RiskLevel,
  ActionType,
  SuggestedAction,
  DelayPrediction,
  StudentPatternAnalysis,
  DelayPredictionResult,
} from "./delayPredictionService";

// 실시간 피드백 서비스
export {
  processCompletionFeedback,
  generateRealtimeRecommendation,
  updateLearningWeightsFromFeedback,
} from "./realtimeFeedbackService";

export type {
  CompletionFeedbackInput,
  FeedbackAnalysis,
  FeedbackRecommendation,
  WeightAdjustment,
  RealtimeRecommendation,
} from "./realtimeFeedbackService";

// 지능형 스케줄링 오케스트레이터
export {
  analyzeIntelligentScheduling,
  getQuickSchedulingSummary,
} from "./intelligentSchedulingOrchestrator";

export type {
  IntelligentSchedulingAnalysis,
  KeyInsight,
  UnifiedRecommendation,
  ComponentAnalysis,
  PredictionMetrics,
  OrchestratorOptions,
} from "./intelligentSchedulingOrchestrator";

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
