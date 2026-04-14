/**
 * AI SDK v6 래퍼
 *
 * Vercel AI SDK v6를 사용한 LLM 호출 래퍼입니다.
 * 기존 GeminiRateLimiter + GeminiQuotaTracker를 유지합니다.
 *
 * @example
 * ```typescript
 * // 텍스트 생성 (기존 provider.createMessage 대체)
 * const result = await generateTextWithRateLimit({
 *   system: SYSTEM_PROMPT,
 *   messages: [{ role: "user", content: userPrompt }],
 *   modelTier: "fast",
 *   temperature: 0.3,
 *   maxTokens: 2000,
 * });
 *
 * // 구조화 출력 (기존 createMessage + extractJSON 대체)
 * const result = await generateObjectWithRateLimit({
 *   system: SYSTEM_PROMPT,
 *   messages: [{ role: "user", content: userPrompt }],
 *   modelTier: "fast",
 *   schema: z.object({ items: z.array(z.string()) }),
 * });
 * ```
 *
 * ## 개발용 LLM Cache (record/replay)
 *
 * 파이프라인 흐름만 점검하고 싶을 때(= LLM 품질과 무관) 실제 API 호출을 건너뛸 수 있다.
 * `LLM_CACHE_MODE` 환경변수로 동작을 전환:
 *
 * - `off` (기본): 기존 동작 그대로, 캐시 관여 없음
 * - `record`: 실제 LLM 호출 후 응답을 `.llm-cache/{hash}.json`에 저장
 * - `replay`: 캐시에서만 반환, 미스 시 LlmCacheMissError throw
 *
 * ## 개발용 Tier Override (dev-only)
 *
 * `LLM_TIER_OVERRIDE` 환경변수로 모든 요청의 modelTier를 전역 override.
 * Pro(thinking) 호출을 Flash로 내려 첫 record 실행 시간을 대폭 단축.
 * 상세 설명은 `resolveEffectiveTier()` 주석 참조.
 *
 * ```bash
 * # 흐름 점검: Pro → Flash 강제 + 캐시 record (가장 빠른 첫 실행)
 * LLM_TIER_OVERRIDE=fast LLM_CACHE_MODE=record pnpm dev
 *
 * # 이후 개발 루프: 초 단위 replay (같은 override 세트 유지 필수)
 * LLM_TIER_OVERRIDE=fast LLM_CACHE_MODE=replay pnpm dev
 * ```
 *
 * ⚠ 두 환경변수 모두 **프로덕션 금지** — `.env.local` 또는 쉘 세션에서만 사용.
 *
 * 상세: `lib/domains/plan/llm/llm-cache.ts`, `resolveEffectiveTier()`
 */

import { generateText, generateObject, streamText, APICallError } from "ai";
import { google } from "@ai-sdk/google";
import { openai, createOpenAI } from "@ai-sdk/openai";
import type { Schema, LanguageModel } from "ai";
import type { ModelTier } from "./types";
import type {
  GroundingConfig,
  GroundingMetadata,
  WebSearchResult,
} from "./providers/base";
import { geminiRateLimiter, geminiQuotaTracker } from "./providers/gemini";
import { logActionDebug, logActionWarn } from "@/lib/utils/serverActionLogger";
import {
  getLlmCacheMode,
  hashCacheKey,
  readFromCache,
  writeToCache,
  getSchemaSignature,
  lastUserMessage,
  LlmCacheMissError,
} from "./llm-cache";

// ============================================
// LLM Provider 추상화 (Google Gemini / OpenAI)
// ============================================
//
// 기본 provider는 Gemini(google). `LLM_PROVIDER_OVERRIDE=openai` 환경변수로
// 로컬 dev에서만 OpenAI로 전환 가능. 프로덕션 금지(아래 resolveEffectiveProvider 참조).
//
// fast: 배치 분석, 태그/전략 제안 등 경량 태스크
// standard: 종합 진단, 세특 방향, 활동 요약 등 다중 입력 합성
// advanced: 세특 심층 분석 (단일 레코드, 루브릭 채점)
// ⚠ fast/standard 현재 동일 모델 — standard 전용 모델 출시 시 분리

export type LlmProvider = "gemini" | "openai" | "ollama";

/** Ollama 로컬 모델 ID — dev에서 `LLM_OLLAMA_MODEL` env로 오버라이드 가능 (기본: gemma4:latest) */
const OLLAMA_MODEL = process.env.LLM_OLLAMA_MODEL || "gemma4:latest";

const MODEL_ID_MAP: Record<LlmProvider, Record<ModelTier, string>> = {
  gemini: {
    fast: "gemini-2.5-flash",
    standard: "gemini-2.5-flash",
    advanced: "gemini-2.5-pro",
  },
  openai: {
    fast: "gpt-4o-mini",
    standard: "gpt-4o-mini",
    advanced: "gpt-4o",
  },
  // Ollama: 로컬에 설치된 단일 모델을 모든 tier에 매핑 (현재 gemma4 단일 자원).
  // 필요시 LLM_OLLAMA_MODEL로 다른 모델로 교체.
  ollama: {
    fast: OLLAMA_MODEL,
    standard: OLLAMA_MODEL,
    advanced: OLLAMA_MODEL,
  },
};

