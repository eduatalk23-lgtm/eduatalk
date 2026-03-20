/**
 * LLM 클라이언트
 *
 * AI SDK v6 기반 통합 클라이언트입니다.
 * 하위 호환성을 위해 기존 인터페이스를 유지합니다.
 *
 * @example
 * ```typescript
 * // AI SDK 래퍼 직접 사용 (권장)
 * import { generateTextWithRateLimit } from './ai-sdk';
 * const result = await generateTextWithRateLimit({...});
 *
 * // 기존 방식 (하위 호환)
 * import { createMessage } from './client';
 * const result = await createMessage({...});
 * ```
 */

import type { ModelTier, ModelConfig } from "./types";
import { logActionError } from "@/lib/utils/serverActionLogger";
import {
  generateTextWithRateLimit,
  streamTextWithRateLimit,
  type AiSdkResult,
} from "./ai-sdk";
import type { GroundingConfig, GroundingMetadata } from "./providers/base";

// ============================================
// Provider 관련 re-export (하위 호환)
// ============================================

export {
  getProvider,
  getDefaultProvider,
  getDefaultModelTier,
  getImplementedProviders,
  getAvailableProviders,
  isProviderAvailable,
  isDefaultProviderAvailable,
} from "./providers";

export type { LLMProvider, ProviderType, GroundingConfig, GroundingMetadata, WebSearchResult } from "./providers";

// ============================================
// 모델 설정
// ============================================

const MODEL_CONFIGS_INTERNAL: Record<ModelTier, ModelConfig> = {
  fast: {
    tier: "fast",
    modelId: "gemini-2.0-flash",
    maxTokens: 4096,
    temperature: 0.3,
  },
  standard: {
    tier: "standard",
    modelId: "gemini-2.0-flash",
    maxTokens: 8192,
    temperature: 0.5,
  },
  advanced: {
    tier: "advanced",
    modelId: "gemini-2.5-pro",
    maxTokens: 16384,
    temperature: 0.7,
  },
};

/**
 * 지정된 티어의 모델 설정을 반환합니다
 */
export function getModelConfig(tier: ModelTier): ModelConfig {
  return MODEL_CONFIGS_INTERNAL[tier];
}

// ============================================
// 메시지 생성 (AI SDK v6 기반)
// ============================================

export interface CreateMessageOptions {
  system: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  modelTier?: ModelTier;
  maxTokens?: number;
  temperature?: number;
  /** Grounding(웹 검색) 설정 */
  grounding?: GroundingConfig;
}

export interface CreateMessageResult {
  content: string;
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  modelId: string;
  /** Grounding 메타데이터 (웹 검색 결과) */
  groundingMetadata?: GroundingMetadata;
}

/**
 * LLM API를 호출하여 메시지를 생성합니다 (비스트리밍)
 *
 * AI SDK v6 + Gemini를 사용합니다.
 * Rate Limiting + Quota Tracking이 자동 적용됩니다.
 */
export async function createMessage(
  options: CreateMessageOptions
): Promise<CreateMessageResult> {
  const result = await generateTextWithRateLimit({
    system: options.system,
    messages: options.messages,
    modelTier: options.modelTier,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    grounding: options.grounding,
  });

  return {
    content: result.content,
    stopReason: result.stopReason,
    usage: result.usage,
    modelId: result.modelId,
    groundingMetadata: result.groundingMetadata,
  };
}

// ============================================
// 스트리밍 메시지 생성
// ============================================

export interface StreamMessageOptions extends CreateMessageOptions {
  onText?: (text: string) => void;
  onComplete?: (result: CreateMessageResult) => void;
  onError?: (error: Error) => void;
}

/**
 * LLM API를 호출하여 메시지를 스트리밍으로 생성합니다
 */
export async function streamMessage(
  options: StreamMessageOptions
): Promise<CreateMessageResult> {
  const wrappedOnComplete = options.onComplete
    ? (result: AiSdkResult) => {
        options.onComplete!({
          content: result.content,
          stopReason: result.stopReason,
          usage: result.usage,
          modelId: result.modelId,
          groundingMetadata: result.groundingMetadata,
        });
      }
    : undefined;

  const result = await streamTextWithRateLimit({
    system: options.system,
    messages: options.messages,
    modelTier: options.modelTier,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    grounding: options.grounding,
    onText: options.onText,
    onComplete: wrappedOnComplete,
    onError: options.onError,
  });

  return {
    content: result.content,
    stopReason: result.stopReason,
    usage: result.usage,
    modelId: result.modelId,
    groundingMetadata: result.groundingMetadata,
  };
}

// ============================================
// JSON 파싱 헬퍼
// ============================================

/**
 * LLM 응답 텍스트에서 JSON 객체를 추출합니다
 */
export function extractJSON<T>(content: string): T | null {
  try {
    // JSON 블록 찾기 (```json ... ```)
    const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      return JSON.parse(jsonBlockMatch[1]) as T;
    }

    // 직접 JSON 파싱 시도
    const trimmed = content.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return JSON.parse(trimmed) as T;
    }

    // JSON 객체/배열 찾기
    const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]) as T;
    }

    return null;
  } catch (error) {
    logActionError("llm.extractJSON", `JSON 파싱 실패: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// ============================================
// 토큰 계산 (추정)
// ============================================

/**
 * 텍스트의 토큰 수를 추정합니다 (한글 고려)
 */
export function estimateTokens(text: string): number {
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  const otherChars = text.length - koreanChars;
  return Math.ceil(koreanChars * 1.5 + otherChars / 4);
}

/**
 * API 호출 비용을 USD로 추정합니다
 *
 * Gemini 2.0 Flash 기준 가격:
 * - fast/standard: $0.10/1M input, $0.40/1M output
 * - advanced: $1.25/1M input, $5.00/1M output
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  tier: ModelTier
): number {
  const pricing: Record<ModelTier, { input: number; output: number }> = {
    fast: { input: 0.1, output: 0.4 },
    standard: { input: 0.1, output: 0.4 },
    advanced: { input: 1.25, output: 5.0 },
  };

  const { input, output } = pricing[tier];
  return (inputTokens * input) / 1_000_000 + (outputTokens * output) / 1_000_000;
}
