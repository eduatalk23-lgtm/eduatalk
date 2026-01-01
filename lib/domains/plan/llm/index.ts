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
} from "./transformers/responseParser";

// 액션
export {
  generatePlanWithAI,
  previewPlanWithAI,
  type GeneratePlanInput,
  type GeneratePlanResult,
  type PreviewPlanResult,
} from "./actions/generatePlan";
