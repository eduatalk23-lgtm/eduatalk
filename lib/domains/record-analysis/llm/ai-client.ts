/**
 * Student-Record LLM 추상 레이어
 *
 * plan 도메인의 ai-sdk를 직접 import하지 않고 이 모듈을 통해 접근.
 * - 도메인 간 결합을 단일 파일로 격리
 * - 향후 모델 전환/독립 SDK 교체 시 이 파일만 수정
 */

export {
  generateTextWithRateLimit,
  generateObjectWithRateLimit,
  isRateLimitError,
  isOverloadError,
  isTimeoutError,
  isRetryableError,
} from "@/lib/domains/plan/llm/ai-sdk";

export type {
  AiSdkOptions,
  AiSdkResult,
  ModelTier,
} from "@/lib/domains/plan/llm/ai-sdk";
