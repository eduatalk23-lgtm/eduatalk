/**
 * Google Gemini Provider
 *
 * Google Gemini API를 사용하는 LLM Provider 구현입니다.
 */

import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import {
  BaseLLMProvider,
  type ModelTier,
  type ModelConfig,
  type CreateMessageOptions,
  type CreateMessageResult,
  type StreamMessageOptions,
  type CostInfo,
  type ProviderStatus,
  type GroundingConfig,
  type GroundingMetadata,
} from "./base";
import { logActionDebug, logActionWarn } from "@/lib/utils/serverActionLogger";

// ============================================
// 모델 설정
// ============================================

const GEMINI_MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  fast: {
    tier: "fast",
    modelId: "gemini-flash-latest",
    maxTokens: 4096,
    temperature: 0.3,
    provider: "gemini",
  },
  standard: {
    tier: "standard",
    modelId: "gemini-flash-latest",
    maxTokens: 8192,
    temperature: 0.5,
    provider: "gemini",
  },
  advanced: {
    tier: "advanced",
    modelId: "gemini-pro-latest",
    maxTokens: 16384,
    temperature: 0.7,
    provider: "gemini",
  },
};

// 가격 정보 (2025년 기준, USD per 1M tokens)
const GEMINI_PRICING: Record<ModelTier, CostInfo> = {
  fast: {
    // Gemini 2.0 Flash
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4,
    currency: "USD",
  },
  standard: {
    // Gemini 2.0 Flash
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4,
    currency: "USD",
  },
  advanced: {
    // Gemini 1.5 Pro
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.0,
    currency: "USD",
  },
};


/**
 * Gemini API Rate Limiter
 *
 * 요청 간격을 제어하여 Rate Limit 에러를 사전에 방지합니다.
 * Gemini Free Tier: 15 RPM (분당 15 요청) → 최소 4초 간격 권장
 * Gemini Pay-as-you-go: 1000 RPM → 최소 60ms 간격
 */
class GeminiRateLimiter {
  private lastRequestTime: number = 0;
  private requestQueue: Array<() => void> = [];
  private isProcessing: boolean = false;

  /**
   * @param minIntervalMs - 요청 간 최소 간격 (밀리초)
   */
  constructor(private readonly minIntervalMs: number = 4000) {}

  /**
   * 다음 요청까지 대기해야 하는 시간 계산
   */
  private getWaitTime(): number {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const waitTime = Math.max(0, this.minIntervalMs - elapsed);
    return waitTime;
  }

  /**
   * Rate Limit을 준수하며 요청 실행
   *
   * @param fn - 실행할 비동기 함수
   * @returns 함수 실행 결과
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const waitTime = this.getWaitTime();

    if (waitTime > 0) {
      logActionDebug("GeminiRateLimiter", `${waitTime}ms 대기 중...`);
      await this.delay(waitTime);
    }

    this.lastRequestTime = Date.now();

    try {
      return await fn();
    } finally {
      // 요청 완료 후 시간 갱신 (에러 발생해도)
      this.lastRequestTime = Date.now();
    }
  }

  /**
   * 대기
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 현재 설정된 최소 간격 반환
   */
  getMinInterval(): number {
    return this.minIntervalMs;
  }

  /**
   * 마지막 요청 이후 경과 시간
   */
  getElapsedSinceLastRequest(): number {
    return Date.now() - this.lastRequestTime;
  }
}

// 싱글톤 Rate Limiter 인스턴스 (Free Tier 기준 4초 간격)
const geminiRateLimiter = new GeminiRateLimiter(4000);

// ============================================
// GeminiProvider 클래스
// ============================================

/**
 * Google Gemini Provider
 *
 * @example
 * ```typescript
 * const provider = new GeminiProvider();
 * const result = await provider.createMessage({
 *   system: 'You are a helpful assistant.',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   modelTier: 'standard',
 * });
 * ```
 */
export class GeminiProvider extends BaseLLMProvider {
  readonly type = "gemini" as const;
  readonly name = "Google Gemini";