// 과부하(503) 시 순차적으로 다음 모델 시도
const MODEL_FALLBACK_CHAIN: Record<LlmProvider, Record<ModelTier, string[]>> = {
  gemini: {
    fast: ["gemini-2.5-flash"],
    standard: ["gemini-2.5-flash"],
    advanced: [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
    ],
  },
  openai: {
    fast: ["gpt-4o-mini"],
    standard: ["gpt-4o-mini"],
    advanced: ["gpt-4o", "gpt-4o-mini"],
  },
  ollama: {
    fast: [OLLAMA_MODEL],
    standard: [OLLAMA_MODEL],
    advanced: [OLLAMA_MODEL],
  },
};

const DEFAULT_MAX_TOKENS: Record<ModelTier, number> = {
  fast: 4096,
  standard: 8192,
  advanced: 16384,
};

/**
 * provider 별 completion token 상한.
 * 호출부가 설정한 maxTokens 가 이 값을 넘으면 자동으로 clamp 한다.
 *
 * - OpenAI: gpt-4o/gpt-4o-mini 전부 16384 완성 토큰 제한 (2026-04 기준)
 * - Gemini: 2.5 계열은 65k+ 지원 → 상한 없음
 * - Ollama: 모델별 편차 크지만 보수적으로 32768
 */
const PROVIDER_MAX_TOKENS: Record<LlmProvider, number | null> = {
  openai: 16384,
  gemini: null,
  ollama: 32768,
};

/**
 * 호출부 maxTokens 를 provider 상한으로 clamp.
 * Gemini 기준(32768 등)으로 짠 코드를 OpenAI dev override 에서 재사용할 때 필요.
 */
function clampMaxTokens(provider: LlmProvider, requested: number): number {
  const cap = PROVIDER_MAX_TOKENS[provider];
  if (cap == null || requested <= cap) return requested;
  logActionDebug(
    "ai-sdk.clampMaxTokens",
    `maxTokens clamp: ${requested} → ${cap} (provider=${provider})`,
  );
  return cap;
}

const DEFAULT_TEMPERATURE: Record<ModelTier, number> = {
  fast: 0.3,
  standard: 0.5,
  advanced: 0.7,
};

// ============================================
// LLM Tier Override — 개발 전용 (env: LLM_TIER_OVERRIDE)
// ============================================
//
// 파이프라인 흐름 점검 시 `advanced`(Gemini 2.5 Pro, thinking)를 피하고
// 가장 빠르고 낮은 프로덕션 모델(`fast` = gemini-2.5-flash, thinking off)로
// 전체를 강제 통일시키는 개발용 스위치.
//
// 동기:
//  - Pro는 thinking budget 때문에 호출당 10~30초 — 캐시 첫 record가 너무 느림
//  - 흐름 점검(배관/전달/분기)에는 Flash 품질만으로 충분
//  - `analyzeWithHighlight.ts` 단 1곳에서 advanced를 쓰지만 파이프라인 전체 시간을 좌우
//
// 동작:
//  - 미설정 (기본)       → 각 액션이 요청한 tier 그대로 (= 프로덕션 동작)
//  - LLM_TIER_OVERRIDE=fast     → 모든 요청을 fast tier로 강제 (gemini-2.5-flash, thinking off)
//  - LLM_TIER_OVERRIDE=standard → 모든 요청을 standard tier로 강제 (gemini-2.5-flash, thinking off)
//  - LLM_TIER_OVERRIDE=advanced → 모든 요청을 advanced tier로 강제 (디버깅/비교용)
//
// ⚠ 프로덕션 금지:
//   Vercel/실배포에서 이 변수를 설정하면 분석 품질이 떨어집니다.
//   로컬 `.env.local` 또는 쉘 세션에서만 사용하세요.
//   활성화되면 첫 호출에 경고 로그가 한 번 찍힙니다.
//
// 캐시 레이어(`llm-cache.ts`)와의 상호작용:
//   캐시 키에 `modelTier`가 포함됩니다. 즉 override 상태가 다르면 다른 캐시 버킷이 되어,
//   `LLM_CACHE_MODE=record`와 `replay`는 **같은 override 세트**로 묶어 실행해야 합니다.
//   예: `LLM_TIER_OVERRIDE=fast LLM_CACHE_MODE=record pnpm dev`
//      → `LLM_TIER_OVERRIDE=fast LLM_CACHE_MODE=replay pnpm dev`

let _loggedTierOverride = false;

function resolveEffectiveTier(requested: ModelTier): ModelTier {
  const raw = process.env.LLM_TIER_OVERRIDE?.toLowerCase();
  if (raw !== "fast" && raw !== "standard" && raw !== "advanced") {
    return requested;
  }
  if (!_loggedTierOverride) {
    _loggedTierOverride = true;
    logActionWarn(
      "ai-sdk.tierOverride",
      `[DEV] LLM_TIER_OVERRIDE=${raw} 활성 — 모든 LLM 요청이 ${raw} tier로 강제됩니다. 프로덕션에서 설정 금지.`,
    );
  }
  return raw as ModelTier;
}

