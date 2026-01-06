/**
 * LLM Provider Factory
 *
 * Provider 인스턴스를 생성하고 관리하는 팩토리 모듈입니다.
 */

// ============================================
// 타입 및 인터페이스 내보내기
// ============================================

export type {
  ModelTier,
  ProviderType,
  ModelConfig,
  MessageRole,
  Message,
  CreateMessageOptions,
  CreateMessageResult,
  StreamMessageOptions,
  CostInfo,
  ProviderStatus,
  LLMProvider,
  GroundingConfig,
  GroundingMetadata,
  WebSearchResult,
} from "./base";

export { BaseLLMProvider } from "./base";

// ============================================
// Provider 구현체 내보내기
// ============================================

export { AnthropicProvider, getAnthropicProvider } from "./anthropic";
export { OpenAIProvider, getOpenAIProvider } from "./openai";
export { GeminiProvider, getGeminiProvider } from "./gemini";

// ============================================
// 설정 내보내기
// ============================================

export {
  getDefaultProvider,
  getDefaultModelTier,
  PROVIDER_CONFIGS,
  getProviderConfig,
  getImplementedProviders,
  getAvailableProviders,
  getAllProviderCosts,
  hasApiKey,
} from "./config";

export type { ProviderConfig, ProviderCostComparison } from "./config";

// ============================================
// Provider 팩토리
// ============================================

import type { LLMProvider, ProviderType } from "./base";
import { getAnthropicProvider } from "./anthropic";
import { getOpenAIProvider } from "./openai";
import { getGeminiProvider } from "./gemini";
import { getDefaultProvider, getImplementedProviders, hasApiKey } from "./config";

/**
 * 지정된 타입의 Provider 인스턴스 반환
 *
 * @param type Provider 타입 (기본값: 환경 변수 또는 'anthropic')
 * @returns LLMProvider 인스턴스
 * @throws Error 구현되지 않은 Provider 타입인 경우
 *
 * @example
 * ```typescript
 * const provider = getProvider('anthropic');
 * const result = await provider.createMessage({
 *   system: 'You are a helpful assistant.',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */
export function getProvider(type?: ProviderType): LLMProvider {
  const providerType = type || getDefaultProvider();

  switch (providerType) {
    case "anthropic":
      return getAnthropicProvider();

    case "openai":
      return getOpenAIProvider();

    case "gemini":
      return getGeminiProvider();

    default:
      throw new Error(`알 수 없는 Provider 타입: ${providerType}`);
  }
}

/**
 * 사용 가능한 Provider 인스턴스 목록 반환
 *
 * API 키가 설정되어 있고 구현된 Provider만 반환합니다.
 */
export function getAvailableProviderInstances(): LLMProvider[] {
  return getImplementedProviders()
    .filter((type) => hasApiKey(type))
    .map((type) => getProvider(type));
}

/**
 * Provider 사용 가능 여부 확인
 *
 * @param type Provider 타입
 * @returns 구현되어 있고 API 키가 설정된 경우 true
 */
export function isProviderAvailable(type: ProviderType): boolean {
  const implementedProviders = getImplementedProviders();
  return implementedProviders.includes(type) && hasApiKey(type);
}

/**
 * 기본 Provider가 사용 가능한지 확인
 */
export function isDefaultProviderAvailable(): boolean {
  return isProviderAvailable(getDefaultProvider());
}
