/**
 * LLM 플랜 생성 모듈
 *
 * Claude API를 사용한 자동 플랜 생성 기능을 제공합니다.
 */

// 타입
export type {
  StudentInfo,
  SubjectScore,
  ContentInfo,
  LearningHistory,
  LearningStyle,
  LearningStyleType,
  ExamSchedule,
  PlanGenerationSettings,
  TimeSlotInfo,
  LLMPlanGenerationRequest,
  GeneratedPlanItem,
  DailyPlanGroup,
  WeeklyPlanMatrix,
  GenerationMetadata,
  Recommendations,
  LLMPlanGenerationResponse,
  PartialRegenerationRequest,
  StreamEventType,
  StreamEvent,
  ModelTier,
  ModelConfig,
  // 변환 컨텍스트 타입
  TransformContext,
  BlockInfo,
  SubjectAllocation,
  AcademyScheduleInfo,
  ContentDuration,
} from "./types";

// 상수
export { MODEL_CONFIGS } from "./types";

// 클라이언트
export {
  getAnthropicClient,
  getModelConfig,
  createMessage,
  streamMessage,
  extractJSON,
  estimateTokens,
  estimateCost,
} from "./client";

// 프롬프트
export {
  SYSTEM_PROMPT,
  buildUserPrompt,
  estimatePromptTokens,
} from "./prompts/planGeneration";

// 변환기
export {
  buildLLMRequest,
  buildExtendedLLMRequest,
  validateRequest,
  limitContents,
  calculateDaysInRange,
  transformBlocks,
  transformAcademySchedules,
  transformSubjectAllocations,
  type BuildRequestOptions,
  type ExtendedLLMPlanGenerationRequest,
  type BlockInfoForPrompt,
  type AcademyScheduleForPrompt,
  type SubjectAllocationForPrompt,
} from "./transformers/requestBuilder";

export {
  parseLLMResponse,
  toDBPlanData,
  toDBPlanDataList,
  validateQualityMetrics,
  type SkippedPlanInfo,
  type ParseResult,
  type QualityWarning,
  type QualityMetricsResult,
} from "./transformers/responseParser";

// 액션
export {
  generatePlanWithAI,
  previewPlanWithAI,
  type GeneratePlanInput,
  type GeneratePlanResult,
  type PreviewPlanResult,
} from "./actions/generatePlan";

// 스트리밍 액션
export {
  streamPlanGeneration,
  generatePlanStream,
  type StreamPlanInput,
  type StreamEvent as StreamPlanEvent,
  type StreamEventType as StreamPlanEventType,
} from "./actions/streamPlan";

// 부분 재생성 액션
export {
  regeneratePartialPlan,
  regenerateDatePlans,
  regenerateSubjectPlans,
  regenerateContentPlans,
  regenerateDateRangePlans,
  type PartialRegenerateInput,
  type PartialRegenerateResult,
} from "./actions/regeneratePartial";

// 부분 재생성 프롬프트
export {
  PARTIAL_REGENERATION_SYSTEM_PROMPT,
  buildPartialRegenerationPrompt,
  estimatePartialPromptTokens,
  type RegenerateScope,
  type PartialRegenerationPromptInput,
} from "./prompts/partialRegeneration";

// 콘텐츠 추천 프롬프트
export {
  CONTENT_RECOMMENDATION_SYSTEM_PROMPT,
  buildContentRecommendationPrompt,
  estimateContentRecommendationTokens,
  type ContentRecommendationRequest,
  type ContentRecommendationResponse,
  type ContentCandidate,
  type RecommendedContentResult,
  type StudentProfile,
  type SubjectScoreInfo,
  type LearningPatternInfo,
  type OwnedContentInfo,
} from "./prompts/contentRecommendation";

// 콘텐츠 추천 액션
export {
  recommendContentWithAI,
  type RecommendContentInput,
  type RecommendContentResult,
} from "./actions/recommendContent";

