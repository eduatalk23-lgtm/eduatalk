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
// ============================================

const MODEL_ID_MAP: Record<ModelTier, string> = {
  fast: "gemini-2.5-flash",
  standard: "gemini-2.5-flash",
  advanced: "gemini-2.5-pro",
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

function getCircuit(tier: string): CircuitState {
  if (!circuitBreakers.has(tier)) {
    circuitBreakers.set(tier, { failures: 0, lastFailure: 0, state: "closed" });
  }
  return circuitBreakers.get(tier)!;
}

function checkCircuitBreaker(tier: string): void {
  const circuit = getCircuit(tier);
  if (circuit.state === "closed") return;

  const elapsed = Date.now() - circuit.lastFailure;
  if (elapsed >= CB_COOLDOWN_MS) {
    // cooldown 경과 → half-open (1회 시도 허용)
    circuit.state = "half-open";
    return;
  }

  // OPEN 상태 → 즉시 거부
  throw new Error(`[Circuit Breaker] ${tier} 모델 연속 ${circuit.failures}회 실패. ${Math.ceil((CB_COOLDOWN_MS - elapsed) / 1000)}초 후 재시도 가능`);
}

function recordCircuitSuccess(tier: string): void {
  const circuit = getCircuit(tier);
  circuit.failures = 0;
  circuit.state = "closed";
}

function recordCircuitFailure(tier: string): void {
  const circuit = getCircuit(tier);
  circuit.failures++;
  circuit.lastFailure = Date.now();
  if (circuit.failures >= CB_THRESHOLD) {
    circuit.state = "open";
    logActionWarn("ai-sdk.circuitBreaker", `${tier} OPEN — ${circuit.failures}회 연속 실패, ${CB_COOLDOWN_MS / 1000}초 차단`);
  }
}

// ============================================
// Rate Limit 에러 감지 — 구조적 방식 우선, 문자열 fallback
// ============================================

function isRateLimitError(error: unknown): boolean {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsonModeOutput: any = {
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
  const modelId = MODEL_ID_MAP[tier];
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS[tier];
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE[tier];
  const maxRetries = 3;

  // P3-1: Circuit Breaker 체크
  checkCircuitBreaker(tier);

  logActionDebug(
    "ai-sdk.generateText",
    `시작 - model=${modelId}, tier=${tier}, grounding=${options.grounding?.enabled}`
  );

  // Grounding 도구 설정
  const tools =
    options.grounding?.enabled
      ? { google_search: google.tools.googleSearch({}) }
      : undefined;

  let lastError: Error | null = null;

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
          model: google(modelId),
          system: options.system,
          messages: options.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          maxOutputTokens: maxTokens,
          temperature,
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

      // 성공 시 할당량 + Circuit Breaker 기록
      geminiQuotaTracker.recordRequest();
      recordCircuitSuccess(tier);

      // Grounding 메타데이터 추출
      const groundingMetadata = options.grounding?.enabled
        ? extractGroundingFromSources(result)
        : undefined;

      if (options.grounding?.enabled) {
        logActionDebug(
          "ai-sdk.generateText",
          `Grounding 결과 - hasMetadata=${!!groundingMetadata}, webResults=${groundingMetadata?.webResults?.length ?? 0}`
        );
      }

      return {
        content: result.text,
        stopReason: result.finishReason ?? null,
        usage: {
          inputTokens: result.usage?.inputTokens ?? 0,
          outputTokens: result.usage?.outputTokens ?? 0,
        },
        modelId,
        provider: "gemini",
        groundingMetadata,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (isRateLimitError(error) && attempt < maxRetries) {
        geminiQuotaTracker.recordRateLimitHit();
        recordCircuitFailure(tier);
        const delay = extractRetryDelay(error, attempt);
        logActionWarn(
          "ai-sdk.generateText",
          `Rate limit 에러. ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries}): ${lastError.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      recordCircuitFailure(tier);
      throw lastError;
    }
  }

  throw lastError ?? new Error("[AI SDK] generateText 알 수 없는 에러");
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
  const modelId = MODEL_ID_MAP[tier];
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS[tier];
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE[tier];
  const maxRetries = 3;

  checkCircuitBreaker(tier);

  logActionDebug(
    "ai-sdk.generateObject",
    `시작 - model=${modelId}, tier=${tier}`
  );

  let lastError: Error | null = null;

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
          model: google(modelId),
          mode: "json",
          system: options.system,
          messages: options.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          schema: options.schema,
          maxOutputTokens: maxTokens,
          temperature,
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
      recordCircuitSuccess(tier);

      return {
        object: result.object,
        usage: {
          inputTokens: result.usage?.inputTokens ?? 0,
          outputTokens: result.usage?.outputTokens ?? 0,
        },
        modelId,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (isRateLimitError(error) && attempt < maxRetries) {
        geminiQuotaTracker.recordRateLimitHit();
        recordCircuitFailure(tier);
        const delay = extractRetryDelay(error, attempt);
        logActionWarn(
          "ai-sdk.generateObject",
          `Rate limit 에러. ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries}): ${lastError.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      recordCircuitFailure(tier);
      throw lastError;
    }
  }

  throw lastError ?? new Error("[AI SDK] generateObject 알 수 없는 에러");
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
  const modelId = MODEL_ID_MAP[tier];
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS[tier];
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE[tier];
  const maxRetries = 3;

  checkCircuitBreaker(tier);

  logActionDebug(
    "ai-sdk.streamText",
    `시작 - model=${modelId}, tier=${tier}`
  );

  const tools =
    options.grounding?.enabled
      ? { google_search: google.tools.googleSearch({}) }
      : undefined;

  let lastError: Error | null = null;

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
          model: google(modelId),
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
      recordCircuitSuccess(tier);

      let fullContent = "";

      for await (const chunk of result.textStream) {
        fullContent += chunk;
        options.onText?.(chunk);
      }

      // 최종 usage 가져오기
      const usage = await result.usage;

      const aiSdkResult: AiSdkResult = {
        content: fullContent,
        stopReason: (await result.finishReason) ?? null,
        usage: {
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
        },
        modelId,
        provider: "gemini",
      };

      options.onComplete?.(aiSdkResult);
      return aiSdkResult;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (isRateLimitError(error) && attempt < maxRetries) {
        geminiQuotaTracker.recordRateLimitHit();
        recordCircuitFailure(tier);
        const delay = extractRetryDelay(error, attempt);
        logActionWarn(
          "ai-sdk.streamText",
          `Rate limit 에러. ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries}): ${lastError.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      recordCircuitFailure(tier);
      options.onError?.(lastError);
      throw lastError;
    }
  }

  const finalError =
    lastError ?? new Error("[AI SDK] streamText 알 수 없는 에러");
  options.onError?.(finalError);
  throw finalError;
}

// ============================================
// re-export (하위 호환)
// ============================================

export type { ModelTier } from "./types";
export type { GroundingConfig, GroundingMetadata, WebSearchResult } from "./providers/base";
export { getGeminiQuotaStatus, resetGeminiQuotaTracker } from "./providers/gemini";
