/**
 * LLM Provider 설정
 *
 * 환경 변수를 통해 기본 Provider를 선택하고,
 * Provider별 설정을 관리합니다.
 */

import type { ProviderType, ModelTier } from "./base";

// ============================================
// 환경 변수 기반 설정
// ============================================

/**
 * 기본 LLM Provider 가져오기
 *
 * 환경 변수 LLM_PROVIDER로 설정하거나 기본값 'anthropic' 사용
 *
 * @example
 * ```
 * # .env.local
 * LLM_PROVIDER=anthropic  # 또는 openai, gemini
 * ```
 */
export function getDefaultProvider(): ProviderType {
  const envProvider = process.env.LLM_PROVIDER?.toLowerCase();

  if (envProvider === "openai") return "openai";
  if (envProvider === "gemini") return "gemini";
  if (envProvider === "anthropic") return "anthropic";

  // 기본값: anthropic
  return "anthropic";
}

/**
 * 기본 모델 티어 가져오기
 *
 * 환경 변수 LLM_DEFAULT_TIER로 설정하거나 기본값 'standard' 사용
 */
export function getDefaultModelTier(): ModelTier {
  const envTier = process.env.LLM_DEFAULT_TIER?.toLowerCase();

  if (envTier === "fast") return "fast";
  if (envTier === "advanced") return "advanced";
  if (envTier === "standard") return "standard";

  // 기본값: standard
  return "standard";
}

// ============================================
// Provider 설정 타입
// ============================================

export interface ProviderConfig {
  /** Provider 타입 */
  type: ProviderType;
  /** 환경 변수 이름 (API 키) */
  apiKeyEnvVar: string;
  /** Provider 표시 이름 */
  displayName: string;
  /** 설명 */
  description: string;
  /** 공식 웹사이트 */
  website: string;
  /** 사용 가능 여부 (구현 완료 여부) */
  implemented: boolean;
}

/**
 * Provider 설정 목록
 */
export const PROVIDER_CONFIGS: Record<ProviderType, ProviderConfig> = {
  anthropic: {
    type: "anthropic",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    displayName: "Anthropic Claude",
    description: "Claude 3.5 Haiku, Claude Sonnet 4 등 Anthropic의 AI 모델",
    website: "https://www.anthropic.com",
    implemented: true,
  },
  openai: {
    type: "openai",
    apiKeyEnvVar: "OPENAI_API_KEY",
    displayName: "OpenAI GPT",
    description: "GPT-4o, GPT-4o-mini, GPT-4 Turbo 등 OpenAI의 AI 모델",
    website: "https://openai.com",
    implemented: true,
  },
  gemini: {
    type: "gemini",
    apiKeyEnvVar: "GOOGLE_API_KEY",
    displayName: "Google Gemini",
    description: "Gemini 1.5 Flash, Gemini 1.5 Pro 등 Google의 AI 모델",
    website: "https://ai.google.dev",
    implemented: true,
  },
};

/**
 * 구현된 Provider 목록 반환
 */
export function getImplementedProviders(): ProviderType[] {
  return (Object.entries(PROVIDER_CONFIGS) as Array<[ProviderType, ProviderConfig]>)
    .filter(([, config]) => config.implemented)
    .map(([type]) => type);
}

/**
 * Provider 설정 가져오기
 */
export function getProviderConfig(type: ProviderType): ProviderConfig {
  return PROVIDER_CONFIGS[type];
}

// ============================================
// 비용 비교
// ============================================

export interface ProviderCostComparison {
  provider: ProviderType;
  displayName: string;
  tier: ModelTier;
  inputCostPer1M: number;
  outputCostPer1M: number;
  /** 예상 비용 (1000 입력 토큰, 500 출력 토큰 기준) */
  estimatedCostPer1kIO: number;
}

/**
 * 모든 Provider의 비용 비교 정보 생성
 *
 * ⚠️ 구현된 Provider만 포함됩니다.
 */
export function getAllProviderCosts(tier: ModelTier): ProviderCostComparison[] {
  // 임시 비용 데이터 (실제 Provider에서 가져오도록 수정 필요)
  const costs: Record<ProviderType, Record<ModelTier, { input: number; output: number }>> = {
    anthropic: {
      fast: { input: 0.25, output: 1.25 },
      standard: { input: 3.0, output: 15.0 },
      advanced: { input: 3.0, output: 15.0 },
    },
    openai: {
      fast: { input: 0.15, output: 0.6 }, // GPT-4o-mini
      standard: { input: 2.5, output: 10.0 }, // GPT-4o
      advanced: { input: 10.0, output: 30.0 }, // GPT-4 Turbo
    },
    gemini: {
      fast: { input: 0.075, output: 0.3 }, // Gemini 1.5 Flash
      standard: { input: 1.25, output: 5.0 }, // Gemini 1.5 Pro
      advanced: { input: 1.25, output: 5.0 }, // Gemini 1.5 Pro (same)
    },
  };

  return getImplementedProviders().map((provider) => {
    const config = PROVIDER_CONFIGS[provider];
    const tierCost = costs[provider][tier];
    const estimatedCost = (tierCost.input * 1000 + tierCost.output * 500) / 1_000_000;

    return {
      provider,
      displayName: config.displayName,
      tier,
      inputCostPer1M: tierCost.input,
      outputCostPer1M: tierCost.output,
      estimatedCostPer1kIO: estimatedCost,
    };
  });
}

// ============================================
// 유틸리티
// ============================================

/**
 * Provider API 키 존재 여부 확인
 */
export function hasApiKey(type: ProviderType): boolean {
  const config = PROVIDER_CONFIGS[type];
  return !!process.env[config.apiKeyEnvVar];
}

/**
 * 사용 가능한 Provider 목록 (API 키가 설정된 것만)
 */
export function getAvailableProviders(): ProviderType[] {
  return getImplementedProviders().filter((type) => hasApiKey(type));
}
