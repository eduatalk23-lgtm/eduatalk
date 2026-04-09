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
import type { Schema } from "ai";
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
// ModelTier → AI SDK 모델 매핑
// fast: 배치 분석, 태그/전략 제안 등 경량 태스크
// standard: 종합 진단, 세특 방향, 활동 요약 등 다중 입력 합성
// advanced: 세특 심층 분석 (단일 레코드, 루브릭 채점)
// ⚠ fast/standard 현재 동일 모델 — standard 전용 모델 출시 시 분리
// ============================================

const MODEL_ID_MAP: Record<ModelTier, string> = {
  fast: "gemini-2.5-flash",
  standard: "gemini-2.5-flash",
  advanced: "gemini-2.5-pro",
};

// 과부하(503) 시 순차적으로 다음 모델 시도
const MODEL_FALLBACK_CHAIN: Record<ModelTier, string[]> = {
  fast: ["gemini-2.5-flash"],
  standard: ["gemini-2.5-flash"],
  advanced: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
  ],
};

const DEFAULT_MAX_TOKENS: Record<ModelTier, number> = {
  fast: 4096,
  standard: 8192,
  advanced: 16384,
};

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
  provider: "gemini";
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
  const tier = resolveEffectiveTier(options.modelTier ?? "standard");

  // ── LLM Cache Layer (dev-only, env gated) ────────────
  const cacheMode = getLlmCacheMode();
  const cacheHash =
    cacheMode !== "off"
      ? hashCacheKey({
          system: options.system,
          messages: options.messages,
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
        `[cache hit] ${cacheHash.slice(0, 12)}... tier=${tier}`,
      );
      return cached;
    }
    throw new LlmCacheMissError(cacheHash, "text");
  }
  // ──────────────────────────────────────────────────────

  const fallbackChain = MODEL_FALLBACK_CHAIN[tier];
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS[tier];
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE[tier];
  const maxRetries = 1; // 서버리스 환경: 재시도 1회로 제한
  const abortSignal = options.timeoutMs
    ? AbortSignal.timeout(options.timeoutMs)
    : undefined;

  // Grounding 도구 설정
  const tools =
    options.grounding?.enabled
      ? { google_search: google.tools.googleSearch({}) }
      : undefined;

  let lastError: Error | null = null;

  for (const currentModelId of fallbackChain) {
    if (isCircuitOpen(currentModelId)) {
      logActionDebug("ai-sdk.generateText", `${currentModelId} circuit open, skip`);
      continue;
    }

    logActionDebug(
      "ai-sdk.generateText",
      `시작 - model=${currentModelId}, tier=${tier}, grounding=${options.grounding?.enabled}`
    );

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logActionDebug(
            "ai-sdk.generateText",
            `재시도 ${attempt}/${maxRetries}`
          );
        }

        const result = await geminiRateLimiter.execute(async () => {
          return generateText({
            model: google(currentModelId),
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
            ...(options.responseFormat === "json" && {
              output: jsonModeOutput,
            }),
            providerOptions: {
              google: {
                thinkingConfig: {
                  thinkingBudget: tier === "advanced" ? 1024 : 0,
                },
              },
            },
          });
        });

        geminiQuotaTracker.recordRequest();
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
          provider: "gemini",
          groundingMetadata,
        };

        if (cacheMode === "record" && cacheHash) {
          await writeToCache(
            cacheHash,
            {
              modelTier: tier,
              kind: "text",
              systemHead: options.system,
              lastUserHead: lastUserMessage(options.messages),
            },
            aiSdkResult,
          );
          logActionDebug(
            "ai-sdk.generateText",
            `[cache recorded] ${cacheHash.slice(0, 12)}... tier=${tier}`,
          );
        }

        return aiSdkResult;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 429 Rate Limit → 같은 모델 재시도
        if (isRateLimitError(error) && attempt < maxRetries) {
          geminiQuotaTracker.recordRateLimitHit();
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
        `[cache hit] ${cacheHash.slice(0, 12)}... tier=${tier}`,
      );
      return cached;
    }
    throw new LlmCacheMissError(cacheHash, "object");
  }
  // ──────────────────────────────────────────────────────

  const fallbackChain = MODEL_FALLBACK_CHAIN[tier];
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS[tier];
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE[tier];
  const maxRetries = 1;
  // 시도할 모델 범위 (체이닝 재시도 시 이미 시도한 모델 건너뛰기용)
  const startIndex = options.modelStartIndex ?? 0;

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
      `시작 - model=${currentModelId}, tier=${tier}`
    );

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logActionDebug(
            "ai-sdk.generateObject",
            `재시도 ${attempt}/${maxRetries}`
          );
        }

        const result = await geminiRateLimiter.execute(async () => {
          return generateObject({
            model: google(currentModelId),
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
            providerOptions: {
              google: {
                thinkingConfig: {
                  thinkingBudget: tier === "advanced" ? 1024 : 0,
                },
              },
            },
          });
        });

        geminiQuotaTracker.recordRequest();
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
              modelTier: tier,
              kind: "object",
              systemHead: options.system,
              lastUserHead: lastUserMessage(options.messages),
            },
            objectResult,
          );
          logActionDebug(
            "ai-sdk.generateObject",
            `[cache recorded] ${cacheHash.slice(0, 12)}... tier=${tier}`,
          );
        }

        return objectResult;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (isRateLimitError(error) && attempt < maxRetries) {
          geminiQuotaTracker.recordRateLimitHit();
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
  const tier = resolveEffectiveTier(options.modelTier ?? "standard");
  const fallbackChain = MODEL_FALLBACK_CHAIN[tier];
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS[tier];
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE[tier];
  const maxRetries = 3;

  const tools =
    options.grounding?.enabled
      ? { google_search: google.tools.googleSearch({}) }
      : undefined;

  let lastError: Error | null = null;

  for (const currentModelId of fallbackChain) {
    if (isCircuitOpen(currentModelId)) {
      logActionDebug("ai-sdk.streamText", `${currentModelId} circuit open, skip`);
      continue;
    }

    logActionDebug(
      "ai-sdk.streamText",
      `시작 - model=${currentModelId}, tier=${tier}`
    );

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logActionDebug(
            "ai-sdk.streamText",
            `재시도 ${attempt}/${maxRetries}`
          );
        }

        const result = await geminiRateLimiter.execute(async () => {
          return streamText({
            model: google(currentModelId),
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

        geminiQuotaTracker.recordRequest();
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
          provider: "gemini",
        };

        options.onComplete?.(aiSdkResult);
        return aiSdkResult;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (isRateLimitError(error) && attempt < maxRetries) {
          geminiQuotaTracker.recordRateLimitHit();
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
