/**
 * LLM 클라이언트
 *
 * LLM Provider 패턴을 기반으로 한 통합 클라이언트입니다.
 * 기존 Anthropic 직접 호출 코드와의 하위 호환성을 유지합니다.
 *
 * @example
 * ```typescript
 * // 새로운 Provider 패턴 사용 (권장)
 * import { getProvider } from './providers';
 * const provider = getProvider('anthropic');
 * const result = await provider.createMessage({...});
 *
 * // 기존 방식 (하위 호환)
 * import { createMessage } from './client';
 * const result = await createMessage({...});
 * ```
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ModelTier, ModelConfig } from "./types";
import { logActionError } from "@/lib/utils/serverActionLogger";
import {
  getProvider,
  getDefaultProvider,
  type LLMProvider,
  type ProviderType,
  type CreateMessageOptions as ProviderCreateMessageOptions,
  type CreateMessageResult as ProviderCreateMessageResult,
  type GroundingConfig,
  type GroundingMetadata,
} from "./providers";

// ============================================
// Provider 관련 re-export
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
// 환경 변수 검증 (하위 호환용)
// ============================================

function getApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다. " +
        ".env.local 파일에 ANTHROPIC_API_KEY를 추가해주세요."
    );
  }
  return apiKey;
}

// ============================================
// 클라이언트 인스턴스 (하위 호환용)
// ============================================

let clientInstance: Anthropic | null = null;

/**
 * Anthropic 클라이언트 인스턴스를 가져옵니다 (싱글톤 패턴)
 *
 * @deprecated Provider 패턴 사용을 권장합니다: getProvider('anthropic')
 * @returns {Anthropic} Anthropic SDK 클라이언트 인스턴스
 * @throws {Error} ANTHROPIC_API_KEY 환경 변수가 없을 경우
 *
 * @example
 * ```typescript
 * // 권장하지 않음 (하위 호환용)
 * const client = getAnthropicClient();
 * const response = await client.messages.create({...});
 *
 * // 권장
 * const provider = getProvider('anthropic');
 * const result = await provider.createMessage({...});
 * ```
 */
export function getAnthropicClient(): Anthropic {
  if (!clientInstance) {
    clientInstance = new Anthropic({
      apiKey: getApiKey(),
    });
  }
  return clientInstance;
}

// ============================================
// 모델 설정
// ============================================

const MODEL_CONFIGS_INTERNAL: Record<ModelTier, ModelConfig> = {
  fast: {
    tier: "fast",
    modelId: "claude-3-5-haiku-20241022",
    maxTokens: 4096,
    temperature: 0.3,
  },
  standard: {
    tier: "standard",
    modelId: "claude-sonnet-4-20250514",
    maxTokens: 8192,
    temperature: 0.5,
  },
  advanced: {
    tier: "advanced",
    modelId: "claude-sonnet-4-20250514",
    maxTokens: 16384,
    temperature: 0.7,
  },
};

/**
 * 지정된 티어의 모델 설정을 반환합니다
 *
 * @param {ModelTier} tier - 모델 티어 ('fast' | 'standard' | 'advanced')
 * @returns {ModelConfig} 모델 설정 (modelId, maxTokens, temperature 포함)
 *
 * @example
 * ```typescript
 * const config = getModelConfig('standard');
 * // { tier: 'standard', modelId: 'claude-sonnet-4-...', maxTokens: 8192, temperature: 0.5 }
 * ```
 */
export function getModelConfig(tier: ModelTier): ModelConfig {
  return MODEL_CONFIGS_INTERNAL[tier];
}

// ============================================
// 메시지 생성 (하위 호환 인터페이스)
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
  /** Grounding(웹 검색) 설정 - Gemini Provider에서만 지원 */
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
  /** Grounding 메타데이터 (웹 검색 결과) - Gemini Provider에서 grounding 활성화 시 포함 */
  groundingMetadata?: GroundingMetadata;
}

/**
 * LLM API를 호출하여 메시지를 생성합니다 (비스트리밍)
 *
 * 내부적으로 Provider 패턴을 사용하며, 환경 변수 LLM_PROVIDER에 따라
 * 적절한 Provider가 선택됩니다 (기본값: anthropic).
 *
 * @param {CreateMessageOptions} options - 메시지 생성 옵션
 * @param {string} options.system - 시스템 프롬프트
 * @param {Array} options.messages - 대화 메시지 배열
 * @param {ModelTier} [options.modelTier='standard'] - 모델 티어
 * @param {number} [options.maxTokens] - 최대 출력 토큰 수
 * @param {number} [options.temperature] - 생성 온도 (0-1)
 * @returns {Promise<CreateMessageResult>} 생성된 메시지 결과
 *
 * @example
 * ```typescript
 * const result = await createMessage({
 *   system: SYSTEM_PROMPT,
 *   messages: [{ role: 'user', content: userPrompt }],
 *   modelTier: 'standard',
 * });
 * console.log(result.content); // LLM 응답 텍스트
 * console.log(result.usage);   // { inputTokens, outputTokens }
 * ```
 */