// 플랜 최적화 프롬프트
export {
  PLAN_OPTIMIZATION_SYSTEM_PROMPT,
  buildPlanOptimizationPrompt,
  estimatePlanOptimizationTokens,
  type PlanOptimizationRequest,
  type PlanOptimizationResponse,
  type StudentBasicInfo as OptimizationStudentInfo,
  type PlanExecutionStats,
  type TimeSlotPerformance,
  type DayOfWeekPerformance,
  type SubjectPerformance,
  type LearningPatternData,
  type IncompletePattern,
  type OptimizationSuggestion,
  type StrengthAnalysis,
  type WeaknessAnalysis,
} from "./prompts/planOptimization";

// 플랜 최적화 액션
export {
  analyzePlanEfficiency,
  type OptimizePlanInput,
  type OptimizePlanResult,
} from "./actions/optimizePlan";

// 플랜 검증기 (Phase 3)
export {
  validatePlans,
  validateAcademyConflicts,
  validateExcludedDates,
  validateDailyStudyMinutes,
  validateBlockCompatibility,
  validateTimeFormats,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type ValidatePlansOptions,
} from "./validators/planValidator";

// AI Framework 타입 (Phase 4: 하이브리드 시스템)
export type {
  // 과목 분류
  SubjectClassificationType,
  SubjectClassification,
  // 일별/주별 전략
  DailyFocusType,
  DailyStrategy,
  WeeklyStrategy,
  // 시간 힌트
  PreferredTimeSlot,
  TimeHint,
  // 콘텐츠 우선순위
  UrgencyLevel,
  ContentPriority,
  // 추천사항
  AIRecommendations,
  // 메인 프레임워크
  AIFrameworkMeta,
  AIFramework,
  // 입력 타입
  AIFrameworkStudentInfo,
  AIFrameworkScoreInfo,
  AIFrameworkContentInfo,
  AIFrameworkLearningHistory,
  AIFrameworkPeriod,
  AIFrameworkInput,
  // 변환 결과
  FrameworkConversionResult,
} from "./types/aiFramework";

// AIFramework → SchedulerOptions 변환기 (Phase 4)
export {
  convertFrameworkToSchedulerOptions,
  isCompatibleFrameworkVersion,
  isHighConfidenceFramework,
  calculateAverageConfidence,
  extractWeaknessSubjects,
  extractStrategySubjects,
  getOptimalTimeSlot,
  getRecommendedDuration,
  type ConvertedSchedulerOptions,
  type ContentMapping,
  type ConversionOptions,
} from "./converters/frameworkToSchedulerOptions";

// AI Framework 생성 프롬프트 (Phase 4)
export {
  FRAMEWORK_SYSTEM_PROMPT,
  buildFrameworkUserPrompt,
  estimateFrameworkPromptTokens,
  estimateFrameworkPromptTokensDetailed,
  parseFrameworkResponse,
  updateFrameworkMeta,
} from "./prompts/frameworkGeneration";

// 하이브리드 플랜 생성 액션 (Phase 4)
export {
  generateAIFrameworkAction,
  type GenerateFrameworkInput,
  type GenerateFrameworkResult,
} from "./actions/generateHybridPlan";

// 하이브리드 플랜 완전 생성 액션 (Phase 4 - 통합)
export {
  generateHybridPlanCompleteAction,
  previewHybridPlanAction,
  type GenerateHybridPlanCompleteInput,
  type GenerateHybridPlanCompleteResult,
  type PreviewHybridPlanResult,
} from "./actions/generateHybridPlanComplete";

// AI Framework 유틸리티 함수 (Phase 4)
export {
  extractSchedulerOptionsForDB,
  extractRecommendationsForDB,
  extractContentOrderingForDB,
} from "./utils/frameworkUtils";

// 비교 메트릭스 (Phase 4 - 검증)
export {
  calculateTokenUsage,
  calculateCost,
  calculateTokenSavings,
  calculateContentCoverage,
  calculateSubjectBalance,
  calculateTimeEfficiency,
  calculateOverallQualityScore,
  compareGenerationMethods,
  estimateTokenSavings,
  formatComparisonResult,
  type TokenUsage,
  type CostInfo,
  type TimingInfo,
  type QualityMetrics,
  type GenerationMetrics,
  type ComparisonResult,
  type ComparisonSummary,
  type TokenEstimateComparison,
} from "./utils/comparisonMetrics";