// ============================================
// LLM Provider Override — 개발 전용 (env: LLM_PROVIDER_OVERRIDE)
// ============================================
//
// 파이프라인 코드가 OpenAI에서도 동작하는지 확인하거나, Gemini API key
// 없이 작업할 때 OpenAI로 임시 전환하는 dev-only 스위치.
//
// 동작:
//  - 미설정 (기본)              → "gemini" (= 프로덕션 동작)
//  - LLM_PROVIDER_OVERRIDE=openai → 모든 LLM 요청을 OpenAI로 라우팅
//
// ⚠ 프로덕션 금지:
//   Vercel/실배포에서 절대 설정하지 말 것. `OPENAI_API_KEY`도 로컬
//   `.env.local`에만 두고 Vercel env에는 추가하지 말 것.
//   활성화되면 첫 호출에 경고 로그가 한 번 찍힙니다.
//
// 가드:
//   - OPENAI_API_KEY가 없으면 자동으로 gemini로 fallback (경고 1회)
//   - google_search grounding 요청은 OpenAI에서 자동 무시 (경고 1회)
//   - geminiRateLimiter / geminiQuotaTracker는 OpenAI 경로에서 바이패스
//
// 캐시 레이어(`llm-cache.ts`)와의 상호작용:
//   캐시 키에 `provider`가 포함됩니다. Gemini/OpenAI 캐시가 분리되므로
//   `LLM_CACHE_MODE=record`/`replay`는 같은 provider 세트로 묶어 실행해야 합니다.

let _loggedProviderOverride = false;
let _warnedOpenAiGrounding = false;

function resolveEffectiveProvider(): LlmProvider {
  const raw = process.env.LLM_PROVIDER_OVERRIDE?.toLowerCase();
  if (raw === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      if (!_loggedProviderOverride) {
        _loggedProviderOverride = true;
        logActionWarn(
          "ai-sdk.providerOverride",
          `[DEV] LLM_PROVIDER_OVERRIDE=openai 설정되었으나 OPENAI_API_KEY가 없습니다. gemini로 fallback합니다.`,
        );
      }
      return "gemini";
    }
    if (!_loggedProviderOverride) {
      _loggedProviderOverride = true;
      logActionWarn(
        "ai-sdk.providerOverride",
        `[DEV] LLM_PROVIDER_OVERRIDE=openai 활성 — 모든 LLM 요청이 OpenAI로 라우팅됩니다. 프로덕션 금지.`,
      );
    }
    return "openai";
  }
  if (raw === "ollama" || raw === "gemma") {
    if (!_loggedProviderOverride) {
      _loggedProviderOverride = true;
      logActionWarn(
        "ai-sdk.providerOverride",
        `[DEV] LLM_PROVIDER_OVERRIDE=${raw} 활성 — 모든 LLM 요청이 Ollama(local ${OLLAMA_MODEL})로 라우팅됩니다. 프로덕션 금지.`,
      );
    }
    return "ollama";
  }
  return "gemini";
}

// ============================================
// LLM Model Override — eval 전용 (env: LLM_MODEL_OVERRIDE)
// ============================================
//
// advanced tier 모델 ID를 환경변수로 직접 지정. MODEL_ID_MAP 변경 없이
// 특정 모델(gemini-3.1-pro-preview, gpt-5.4 등)을 eval 스크립트에서 테스트할 때 사용.
//
//   LLM_MODEL_OVERRIDE=gemini-3.1-pro-preview  → Gemini 3.1 Pro
//   LLM_MODEL_OVERRIDE=gpt-5.4                 → GPT-5.4
//
// advanced tier에만 적용. fast/standard는 기존 매핑 유지.
// ⚠ 프로덕션 금지 — 로컬 eval 전용.

/** advanced tier 호출 시 사용할 모델 ID override (eval 전용) */
const LLM_MODEL_OVERRIDE = process.env.LLM_MODEL_OVERRIDE;

/**
 * fallback chain 해소.
 * advanced + LLM_MODEL_OVERRIDE 설정 시 단일 원소 체인 반환 (override 모델만).
 */
function resolveFallbackChain(provider: LlmProvider, tier: ModelTier): string[] {
  if (tier === "advanced" && LLM_MODEL_OVERRIDE) {
    return [LLM_MODEL_OVERRIDE];
  }
  return MODEL_FALLBACK_CHAIN[provider][tier];
}

/** Ollama는 OpenAI-compatible endpoint 제공 → createOpenAI로 baseURL만 교체 */
const ollamaClient = createOpenAI({
  baseURL: process.env.LLM_OLLAMA_BASE_URL || "http://localhost:11434/v1",
  apiKey: "ollama", // Ollama는 인증 요구 안 하지만 SDK 검증 통과를 위해 placeholder
});

