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
  advanced: "gemini-3.1-pro-preview",
};

// 과부하(503) 시 순차적으로 다음 모델 시도
const MODEL_FALLBACK_CHAIN: Record<ModelTier, string[]> = {
  fast: ["gemini-2.5-flash"],
  standard: ["gemini-2.5-flash"],
  advanced: [
    "gemini-3.1-pro-preview",
    "gemini-3-pro-preview",
    "gemini-2.5-pro",
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
  /** 전체 호출 안전 타임아웃 (ms). 서버리스 maxDuration 내에서 완료 보장용 */
  timeoutMs?: number;
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
  const tier = options.modelTier ?? "standard";
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

        return {
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
          logActionWarn(
            "ai-sdk.generateText",
            `${currentModelId} ${isTimeoutError(error) ? "타임아웃" : "과부하"} → 다음 모델로 전환`
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
  const tier = options.modelTier ?? "standard";
  const fallbackChain = MODEL_FALLBACK_CHAIN[tier];
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS[tier];
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE[tier];
  const maxRetries = 1; // 서버리스 환경: 재시도 1회로 제한 (기존 3 → 타임아웃 방지)
  const abortSignal = options.timeoutMs
    ? AbortSignal.timeout(options.timeoutMs)
    : undefined;

  let lastError: Error | null = null;

  for (const currentModelId of fallbackChain) {
    if (isCircuitOpen(currentModelId)) {
      logActionDebug("ai-sdk.generateObject", `${currentModelId} circuit open, skip`);
      continue;
    }

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

        return {
          object: result.object,
          usage: {
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
          },
          modelId: currentModelId,
        };
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

        // 과부하 또는 타임아웃 → 다음 모델로 전환
        if (isOverloadError(error) || isTimeoutError(error)) {
          logActionWarn(
            "ai-sdk.generateObject",
            `${currentModelId} ${isTimeoutError(error) ? "타임아웃" : "과부하"} → 다음 모델로 전환`
          );
          recordCircuitFailure(currentModelId);
          break;
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
  const tier = options.modelTier ?? "standard";
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
            `${currentModelId} 과부하 → 다음 모델로 전환`
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
