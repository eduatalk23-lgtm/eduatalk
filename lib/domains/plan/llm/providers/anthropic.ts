/**
 * Anthropic Claude Provider
 *
 * Anthropic Claude API를 사용하는 LLM Provider 구현입니다.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  BaseLLMProvider,
  type ModelTier,
  type ModelConfig,
  type CreateMessageOptions,
  type CreateMessageResult,
  type StreamMessageOptions,
  type CostInfo,
  type ProviderStatus,
} from "./base";
import { logActionDebug, logActionWarn } from "@/lib/utils/serverActionLogger";

// ============================================
// 모델 설정
// ============================================

const ANTHROPIC_MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  fast: {
    tier: "fast",
    modelId: "claude-3-5-haiku-20241022",
    maxTokens: 4096,
    temperature: 0.3,
    provider: "anthropic",
  },
  standard: {
    tier: "standard",
    modelId: "claude-sonnet-4-20250514",
    maxTokens: 8192,
    temperature: 0.5,
    provider: "anthropic",
  },
  advanced: {
    tier: "advanced",
    modelId: "claude-sonnet-4-20250514",
    maxTokens: 16384,
    temperature: 0.7,
    provider: "anthropic",
  },
};

// 가격 정보 (2024년 기준, USD per 1M tokens)
const ANTHROPIC_PRICING: Record<ModelTier, CostInfo> = {
  fast: {
    // Claude 3.5 Haiku
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
    currency: "USD",
  },
  standard: {
    // Claude Sonnet 4
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    currency: "USD",
  },
  advanced: {
    // Claude Sonnet 4 (same as standard, with higher limits)
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    currency: "USD",
  },
};

// ============================================
// AnthropicProvider 클래스
// ============================================

/**
 * Anthropic Claude Provider
 *
 * @example
 * ```typescript
 * const provider = new AnthropicProvider();
 * const result = await provider.createMessage({
 *   system: 'You are a helpful assistant.',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   modelTier: 'standard',
 * });
 * ```
 */
export class AnthropicProvider extends BaseLLMProvider {
  readonly type = "anthropic" as const;
  readonly name = "Anthropic Claude";

  private client: Anthropic | null = null;