/** provider + modelId → AI SDK LanguageModel 인스턴스 */
function getLanguageModel(provider: LlmProvider, modelId: string): LanguageModel {
  if (provider === "openai") {
    // 트랙 D (2026-04-14): Chat Completions API 사용 (Responses API는 strict schema를 강제).
    //   non-strict 모드는 generateObject 호출 시 providerOptions로 전달한다
    //   (buildProviderOptions 참조 — strictJsonSchema: false).
    return openai.chat(modelId);
  }
  if (provider === "ollama") {
    return ollamaClient(modelId);
  }
  return google(modelId);
}

/**
 * Gemini 전용 rate limiter 가드
 *
 * gemini provider일 때만 `geminiRateLimiter`를 통해 실행. OpenAI는 별도
 * 큐 없이 직접 실행 (개발용이라 throughput 제어 불필요).
 */
async function executeWithProviderGuards<T>(
  provider: LlmProvider,
  fn: () => Promise<T>,
): Promise<T> {
  // gemini만 rate limiter/quota tracker를 거친다. openai/ollama는 직통.
  if (provider !== "gemini") {
    return fn();
  }
  return geminiRateLimiter.execute(fn);
}

/**
 * providerOptions 빌더
 *
 * Gemini: thinking budget
 *   - LLM_GEMINI_THINKING_BUDGET env로 override 가능 (eval 전용)
 *   - 기본: advanced=1024, 그 외=0
 *   - 예: LLM_GEMINI_THINKING_BUDGET=2048 (MEDIUM 수준)
 *
 * OpenAI: reasoning effort (GPT-5.4 등 reasoning 모델용)
 *   - LLM_OPENAI_REASONING_EFFORT env로 설정 (none/low/medium/high/xhigh)
 *   - 미설정 시 providerOptions 없음 (기존 GPT-4o 동작 유지)
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function buildProviderOptions(provider: LlmProvider, tier: ModelTier) {
  if (provider === "gemini") {
    const budgetEnv = process.env.LLM_GEMINI_THINKING_BUDGET;
    const thinkingBudget = budgetEnv
      ? parseInt(budgetEnv, 10)
      : tier === "advanced"
        ? 1024
        : 0;
    return {
      google: {
        thinkingConfig: { thinkingBudget },
      },
    };
  }
  if (provider === "openai") {
    // 트랙 D (2026-04-14): OpenAI @ai-sdk v3 는 기본 strictJsonSchema=true.
    //   strict 모드는 `.optional()` zod 필드를 거부하므로 false로 강제.
    //   reasoningEffort는 옵션일 때만 추가.
    const effort = process.env.LLM_OPENAI_REASONING_EFFORT;
    const openaiOpts: Record<string, unknown> = { strictJsonSchema: false };
    if (effort) openaiOpts.reasoningEffort = effort;
    return { openai: openaiOpts };
  }
  return undefined;
}

/** Grounding 도구 빌더 — Gemini만 google_search 지원, 그 외 provider는 비활성화 + 경고 */
function buildGroundingTools(provider: LlmProvider, grounding?: GroundingConfig) {
  if (!grounding?.enabled) return undefined;
  if (provider !== "gemini") {
    if (!_warnedOpenAiGrounding) {
      _warnedOpenAiGrounding = true;
      logActionWarn(
        "ai-sdk.grounding",
        `[DEV] LLM_PROVIDER_OVERRIDE=${provider}에서는 google_search grounding을 지원하지 않습니다. grounding 비활성 상태로 호출합니다.`,
      );
    }
    return undefined;
  }
  return { google_search: google.tools.googleSearch({}) };
}

// ============================================
// 공통 타입
// ============================================

export interface AiSdkOptions {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  modelTier?: ModelTier;
  maxTokens?: number;
  temperature?: number;
  grounding?: GroundingConfig;
  /** "json" 설정 시 Gemini JSON 모드 강제 — 유효한 JSON 출력 보장 */
  responseFormat?: "json" | "text";
  /** 모델별 타임아웃 (ms). 각 모델이 독립적으로 이 시간만큼 사용 */
  timeoutMs?: number;
  /** 폴백 체인에서 시작할 모델 인덱스 (체이닝 재시도 시 이미 시도한 모델 건너뛰기) */
  modelStartIndex?: number;
}

export interface AiSdkResult {
  content: string;
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  modelId: string;
  provider: LlmProvider;
  groundingMetadata?: GroundingMetadata;
}

export interface AiSdkStreamOptions extends AiSdkOptions {
  onText?: (text: string) => void;
  onComplete?: (result: AiSdkResult) => void;
  onError?: (error: Error) => void;
}

// ============================================
// P3-1: Circuit Breaker — 연속 실패 시 빠른 차단
// ============================================

interface CircuitState {
  failures: number;
  lastFailure: number;
  state: "closed" | "open" | "half-open";
}

const circuitBreakers = new Map<string, CircuitState>();
const CB_THRESHOLD = 5; // 연속 N회 실패 시 OPEN
const CB_COOLDOWN_MS = 30_000; // OPEN 후 30초 대기

function getCircuit(key: string): CircuitState {
  if (!circuitBreakers.has(key)) {
    circuitBreakers.set(key, { failures: 0, lastFailure: 0, state: "closed" });
  }
  return circuitBreakers.get(key)!;
}