export async function createMessage(
  options: CreateMessageOptions
): Promise<CreateMessageResult> {
  const provider = getProvider();

  const result = await provider.createMessage({
    system: options.system,
    messages: options.messages,
    modelTier: options.modelTier,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    grounding: options.grounding,
  });

  // 하위 호환성을 위해 provider 필드 제거
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
 *
 * 실시간으로 생성되는 텍스트를 받아 UI에 표시하거나 프로그레스바를 업데이트할 때 사용합니다.
 *
 * @param {StreamMessageOptions} options - 스트리밍 메시지 옵션
 * @param {Function} [options.onText] - 텍스트 청크가 수신될 때마다 호출되는 콜백
 * @param {Function} [options.onComplete] - 스트리밍 완료 시 호출되는 콜백
 * @param {Function} [options.onError] - 에러 발생 시 호출되는 콜백
 * @returns {Promise<CreateMessageResult>} 최종 생성 결과
 *
 * @example
 * ```typescript
 * await streamMessage({
 *   system: SYSTEM_PROMPT,
 *   messages: [{ role: 'user', content: userPrompt }],
 *   onText: (chunk) => process.stdout.write(chunk),
 *   onComplete: (result) => console.log('\n완료:', result.usage),
 *   onError: (err) => console.error('에러:', err.message),
 * });
 * ```
 */
export async function streamMessage(
  options: StreamMessageOptions
): Promise<CreateMessageResult> {
  const provider = getProvider();

  // onComplete 콜백 래핑 (provider 필드 제거)
  const wrappedOnComplete = options.onComplete
    ? (result: ProviderCreateMessageResult) => {
        options.onComplete!({
          content: result.content,
          stopReason: result.stopReason,
          usage: result.usage,
          modelId: result.modelId,
          groundingMetadata: result.groundingMetadata,
        });
      }
    : undefined;

  const result = await provider.streamMessage({
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

  // 하위 호환성을 위해 provider 필드 제거
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
 *
 * 다음 순서로 JSON 추출을 시도합니다:
 * 1. ```json ... ``` 코드 블록 내부
 * 2. 응답이 바로 JSON으로 시작하는 경우
 * 3. 텍스트 중간에 있는 JSON 객체/배열
 *
 * @template T - 추출할 JSON의 타입
 * @param {string} content - LLM 응답 텍스트
 * @returns {T | null} 파싱된 JSON 객체 또는 실패 시 null
 *
 * @example
 * ```typescript
 * interface PlanResponse { plans: Plan[] }
 * const data = extractJSON<PlanResponse>(llmResponse);
 * if (data) {
 *   console.log(data.plans);
 * }
 * ```
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
 *
 * Claude 토크나이저를 근사하여 계산합니다:
 * - 한글: 약 1.5 토큰/문자
 * - 영어/기타: 약 0.25 토큰/문자 (4문자당 1토큰)
 *
 * ⚠️ 추정치이므로 실제 토큰 수와 차이가 있을 수 있습니다.
 *
 * @param {string} text - 토큰 수를 추정할 텍스트
 * @returns {number} 추정 토큰 수
 *
 * @example
 * ```typescript
 * const tokens = estimateTokens('안녕하세요 Hello');
 * console.log(tokens); // 약 9 (한글 5자 * 1.5 + 영어 6자 * 0.25)
 * ```
 */
export function estimateTokens(text: string): number {
  const provider = getProvider();
  return provider.estimateTokens(text);
}

/**
 * API 호출 비용을 USD로 추정합니다
 *
 * Provider별 가격 정보를 사용하여 계산합니다.
 *
 * @param {number} inputTokens - 입력 토큰 수
 * @param {number} outputTokens - 출력 토큰 수
 * @param {ModelTier} tier - 모델 티어
 * @returns {number} 추정 비용 (USD)
 *
 * @example
 * ```typescript
 * const cost = estimateCost(2000, 1500, 'standard');
 * console.log(`예상 비용: $${cost.toFixed(4)}`); // "$0.0285"
 * ```
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  tier: ModelTier
): number {
  const provider = getProvider();
  return provider.estimateCost(inputTokens, outputTokens, tier);
}
