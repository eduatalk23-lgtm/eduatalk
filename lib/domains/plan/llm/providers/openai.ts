/**
 * OpenAI GPT Provider
 *
 * OpenAI GPT API를 사용하는 LLM Provider 구현입니다.
 */

import OpenAI from "openai";
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

// ============================================
// 모델 설정
// ============================================

const OPENAI_MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  fast: {
    tier: "fast",
    modelId: "gpt-4o-mini",
    maxTokens: 4096,
    temperature: 0.3,
    provider: "openai",
  },
  standard: {
    tier: "standard",
    modelId: "gpt-4o",
    maxTokens: 8192,
    temperature: 0.5,
    provider: "openai",
  },
  advanced: {
    tier: "advanced",
    modelId: "gpt-4-turbo",
    maxTokens: 16384,
    temperature: 0.7,
    provider: "openai",
  },
};

// 가격 정보 (2024년 기준, USD per 1M tokens)
const OPENAI_PRICING: Record<ModelTier, CostInfo> = {
  fast: {
    // GPT-4o-mini
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    currency: "USD",
  },
  standard: {
    // GPT-4o
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
    currency: "USD",
  },
  advanced: {
    // GPT-4 Turbo
    inputCostPer1M: 10.0,
    outputCostPer1M: 30.0,
    currency: "USD",
  },
};

// ============================================
// OpenAIProvider 클래스
// ============================================

/**
 * OpenAI GPT Provider
 *
 * @example
 * ```typescript
 * const provider = new OpenAIProvider();
 * const result = await provider.createMessage({
 *   system: 'You are a helpful assistant.',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   modelTier: 'standard',
 * });
 * ```
 */
export class OpenAIProvider extends BaseLLMProvider {
  readonly type = "openai" as const;
  readonly name = "OpenAI GPT";

  private client: OpenAI | null = null;

  /**
   * API 키 가져오기
   */
  private getApiKey(): string {
    return this.validateApiKey(process.env.OPENAI_API_KEY, "OPENAI_API_KEY");
  }

  /**
   * OpenAI 클라이언트 인스턴스 가져오기 (싱글톤)
   */
  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
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
      const apiKey = process.env.OPENAI_API_KEY;
      return {
        available: !!apiKey,
        hasApiKey: !!apiKey,
        errorMessage: apiKey ? undefined : "OPENAI_API_KEY가 설정되지 않았습니다.",
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
    return OPENAI_MODEL_CONFIGS[tier];
  }

  /**
   * 모든 모델 설정 반환
   */
  getAllModelConfigs(): Record<ModelTier, ModelConfig> {
    return { ...OPENAI_MODEL_CONFIGS };
  }

  /**
   * 비용 정보 반환
   */
  getCostInfo(tier: ModelTier): CostInfo {
    return OPENAI_PRICING[tier];
  }

  /**
   * 메시지 생성 (비스트리밍)
   */
  async createMessage(options: CreateMessageOptions): Promise<CreateMessageResult> {
    const client = this.getClient();
    const config = this.getModelConfig(options.modelTier || "standard");

    // OpenAI 메시지 형식으로 변환
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: options.system },
      ...options.messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    const response = await client.chat.completions.create({
      model: config.modelId,
      max_tokens: options.maxTokens || config.maxTokens,
      temperature: options.temperature ?? config.temperature,
      messages,
    });

    const choice = response.choices[0];
    const content = choice?.message?.content || "";

    return {
      content,
      stopReason: choice?.finish_reason || null,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
      modelId: config.modelId,
      provider: "openai",
    };
  }

  /**
   * 메시지 생성 (스트리밍)
   */
  async streamMessage(options: StreamMessageOptions): Promise<CreateMessageResult> {
    const client = this.getClient();
    const config = this.getModelConfig(options.modelTier || "standard");

    // OpenAI 메시지 형식으로 변환
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: options.system },
      ...options.messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    let fullContent = "";
    let stopReason: string | null = null;

    try {
      const stream = await client.chat.completions.create({
        model: config.modelId,
        max_tokens: options.maxTokens || config.maxTokens,
        temperature: options.temperature ?? config.temperature,
        messages,
        stream: true,
        stream_options: { include_usage: true },
      });

      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          options.onText?.(delta.content);
        }

        // finish_reason 캡처
        if (chunk.choices[0]?.finish_reason) {
          stopReason = chunk.choices[0].finish_reason;
        }

        // 사용량 정보 캡처 (스트림 마지막에 전송됨)
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
        }
      }

      const result: CreateMessageResult = {
        content: fullContent,
        stopReason,
        usage: {
          inputTokens,
          outputTokens,
        },
        modelId: config.modelId,
        provider: "openai",
      };

      options.onComplete?.(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      options.onError?.(err);
      throw err;
    }
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let providerInstance: OpenAIProvider | null = null;

/**
 * OpenAIProvider 싱글톤 인스턴스 반환
 */
export function getOpenAIProvider(): OpenAIProvider {
  if (!providerInstance) {
    providerInstance = new OpenAIProvider();
  }
  return providerInstance;
}
