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
} from "./base";

// ============================================
// 모델 설정
// ============================================

const GEMINI_MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  fast: {
    tier: "fast",
    modelId: "gemini-1.5-flash",
    maxTokens: 4096,
    temperature: 0.3,
    provider: "gemini",
  },
  standard: {
    tier: "standard",
    modelId: "gemini-1.5-pro",
    maxTokens: 8192,
    temperature: 0.5,
    provider: "gemini",
  },
  advanced: {
    tier: "advanced",
    modelId: "gemini-1.5-pro",
    maxTokens: 16384,
    temperature: 0.7,
    provider: "gemini",
  },
};

// 가격 정보 (2024년 기준, USD per 1M tokens)
const GEMINI_PRICING: Record<ModelTier, CostInfo> = {
  fast: {
    // Gemini 1.5 Flash
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.3,
    currency: "USD",
  },
  standard: {
    // Gemini 1.5 Pro
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.0,
    currency: "USD",
  },
  advanced: {
    // Gemini 1.5 Pro (same as standard)
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.0,
    currency: "USD",
  },
};

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
   * 메시지 생성 (비스트리밍)
   */
  async createMessage(options: CreateMessageOptions): Promise<CreateMessageResult> {
    const config = this.getModelConfig(options.modelTier || "standard");
    const model = this.getModel(config);

    const formattedMessages = this.formatMessages(options.system, options.messages);

    // 마지막 메시지 추출 (generateContent에 전달)
    const lastMessage = formattedMessages[formattedMessages.length - 1];
    const history = formattedMessages.slice(0, -1);

    // Chat 세션 시작
    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: options.maxTokens || config.maxTokens,
        temperature: options.temperature ?? config.temperature,
      },
    });

    const result = await chat.sendMessage(lastMessage.parts);
    const response = result.response;
    const content = response.text();

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
    };
  }

  /**
   * 메시지 생성 (스트리밍)
   */
  async streamMessage(options: StreamMessageOptions): Promise<CreateMessageResult> {
    const config = this.getModelConfig(options.modelTier || "standard");
    const model = this.getModel(config);

    const formattedMessages = this.formatMessages(options.system, options.messages);

    // 마지막 메시지 추출
    const lastMessage = formattedMessages[formattedMessages.length - 1];
    const history = formattedMessages.slice(0, -1);

    let fullContent = "";
    let stopReason: string | null = null;

    try {
      // Chat 세션 시작
      const chat = model.startChat({
        history,
        generationConfig: {
          maxOutputTokens: options.maxTokens || config.maxTokens,
          temperature: options.temperature ?? config.temperature,
        },
      });

      const result = await chat.sendMessageStream(lastMessage.parts);

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
      }

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
      };

      options.onComplete?.(messageResult);
      return messageResult;
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