  private client: GoogleGenerativeAI | null = null;
  private modelCache: Map<string, GenerativeModel> = new Map();

  /**
   * API 키 가져오기
   */
  private getApiKey(): string {
    return this.validateApiKey(process.env.GOOGLE_API_KEY, "GOOGLE_API_KEY");
  }


  /**
   * Rate Limit 에러 감지
   *
   * Google Gemini API에서 발생하는 429 Too Many Requests 에러 및
   * 할당량 초과 에러를 감지합니다.
   *
   * @param error - 감지할 에러 객체
   * @returns Rate Limit 에러인 경우 true, 그렇지 않으면 false
   */
  private isRateLimitError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorMessage = error.message.toLowerCase();

    // 429 에러 코드 감지
    if (errorMessage.includes("429")) {
      return true;
    }

    // 할당량 관련 키워드 감지
    if (errorMessage.includes("quota")) {
      return true;
    }

    // Rate limit 관련 키워드 감지
    if (errorMessage.includes("rate limit")) {
      return true;
    }

    // Too many requests 관련 키워드 감지
    if (errorMessage.includes("too many requests")) {
      return true;
    }

    // GoogleGenerativeAI 에러 메시지 패턴 감지
    if (errorMessage.includes("exceeded your current quota")) {
      return true;
    }

    // Google API 특정 에러 코드
    if (errorMessage.includes("resource_exhausted")) {
      return true;
    }