  /**
   * API 키 가져오기
   */
  private getApiKey(): string {
    return this.validateApiKey(process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY");
  }

  /**
   * Anthropic 클라이언트 인스턴스 가져오기 (싱글톤)
   */
  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({
        apiKey: this.getApiKey(),
      });
    }
    return this.client;
  }

  /**
   * Provider 상태 확인
   */
  getStatus(): ProviderStatus {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      return {
        available: !!apiKey,
        hasApiKey: !!apiKey,
        errorMessage: apiKey ? undefined : "ANTHROPIC_API_KEY가 설정되지 않았습니다.",
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
    return ANTHROPIC_MODEL_CONFIGS[tier];
  }

  /**
   * 모든 모델 설정 반환
   */
  getAllModelConfigs(): Record<ModelTier, ModelConfig> {
    return { ...ANTHROPIC_MODEL_CONFIGS };
  }

  /**
   * 비용 정보 반환
   */
  getCostInfo(tier: ModelTier): CostInfo {
    return ANTHROPIC_PRICING[tier];
  }

  /**
   * Rate Limit 에러 감지
   *
   * Anthropic API에서 발생하는 429 Too Many Requests 에러를 감지합니다.
   *
   * @param error - 감지할 에러 객체
   * @returns Rate Limit 에러인 경우 true
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

    // Rate limit 관련 키워드 감지
    if (errorMessage.includes("rate limit")) {
      return true;
    }

    // Too many requests 감지
    if (errorMessage.includes("too many requests")) {
      return true;
    }

    // Anthropic 특정 에러 타입 감지
    if (error instanceof Anthropic.RateLimitError) {
      return true;
    }

    return false;
  }

  /**
   * Rate Limit 에러에서 재시도 지연 시간 추출
   *
   * @param error - 에러 객체
   * @param attempt - 현재 시도 횟수
   * @returns 대기 시간 (밀리초)
   */
  private extractRetryDelay(error: unknown, attempt: number): number {
    const baseDelay = 1000; // 1초 기본 대기
    const maxDelay = 60000; // 최대 60초

    // 지수 백오프: 1초, 2초, 4초, ...
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

    // Anthropic RateLimitError에서 retry-after 헤더 추출 시도
    if (error instanceof Anthropic.RateLimitError) {
      const retryAfter = error.headers?.get?.("retry-after");
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
          return Math.min(seconds * 1000, maxDelay);
        }
      }
    }

    // 지터 추가 (0-500ms)로 thundering herd 방지
    const jitter = Math.random() * 500;
    return exponentialDelay + jitter;
  }

  /**
   * 메시지 생성 (비스트리밍)
   */
  async createMessage(options: CreateMessageOptions): Promise<CreateMessageResult> {
    const client = this.getClient();
    const config = this.getModelConfig(options.modelTier || "standard");
    const maxRetries = 3;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logActionDebug("AnthropicProvider.createMessage", `재시도 ${attempt}/${maxRetries}`);
        }

        const response = await client.messages.create({
          model: config.modelId,
          max_tokens: options.maxTokens || config.maxTokens,
          temperature: options.temperature ?? config.temperature,
          system: options.system,
          messages: options.messages,
        });

        // 텍스트 블록 추출
        const textContent = response.content.find((block) => block.type === "text");
        const content = textContent?.type === "text" ? textContent.text : "";

        return {
          content,
          stopReason: response.stop_reason,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
          modelId: config.modelId,
          provider: "anthropic",
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Rate Limit 에러인 경우 재시도
        if (this.isRateLimitError(error) && attempt < maxRetries) {
          const delay = this.extractRetryDelay(error, attempt);
          logActionWarn("AnthropicProvider.createMessage", `Rate limit 에러 발생. ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries}): ${lastError.message}`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error("[Anthropic] 알 수 없는 에러");
  }

  /**
   * 메시지 생성 (스트리밍)
   */
  async streamMessage(options: StreamMessageOptions): Promise<CreateMessageResult> {
    const client = this.getClient();
    const config = this.getModelConfig(options.modelTier || "standard");
    const maxRetries = 3;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let fullContent = "";
      let inputTokens = 0;
      let outputTokens = 0;
      let stopReason: string | null = null;

      try {
        if (attempt > 0) {
          logActionDebug("AnthropicProvider.streamMessage", `재시도 ${attempt}/${maxRetries}`);
        }

        const stream = await client.messages.stream({
          model: config.modelId,
          max_tokens: options.maxTokens || config.maxTokens,
          temperature: options.temperature ?? config.temperature,
          system: options.system,
          messages: options.messages,
        });

        for await (const event of stream) {
          if (event.type === "content_block_delta") {
            const delta = event.delta;
            if ("text" in delta) {
              fullContent += delta.text;
              options.onText?.(delta.text);
            }
          } else if (event.type === "message_delta") {
            stopReason = event.delta.stop_reason || null;
          } else if (event.type === "message_start") {
            inputTokens = event.message.usage.input_tokens;
          }
        }

        // 최종 메시지 가져오기
        const finalMessage = await stream.finalMessage();
        outputTokens = finalMessage.usage.output_tokens;

        const result: CreateMessageResult = {
          content: fullContent,
          stopReason,
          usage: {
            inputTokens,
            outputTokens,
          },
          modelId: config.modelId,
          provider: "anthropic",
        };

        options.onComplete?.(result);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Rate Limit 에러인 경우 재시도
        if (this.isRateLimitError(error) && attempt < maxRetries) {
          const delay = this.extractRetryDelay(error, attempt);
          logActionWarn("AnthropicProvider.streamMessage", `Rate limit 에러 발생. ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries}): ${lastError.message}`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        options.onError?.(lastError);
        throw lastError;
      }
    }

    const finalError = lastError || new Error("[Anthropic] streamMessage 알 수 없는 에러");
    options.onError?.(finalError);
    throw finalError;
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let providerInstance: AnthropicProvider | null = null;

/**
 * AnthropicProvider 싱글톤 인스턴스 반환
 */
export function getAnthropicProvider(): AnthropicProvider {
  if (!providerInstance) {
    providerInstance = new AnthropicProvider();
  }
  return providerInstance;
}