/** Circuit Breaker 체크 — OPEN 상태면 skip (throw 대신 false 반환) */
function isCircuitOpen(modelId: string): boolean {
  const circuit = getCircuit(modelId);
  if (circuit.state === "closed") return false;

  const elapsed = Date.now() - circuit.lastFailure;
  if (elapsed >= CB_COOLDOWN_MS) {
    circuit.state = "half-open";
    return false;
  }

  return true;
}

function recordCircuitSuccess(modelId: string): void {
  const circuit = getCircuit(modelId);
  circuit.failures = 0;
  circuit.state = "closed";
}

function recordCircuitFailure(modelId: string): void {
  const circuit = getCircuit(modelId);
  circuit.failures++;
  circuit.lastFailure = Date.now();
  if (circuit.failures >= CB_THRESHOLD) {
    circuit.state = "open";
    logActionWarn("ai-sdk.circuitBreaker", `${modelId} OPEN — ${circuit.failures}회 연속 실패, ${CB_COOLDOWN_MS / 1000}초 차단`);
  }
}

// ============================================
// Rate Limit 에러 감지 — 구조적 방식 우선, 문자열 fallback
// ============================================

export function isRateLimitError(error: unknown): boolean {
  // 1) AI SDK APICallError — statusCode로 직접 판별 (가장 신뢰도 높음)
  if (APICallError.isInstance(error)) {
    return error.statusCode === 429;
  }

  // 2) Google SDK GoogleGenerativeAIFetchError — status 필드 확인
  if (error instanceof Error && "status" in error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 429) return true;
  }

  // 3) Fallback: 문자열 매칭 (에러가 래핑되어 status가 유실된 경우)
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("429") ||
      msg.includes("quota") ||
      msg.includes("rate limit") ||
      msg.includes("too many requests") ||
      msg.includes("resource_exhausted")
    );
  }

  return false;
}

/** 서버 과부하 에러 감지 (503 / high demand) — 폴백 모델 전환 트리거 */
export function isOverloadError(error: unknown): boolean {
  // 1) AI SDK APICallError — statusCode 503
  if (APICallError.isInstance(error)) {
    return error.statusCode === 503;
  }

  // 2) 래핑된 에러 — status 필드
  if (error instanceof Error && "status" in error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 503) return true;
  }

  // 3) 문자열 매칭 (AI_RetryError 래핑 등)
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("high demand") || msg.includes("overloaded");
  }

  return false;
}

/** 네트워크/연결 타임아웃 에러 감지 — 폴백 모델 전환 트리거 */
export function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("cannot connect to api") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("fetch failed")
  );
}

/** 폴백 가능한 일시적 에러인지 판별 (rate limit / overload / timeout) */
export function isRetryableError(error: unknown): boolean {
  return isRateLimitError(error) || isOverloadError(error) || isTimeoutError(error);
}

function extractRetryDelay(error: unknown, attempt: number): number {
  const baseDelay = 1000;
  const maxDelay = 60000;
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

  // 1) AI SDK APICallError — responseHeaders에서 Retry-After 추출
  if (APICallError.isInstance(error) && error.responseHeaders) {
    const retryAfter = error.responseHeaders["retry-after"];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return Math.min(seconds * 1000, maxDelay);
      }
    }
  }

  // 2) Fallback: 에러 메시지에서 retry 시간 추출
  if (error instanceof Error) {
    const retryMatch = error.message.match(
      /retry\s*(?:after|in)\s*(\d+)\s*(?:s|sec|seconds?)/i
    );
    if (retryMatch) {
      return Math.min(parseInt(retryMatch[1], 10) * 1000, maxDelay);
    }
    const waitMatch = error.message.match(
      /wait\s*(\d+)\s*(?:s|sec|seconds?)/i
    );
    if (waitMatch) {
      return Math.min(parseInt(waitMatch[1], 10) * 1000, maxDelay);
    }
  }

  const jitter = Math.random() * 500;
  return exponentialDelay + jitter;
}

// ============================================
// Grounding 메타데이터 추출
// ============================================

function extractGroundingFromSources(
  result: { sources?: Array<{ sourceType?: string; url?: string; title?: string; snippet?: string }> }
): GroundingMetadata | undefined {
  // AI SDK의 sources 필드에서 grounding 정보 추출
  const sources = result.sources;
  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return undefined;
  }

  const webResults: WebSearchResult[] = sources
    .filter(
      (s: { sourceType?: string }) =>
        s.sourceType === "url" || s.sourceType === "google-search"
    )
    .map((s: { url?: string; title?: string; snippet?: string }) => ({
      url: s.url ?? "",
      title: s.title ?? "",
      snippet: s.snippet ?? "",
    }));

  if (webResults.length === 0) return undefined;

  return {
    searchQueries: [],
    webResults,
  };
}

// ============================================
// JSON Mode output (Gemini responseMimeType 강제)
// ============================================

/**
 * generateText의 output 파라미터로 전달하여 Gemini JSON 모드를 활성화.
 * AI SDK 내장 json() output과 달리, 파싱 실패 시 throw하지 않고
 * 텍스트를 그대로 반환하여 extractJson의 fallback 로직을 사용할 수 있게 함.
 */