    return false;
  }


  /**
   * Rate Limit 에러에서 재시도 지연 시간 추출
   *
   * 에러 메시지에서 권장 대기 시간을 추출합니다.
   * 추출할 수 없는 경우 기본값을 반환합니다.
   *
   * @param error - 에러 객체
   * @param attempt - 현재 시도 횟수 (지수 백오프 계산용)
   * @returns 대기 시간 (밀리초)
   */
  private extractRetryDelay(error: unknown, attempt: number): number {
    const baseDelay = 1000; // 1초 기본 대기
    const maxDelay = 60000; // 최대 60초

    // 지수 백오프: 1초, 2초, 4초, 8초, ...
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

    // 에러 메시지에서 retry-after 정보 추출 시도
    if (error instanceof Error) {
      const message = error.message;

      // "retry after X seconds" 패턴 감지
      const retryMatch = message.match(/retry\s*(?:after|in)\s*(\d+)\s*(?:s|sec|seconds?)/i);
      if (retryMatch) {
        const seconds = parseInt(retryMatch[1], 10);
        return Math.min(seconds * 1000, maxDelay);
      }

      // "wait X seconds" 패턴 감지
      const waitMatch = message.match(/wait\s*(\d+)\s*(?:s|sec|seconds?)/i);
      if (waitMatch) {
        const seconds = parseInt(waitMatch[1], 10);
        return Math.min(seconds * 1000, maxDelay);
      }
    }

    // 지터 추가 (0-500ms)로 thundering herd 방지
    const jitter = Math.random() * 500;
    return exponentialDelay + jitter;
  }

  /**
   * Google Generative AI 클라이언트 인스턴스 가져오기 (싱글톤)
   */
  private getClient(): GoogleGenerativeAI {
    if (!this.client) {
      this.client = new GoogleGenerativeAI(this.getApiKey());
    }
    return this.client;
  }

  /**
   * Generative Model 인스턴스 가져오기 (캐싱)
   */
  private getModel(config: ModelConfig): GenerativeModel {
    const key = `${config.modelId}-${config.temperature}`;
    if (!this.modelCache.has(key)) {
      const client = this.getClient();
      const model = client.getGenerativeModel({
        model: config.modelId,
        generationConfig: {
          maxOutputTokens: config.maxTokens,
          temperature: config.temperature,
        },
      });
      this.modelCache.set(key, model);
    }
    return this.modelCache.get(key)!;
  }

  /**
   * Provider 상태 확인
   */
  getStatus(): ProviderStatus {
    try {
      const apiKey = process.env.GOOGLE_API_KEY;
      return {
        available: !!apiKey,
        hasApiKey: !!apiKey,
        errorMessage: apiKey ? undefined : "GOOGLE_API_KEY가 설정되지 않았습니다.",
      };
    } catch (error) {
      return {
        available: false,
        hasApiKey: false,
        errorMessage: error instanceof Error ? error.message : "알 수 없는 오류",
      };
    }
  }

  /**
   * 모델 설정 반환
   */
  getModelConfig(tier: ModelTier): ModelConfig {
    return GEMINI_MODEL_CONFIGS[tier];
  }

  /**
   * 모든 모델 설정 반환
   */
  getAllModelConfigs(): Record<ModelTier, ModelConfig> {
    return { ...GEMINI_MODEL_CONFIGS };
  }

  /**
   * 비용 정보 반환
   */
  getCostInfo(tier: ModelTier): CostInfo {
    return GEMINI_PRICING[tier];
  }

  /**
   * 메시지를 Gemini 형식으로 변환
   */
  private formatMessages(
    system: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>
  ): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
    // Gemini에서는 system prompt를 첫 번째 user 메시지에 포함시키거나
    // systemInstruction으로 설정할 수 있음
    const formattedMessages: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    // 첫 번째 메시지에 system prompt 포함
    let isFirstUserMessage = true;

    for (const msg of messages) {
      const role = msg.role === "assistant" ? "model" : "user";
      let content = msg.content;

      // 첫 번째 user 메시지에 system prompt 추가
      if (role === "user" && isFirstUserMessage && system) {
        content = `[System Instructions]\n${system}\n\n[User Message]\n${content}`;
        isFirstUserMessage = false;
      }

      formattedMessages.push({
        role,
        parts: [{ text: content }],
      });
    }

    return formattedMessages;
  }

  /**
   * Grounding tools 빌드
   * @param grounding - Grounding 설정
   * @param modelId - 모델 ID (버전 감지용)
   * @returns Gemini API tools 배열
   */
  /**
   * Grounding tools 빌드
   * @param grounding - Grounding 설정
   * @param modelId - 모델 ID (버전 감지용)
   * @returns Gemini API tools 배열
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildGroundingTools(
    grounding?: GroundingConfig,
    modelId?: string
  ): Array<Record<string, unknown>> {
    if (!grounding?.enabled) return [];

    // Gemini 2.0 모델 및 최신 모델(latest) 감지
    const useGoogleSearch = 
      modelId?.includes("gemini-2.0") || 
      modelId?.includes("latest") ||
      modelId?.includes("gemini-2.5");

    logActionDebug(
      "GeminiProvider.buildGroundingTools",
      `modelId=${modelId}, useGoogleSearch=${useGoogleSearch}, mode=${grounding.mode}, enabled=${grounding.enabled}`
    );

    // Gemini 2.0 및 최신 모델은 googleSearch만 지원 (동적/항상 모드 무관)
    if (useGoogleSearch) {
      logActionDebug(
        "GeminiProvider.buildGroundingTools",
        `Using googleSearch for ${modelId}`
      );
      return [{ googleSearch: {} }];
    }

    // Gemini 1.5: mode에 따라 분기
    if (grounding.mode === "always") {
      // 항상 검색
      return [{ googleSearch: {} }];
    }

    // 동적 검색 (기본값) - Gemini 1.5 호환
    return [
      {
        googleSearchRetrieval: {
          dynamicRetrievalConfig: {
            mode: "MODE_DYNAMIC",
            dynamicThreshold: grounding.dynamicThreshold ?? 0.3,
          },
        },
      },
    ];
  }

  /**
   * Gemini 응답에서 Grounding 메타데이터 추출
   * @param response - Gemini API 응답
   * @returns GroundingMetadata 또는 undefined
   */
  // sdk 타입을 직접 가져다 쓰거나, 구체적인 타입을 정의하는 것이 좋음
  // 여기서는 구조적 타이핑을 위해 Record<string, unknown> 사용 후 타입 가드 또는 캐스팅
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractGroundingMetadata(response: any): GroundingMetadata | undefined {
    const groundingMeta = response.candidates?.[0]?.groundingMetadata;
    if (!groundingMeta) return undefined;

    // 검색 쿼리 추출
    const searchQueries: string[] =
      groundingMeta.webSearchQueries || groundingMeta.searchQueries || [];

    // 웹 검색 결과 추출
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webResults = (groundingMeta.groundingChunks || []).map((chunk: any) => ({
      url: chunk.web?.uri || "",
      title: chunk.web?.title || "",
      snippet: chunk.retrievedContext?.text || "",
    }));

    // 인용 정보 추출
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const citations = (groundingMeta.groundingSupports || []).flatMap((support: any) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (support.groundingChunkIndices || []).map((index: number, _i: number) => ({
        startIndex: support.segment?.startIndex || 0,
        endIndex: support.segment?.endIndex || 0,
        uri: groundingMeta.groundingChunks?.[index]?.web?.uri || "",
      }))
    );

    return {
      searchQueries,
      webResults,
      citations: citations.length > 0 ? citations : undefined,
    };
  }

  /**
   * 메시지 생성 (비스트리밍)
   */
  async createMessage(options: CreateMessageOptions): Promise<CreateMessageResult> {
    const config = this.getModelConfig(options.modelTier || "standard");
    const model = this.getModel(config);
    const maxRetries = 3;

    logActionDebug("GeminiProvider.createMessage", `시작 - modelId=${config.modelId}, tier=${options.modelTier}, grounding=${options.grounding?.enabled}, mode=${options.grounding?.mode}`);

    const formattedMessages = this.formatMessages(options.system, options.messages);

    // 마지막 메시지 추출 (generateContent에 전달)
    const lastMessage = formattedMessages[formattedMessages.length - 1];
    const history = formattedMessages.slice(0, -1);

    // Grounding tools 빌드 (modelId 전달)
    const tools = this.buildGroundingTools(options.grounding, config.modelId);

    logActionDebug("GeminiProvider.createMessage", `Chat 설정 - historyLength=${history.length}, toolsCount=${tools.length}`);

    // Chat 세션 시작 (Grounding tools 포함)
    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: options.maxTokens || config.maxTokens,
        temperature: options.temperature ?? config.temperature,
      },
      // Grounding tools가 있는 경우에만 추가
      ...(tools.length > 0 && { tools }),
    });

    // Rate Limit 재시도 로직
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logActionDebug("GeminiProvider.createMessage", `재시도 ${attempt}/${maxRetries}`);
        }

        // Rate Limiter를 통해 요청 간격 제어
        const result = await geminiRateLimiter.execute(() =>
          chat.sendMessage(lastMessage.parts)
        );
        const response = result.response;
        const content = response.text();

        // 응답 구조 진단 로깅
        if (options.grounding?.enabled) {
          const candidate = response.candidates?.[0];
          logActionDebug("GeminiProvider.createMessage", `응답 구조 - hasCandidate=${!!candidate}, finishReason=${candidate?.finishReason}, hasGroundingMetadata=${!!candidate?.groundingMetadata}`);
        }

        // Grounding 메타데이터 추출
        const groundingMetadata = options.grounding?.enabled
          ? this.extractGroundingMetadata(response)
          : undefined;

        if (options.grounding?.enabled) {
          logActionDebug("GeminiProvider.createMessage", `Grounding 결과 - hasMetadata=${!!groundingMetadata}, searchQueries=${groundingMetadata?.searchQueries?.length ?? 0}, webResults=${groundingMetadata?.webResults?.length ?? 0}`);
        }

        // 토큰 사용량 추정 (Gemini API는 정확한 토큰 수를 제공하지 않을 수 있음)
        const inputTokens = this.estimateTokens(
          options.system + options.messages.map((m) => m.content).join("")
        );
        const outputTokens = this.estimateTokens(content);

        return {
          content,
          stopReason: response.candidates?.[0]?.finishReason || null,
          usage: {
            inputTokens,
            outputTokens,
          },
          modelId: config.modelId,
          provider: "gemini",
          groundingMetadata,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Rate Limit 에러인 경우 재시도
        if (this.isRateLimitError(error) && attempt < maxRetries) {
          const delay = this.extractRetryDelay(error, attempt);
          logActionWarn("GeminiProvider.createMessage", `Rate limit 에러 발생. ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries}): ${lastError.message}`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Rate Limit이 아니거나 최대 재시도 횟수 초과
        throw lastError;
      }
    }

    // 모든 재시도 실패 시
    throw lastError || new Error("[Gemini] 알 수 없는 에러");
  }

  /**
   * 메시지 생성 (스트리밍)
   */
  async streamMessage(options: StreamMessageOptions): Promise<CreateMessageResult> {
    const config = this.getModelConfig(options.modelTier || "standard");
    const model = this.getModel(config);
    const maxRetries = 3;

    logActionDebug("GeminiProvider.streamMessage", `시작 - modelId=${config.modelId}, tier=${options.modelTier}, grounding=${options.grounding?.enabled}`);

    const formattedMessages = this.formatMessages(options.system, options.messages);

    // 마지막 메시지 추출
    const lastMessage = formattedMessages[formattedMessages.length - 1];
    const history = formattedMessages.slice(0, -1);

    // Grounding tools 빌드 (modelId 전달)
    const tools = this.buildGroundingTools(options.grounding, config.modelId);

    // Rate Limit 재시도 로직
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let fullContent = "";
      let stopReason: string | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let lastResponse: any = null;

      try {
        if (attempt > 0) {
          logActionDebug("GeminiProvider.streamMessage", `재시도 ${attempt}/${maxRetries}`);
        }

        // Chat 세션 시작 (Grounding tools 포함)
        const chat = model.startChat({
          history,
          generationConfig: {
            maxOutputTokens: options.maxTokens || config.maxTokens,
            temperature: options.temperature ?? config.temperature,
          },
          // Grounding tools가 있는 경우에만 추가
          ...(tools.length > 0 && { tools }),
        });

        // Rate Limiter를 통해 요청 간격 제어
        const result = await geminiRateLimiter.execute(() =>
          chat.sendMessageStream(lastMessage.parts)
        );

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullContent += text;
            options.onText?.(text);
          }

          // finishReason 캡처
          if (chunk.candidates?.[0]?.finishReason) {
            stopReason = chunk.candidates[0].finishReason;
          }

          // 마지막 응답 저장 (grounding metadata 추출용)
          lastResponse = chunk;
        }

        // Grounding 메타데이터 추출
        const groundingMetadata = options.grounding?.enabled && lastResponse
          ? this.extractGroundingMetadata(lastResponse)
          : undefined;

        // 토큰 사용량 추정
        const inputTokens = this.estimateTokens(
          options.system + options.messages.map((m) => m.content).join("")
        );
        const outputTokens = this.estimateTokens(fullContent);

        const messageResult: CreateMessageResult = {
          content: fullContent,
          stopReason,
          usage: {
            inputTokens,
            outputTokens,
          },
          modelId: config.modelId,
          provider: "gemini",
          groundingMetadata,
        };

        options.onComplete?.(messageResult);
        return messageResult;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Rate Limit 에러인 경우 재시도
        if (this.isRateLimitError(error) && attempt < maxRetries) {
          const delay = this.extractRetryDelay(error, attempt);
          logActionWarn("GeminiProvider.streamMessage", `Rate limit 에러 발생. ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries}): ${lastError.message}`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Rate Limit이 아니거나 최대 재시도 횟수 초과
        options.onError?.(lastError);
        throw lastError;
      }
    }

    // 모든 재시도 실패 시
    const finalError = lastError || new Error("[Gemini] streamMessage 알 수 없는 에러");
    options.onError?.(finalError);
    throw finalError;
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let providerInstance: GeminiProvider | null = null;

/**
 * GeminiProvider 싱글톤 인스턴스 반환
 */
export function getGeminiProvider(): GeminiProvider {
  if (!providerInstance) {
    providerInstance = new GeminiProvider();
  }
  return providerInstance;
}
