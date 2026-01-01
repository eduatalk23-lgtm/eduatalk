/**
 * LLM 클라이언트
 *
 * Anthropic Claude API를 사용한 플랜 생성 클라이언트입니다.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ModelTier, ModelConfig, MODEL_CONFIGS } from "./types";

// ============================================
// 환경 변수 검증
// ============================================

function getApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다. " +
        ".env.local 파일에 ANTHROPIC_API_KEY를 추가해주세요."
    );
  }
  return apiKey;
}

// ============================================
// 클라이언트 인스턴스
// ============================================

let clientInstance: Anthropic | null = null;

/**
 * Anthropic 클라이언트 가져오기 (싱글톤)
 */
export function getAnthropicClient(): Anthropic {
  if (!clientInstance) {
    clientInstance = new Anthropic({
      apiKey: getApiKey(),
    });
  }
  return clientInstance;
}

// ============================================
// 모델 설정
// ============================================

const MODEL_CONFIGS_INTERNAL: Record<ModelTier, ModelConfig> = {
  fast: {
    tier: "fast",
    modelId: "claude-3-5-haiku-20241022",
    maxTokens: 4096,
    temperature: 0.3,
  },
  standard: {
    tier: "standard",
    modelId: "claude-sonnet-4-20250514",
    maxTokens: 8192,
    temperature: 0.5,
  },
  advanced: {
    tier: "advanced",
    modelId: "claude-sonnet-4-20250514",
    maxTokens: 16384,
    temperature: 0.7,
  },
};

/**
 * 모델 설정 가져오기
 */
export function getModelConfig(tier: ModelTier): ModelConfig {
  return MODEL_CONFIGS_INTERNAL[tier];
}

// ============================================
// 메시지 생성
// ============================================

export interface CreateMessageOptions {
  system: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  modelTier?: ModelTier;
  maxTokens?: number;
  temperature?: number;
}

export interface CreateMessageResult {
  content: string;
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  modelId: string;
}

/**
 * 메시지 생성 (비스트리밍)
 */
export async function createMessage(
  options: CreateMessageOptions
): Promise<CreateMessageResult> {
  const client = getAnthropicClient();
  const config = getModelConfig(options.modelTier || "standard");

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
  };
}

// ============================================
// 스트리밍 메시지 생성
// ============================================

export interface StreamMessageOptions extends CreateMessageOptions {
  onText?: (text: string) => void;
  onComplete?: (result: CreateMessageResult) => void;
  onError?: (error: Error) => void;
}

/**
 * 메시지 생성 (스트리밍)
 */
export async function streamMessage(
  options: StreamMessageOptions
): Promise<CreateMessageResult> {
  const client = getAnthropicClient();
  const config = getModelConfig(options.modelTier || "standard");

  let fullContent = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason: string | null = null;

  try {
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
    };

    options.onComplete?.(result);
    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    options.onError?.(err);
    throw err;
  }
}

// ============================================
// JSON 파싱 헬퍼
// ============================================

/**
 * LLM 응답에서 JSON 추출
 */
export function extractJSON<T>(content: string): T | null {
  try {
    // JSON 블록 찾기 (```json ... ```)
    const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      return JSON.parse(jsonBlockMatch[1]) as T;
    }

    // 직접 JSON 파싱 시도
    const trimmed = content.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return JSON.parse(trimmed) as T;
    }

    // JSON 객체/배열 찾기
    const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]) as T;
    }

    return null;
  } catch (error) {
    console.error("JSON 파싱 실패:", error);
    return null;
  }
}

// ============================================
// 토큰 계산 (추정)
// ============================================

/**
 * 텍스트의 토큰 수 추정 (한글 고려)
 * 실제 토큰 수와 다를 수 있음
 */
export function estimateTokens(text: string): number {
  // 한글은 대략 문자당 1.5토큰, 영어는 4문자당 1토큰으로 추정
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  const otherChars = text.length - koreanChars;

  return Math.ceil(koreanChars * 1.5 + otherChars / 4);
}

/**
 * 비용 추정 (USD)
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  tier: ModelTier
): number {
  // Claude 3.5 Sonnet 기준 (2024년 가격)
  const pricing: Record<ModelTier, { input: number; output: number }> = {
    fast: { input: 0.25 / 1_000_000, output: 1.25 / 1_000_000 }, // Haiku
    standard: { input: 3 / 1_000_000, output: 15 / 1_000_000 }, // Sonnet
    advanced: { input: 3 / 1_000_000, output: 15 / 1_000_000 }, // Sonnet (same)
  };

  const price = pricing[tier];
  return inputTokens * price.input + outputTokens * price.output;
}