// AI SDK output adapter for Gemini JSON mode - typed as unknown to avoid Output<T> generic
const jsonModeOutput: unknown = {
  name: "json-mode",
  responseFormat: Promise.resolve({ type: "json" as const }),
  async parseCompleteOutput({ text }: { text: string }) {
    return text;
  },
  async parsePartialOutput({ text }: { text: string }) {
    return { partial: text };
  },
  createElementStreamTransform() {
    return new TransformStream();
  },
};

// ============================================
// generateTextWithRateLimit
// ============================================

/**
 * AI SDK generateText with Rate Limiting + Quota Tracking
 *
 * 기존 `getGeminiProvider().createMessage()` 대체
 */
export async function generateTextWithRateLimit(
  options: AiSdkOptions
): Promise<AiSdkResult> {
  const provider = resolveEffectiveProvider();
  const tier = resolveEffectiveTier(options.modelTier ?? "standard");

  // ── LLM Cache Layer (dev-only, env gated) ────────────
  const cacheMode = getLlmCacheMode();
  const cacheHash =
    cacheMode !== "off"
      ? hashCacheKey({
          system: options.system,
          messages: options.messages,
          provider,
          modelTier: tier,
          kind: "text",
          responseFormat: options.responseFormat,
          groundingEnabled: options.grounding?.enabled,
        })
      : null;
  if (cacheMode === "replay" && cacheHash) {
    const cached = await readFromCache<AiSdkResult>(cacheHash);
    if (cached) {
      logActionDebug(
        "ai-sdk.generateText",
        `[cache hit] ${cacheHash.slice(0, 12)}... provider=${provider} tier=${tier}`,
      );
      return cached;
    }
    throw new LlmCacheMissError(cacheHash, "text");
  }
  // ──────────────────────────────────────────────────────

  const fallbackChain = resolveFallbackChain(provider, tier);
  const maxTokens = clampMaxTokens(provider, options.maxTokens ?? DEFAULT_MAX_TOKENS[tier]);
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE[tier];
  const maxRetries = 1; // 서버리스 환경: 재시도 1회로 제한
  const abortSignal = options.timeoutMs
    ? AbortSignal.timeout(options.timeoutMs)
    : undefined;

  // provider별 옵션
  const tools = buildGroundingTools(provider, options.grounding);
  const providerOptions = buildProviderOptions(provider, tier);
  // Gemini JSON 모드는 google 전용 (responseMimeType 사용)
  const useJsonOutput = provider === "gemini" && options.responseFormat === "json";

  let lastError: Error | null = null;

  for (const currentModelId of fallbackChain) {
    if (isCircuitOpen(currentModelId)) {
      logActionDebug("ai-sdk.generateText", `${currentModelId} circuit open, skip`);
      continue;
    }

    logActionDebug(
      "ai-sdk.generateText",
      `시작 - provider=${provider} model=${currentModelId} tier=${tier} grounding=${options.grounding?.enabled}`
    );

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logActionDebug(
            "ai-sdk.generateText",
            `재시도 ${attempt}/${maxRetries}`
          );
        }

        const result = await executeWithProviderGuards(provider, async () => {
          return generateText({
            model: getLanguageModel(provider, currentModelId),
            system: options.system,
            messages: options.messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            maxOutputTokens: maxTokens,
            temperature,
            maxRetries: 1,
            ...(abortSignal ? { abortSignal } : {}),
            ...(tools && { tools }),
            ...(useJsonOutput && {
              output: jsonModeOutput as never,
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(providerOptions && { providerOptions: providerOptions as any }),
          });
        });

        if (provider === "gemini") {
          geminiQuotaTracker.recordRequest();
        }
        recordCircuitSuccess(currentModelId);

        const groundingMetadata = options.grounding?.enabled
          ? extractGroundingFromSources(result)
          : undefined;

        const aiSdkResult: AiSdkResult = {
          content: result.text,
          stopReason: result.finishReason ?? null,
          usage: {
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
          },
          modelId: currentModelId,
          provider,
          groundingMetadata,
        };

        if (cacheMode === "record" && cacheHash) {
          await writeToCache(
            cacheHash,
            {
              provider,
              modelTier: tier,
              kind: "text",
              systemHead: options.system,
              lastUserHead: lastUserMessage(options.messages),
            },
            aiSdkResult,
          );
          logActionDebug(
            "ai-sdk.generateText",
            `[cache recorded] ${cacheHash.slice(0, 12)}... provider=${provider} tier=${tier}`,
          );
        }

        return aiSdkResult;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 429 Rate Limit → 같은 모델 재시도
        if (isRateLimitError(error) && attempt < maxRetries) {
          if (provider === "gemini") {
            geminiQuotaTracker.recordRateLimitHit();
          }
          recordCircuitFailure(currentModelId);
          const delay = extractRetryDelay(error, attempt);
          logActionWarn(
            "ai-sdk.generateText",
            `Rate limit. ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // 과부하 또는 타임아웃 → 다음 폴백 모델로 전환
        if (isOverloadError(error) || isTimeoutError(error)) {
          const errDetail = formatLlmErrorDetail(error);
          logActionWarn(
            "ai-sdk.generateText",
            `${currentModelId} ${isTimeoutError(error) ? "타임아웃" : "과부하"} → 다음 모델로 전환 | ${errDetail}`
          );
          recordCircuitFailure(currentModelId);
          break;
        }

        recordCircuitFailure(currentModelId);
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("[AI SDK] generateText 모든 모델 실패");
}

/**
 * LLM 에러의 구조적 정보를 한 줄로 요약.
 * isOverload/isTimeout/isRateLimit 판정이 실제로 어떤 응답에 근거했는지 디버깅하기 위해 사용.
 */
function formatLlmErrorDetail(error: unknown): string {
  if (APICallError.isInstance(error)) {
    const msg = error.message.slice(0, 300).replace(/\s+/g, " ");
    return `APICallError status=${error.statusCode} msg="${msg}"`;
  }
  if (error instanceof Error) {
    const status = "status" in error ? (error as Error & { status?: unknown }).status : undefined;
    const name = error.name;
    const msg = error.message.slice(0, 300).replace(/\s+/g, " ");
    return `${name}${status !== undefined ? ` status=${String(status)}` : ""} msg="${msg}"`;
  }
  return `unknown error: ${String(error).slice(0, 300)}`;
}

// ============================================
// generateObjectWithRateLimit
// ============================================

/**
 * AI SDK generateObject with Rate Limiting + Quota Tracking
 *
 * 기존 `provider.createMessage()` + `extractJSON()` 대체
 * Zod 스키마로 구조화 출력을 보장합니다.
 */
export async function generateObjectWithRateLimit<T>(
  options: AiSdkOptions & { schema: Schema<T> }
): Promise<{
  object: T;
  usage: { inputTokens: number; outputTokens: number };
  modelId: string;
}> {
  const provider = resolveEffectiveProvider();
  const tier = resolveEffectiveTier(options.modelTier ?? "standard");

  // ── LLM Cache Layer (dev-only, env gated) ────────────
  type ObjectResult = {
    object: T;
    usage: { inputTokens: number; outputTokens: number };
    modelId: string;
  };
  const cacheMode = getLlmCacheMode();
  const cacheHash =
    cacheMode !== "off"
      ? hashCacheKey({
          system: options.system,
          messages: options.messages,
          provider,
          modelTier: tier,
          kind: "object",
          schemaSignature: getSchemaSignature(options.schema),
          groundingEnabled: options.grounding?.enabled,
        })
      : null;
  if (cacheMode === "replay" && cacheHash) {
    const cached = await readFromCache<ObjectResult>(cacheHash);
    if (cached) {
      logActionDebug(
        "ai-sdk.generateObject",
        `[cache hit] ${cacheHash.slice(0, 12)}... provider=${provider} tier=${tier}`,
      );
      return cached;
    }
    throw new LlmCacheMissError(cacheHash, "object");
  }
  // ──────────────────────────────────────────────────────

  const fallbackChain = resolveFallbackChain(provider, tier);
  const maxTokens = clampMaxTokens(provider, options.maxTokens ?? DEFAULT_MAX_TOKENS[tier]);
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE[tier];
  const maxRetries = 1;
  // 시도할 모델 범위 (체이닝 재시도 시 이미 시도한 모델 건너뛰기용)
  const startIndex = options.modelStartIndex ?? 0;
  const providerOptions = buildProviderOptions(provider, tier);

  let lastError: Error | null = null;

  for (let i = startIndex; i < fallbackChain.length; i++) {
    const currentModelId = fallbackChain[i];
    if (isCircuitOpen(currentModelId)) {
      logActionDebug("ai-sdk.generateObject", `${currentModelId} circuit open, skip`);
      continue;
    }

    // 모델마다 독립 AbortSignal — 각 모델이 전체 타임아웃을 사용
    const abortSignal = options.timeoutMs
      ? AbortSignal.timeout(options.timeoutMs)
      : undefined;

    logActionDebug(
      "ai-sdk.generateObject",
      `시작 - provider=${provider} model=${currentModelId} tier=${tier}`
    );

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logActionDebug(
            "ai-sdk.generateObject",
            `재시도 ${attempt}/${maxRetries}`
          );
        }

        const result = await executeWithProviderGuards(provider, async () => {
          return generateObject({
            model: getLanguageModel(provider, currentModelId),
            mode: "json",
            system: options.system,
            messages: options.messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            schema: options.schema,
            maxOutputTokens: maxTokens,
            temperature,
            maxRetries: 1,
            ...(abortSignal ? { abortSignal } : {}),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(providerOptions && { providerOptions: providerOptions as any }),
          });
        });

        if (provider === "gemini") {
          geminiQuotaTracker.recordRequest();
        }
        recordCircuitSuccess(currentModelId);

        const objectResult: ObjectResult = {
          object: result.object,
          usage: {
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
          },
          modelId: currentModelId,
        };

        if (cacheMode === "record" && cacheHash) {
          await writeToCache(
            cacheHash,
            {
              provider,
              modelTier: tier,
              kind: "object",
              systemHead: options.system,
              lastUserHead: lastUserMessage(options.messages),
            },
            objectResult,
          );
          logActionDebug(
            "ai-sdk.generateObject",
            `[cache recorded] ${cacheHash.slice(0, 12)}... provider=${provider} tier=${tier}`,
          );
        }

        return objectResult;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (isRateLimitError(error) && attempt < maxRetries) {
          if (provider === "gemini") {
            geminiQuotaTracker.recordRateLimitHit();
          }
          recordCircuitFailure(currentModelId);
          const delay = extractRetryDelay(error, attempt);
          logActionWarn(
            "ai-sdk.generateObject",
            `Rate limit. ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // 과부하 → 다음 모델로 전환 (빠른 실패, 같은 함수 내에서 재시도 가치 있음)
        if (isOverloadError(error)) {
          logActionWarn(
            "ai-sdk.generateObject",
            `${currentModelId} 과부하 → 다음 모델로 전환 | ${formatLlmErrorDetail(error)}`
          );
          recordCircuitFailure(currentModelId);
          break;
        }

        // 타임아웃 → 즉시 throw (함수 시간 소진, 같은 함수 내 재시도 무의미)
        if (isTimeoutError(error)) {
          logActionWarn(
            "ai-sdk.generateObject",
            `${currentModelId} 타임아웃 → 함수 종료 (modelIndex=${i})`
          );
          recordCircuitFailure(currentModelId);
          const timeoutErr = new Error(`[AI SDK] ${currentModelId} 타임아웃 (modelIndex=${i})`);
          (timeoutErr as Error & { modelIndex: number }).modelIndex = i;
          throw timeoutErr;
        }

        recordCircuitFailure(currentModelId);
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("[AI SDK] generateObject 모든 모델 실패");
}

// ============================================
// streamTextWithRateLimit
// ============================================

/**
 * AI SDK streamText with Rate Limiting + Quota Tracking
 *
 * 기존 `provider.streamMessage()` 대체
 */
export async function streamTextWithRateLimit(
  options: AiSdkStreamOptions
): Promise<AiSdkResult> {
  const provider = resolveEffectiveProvider();
  const tier = resolveEffectiveTier(options.modelTier ?? "standard");
  const fallbackChain = resolveFallbackChain(provider, tier);
  const maxTokens = clampMaxTokens(provider, options.maxTokens ?? DEFAULT_MAX_TOKENS[tier]);
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE[tier];
  const maxRetries = 3;

  const tools = buildGroundingTools(provider, options.grounding);

  let lastError: Error | null = null;

  for (const currentModelId of fallbackChain) {
    if (isCircuitOpen(currentModelId)) {
      logActionDebug("ai-sdk.streamText", `${currentModelId} circuit open, skip`);
      continue;
    }

    logActionDebug(
      "ai-sdk.streamText",
      `시작 - provider=${provider} model=${currentModelId} tier=${tier}`
    );

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logActionDebug(
            "ai-sdk.streamText",
            `재시도 ${attempt}/${maxRetries}`
          );
        }

        const result = await executeWithProviderGuards(provider, async () => {
          return streamText({
            model: getLanguageModel(provider, currentModelId),
            system: options.system,
            messages: options.messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            maxOutputTokens: maxTokens,
            temperature,
            ...(tools && { tools }),
          });
        });

        if (provider === "gemini") {
          geminiQuotaTracker.recordRequest();
        }
        recordCircuitSuccess(currentModelId);

        let fullContent = "";

        for await (const chunk of result.textStream) {
          fullContent += chunk;
          options.onText?.(chunk);
        }

        const usage = await result.usage;

        const aiSdkResult: AiSdkResult = {
          content: fullContent,
          stopReason: (await result.finishReason) ?? null,
          usage: {
            inputTokens: usage?.inputTokens ?? 0,
            outputTokens: usage?.outputTokens ?? 0,
          },
          modelId: currentModelId,
          provider,
        };

        options.onComplete?.(aiSdkResult);
        return aiSdkResult;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (isRateLimitError(error) && attempt < maxRetries) {
          if (provider === "gemini") {
            geminiQuotaTracker.recordRateLimitHit();
          }
          recordCircuitFailure(currentModelId);
          const delay = extractRetryDelay(error, attempt);
          logActionWarn(
            "ai-sdk.streamText",
            `Rate limit. ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (isOverloadError(error)) {
          logActionWarn(
            "ai-sdk.streamText",
            `${currentModelId} 과부하 → 다음 모델로 전환 | ${formatLlmErrorDetail(error)}`
          );
          recordCircuitFailure(currentModelId);
          break;
        }

        recordCircuitFailure(currentModelId);
        options.onError?.(lastError);
        throw lastError;
      }
    }
  }

  const finalError =
    lastError ?? new Error("[AI SDK] streamText 모든 모델 실패");
  options.onError?.(finalError);
  throw finalError;
}

// ============================================
// re-export (하위 호환)
// ============================================

export type { ModelTier } from "./types";
export type { GroundingConfig, GroundingMetadata, WebSearchResult } from "./providers/base";
export { getGeminiQuotaStatus, resetGeminiQuotaTracker } from "./providers/gemini";
