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
  validateRequest,
  limitContents,
  calculateDaysInRange,
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
