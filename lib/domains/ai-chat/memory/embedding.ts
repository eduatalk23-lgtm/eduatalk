/**
 * Phase D-4 Sprint 1: 대화 기억용 embedding 생성.
 *
 * guide `embedding-service.ts` 와 동일 모델/차원(Gemini gemini-embedding-2-preview 768d).
 * Rate limiter · quota tracker 공유.
 *
 * 책임: 텍스트 → 768 차원 float[] 변환. DB 저장·검색은 repository 담당.
 */

import { embed } from "ai";
import { google } from "@ai-sdk/google";
import {
  geminiRateLimiter,
  geminiQuotaTracker,
} from "@/lib/domains/plan/llm/providers/gemini";

export const MEMORY_EMBEDDING_MODEL = "gemini-embedding-2-preview";
export const MEMORY_EMBEDDING_DIM = 768;

/** Gemini 토큰 한도 대비 안전 마진. */
const MAX_INPUT_CHARS = 8000;

const EMBED_PROVIDER_OPTIONS = {
  google: { outputDimensionality: MEMORY_EMBEDDING_DIM },
};

/**
 * user + assistant 한 쌍을 하나의 기억 텍스트로 합친다.
 * tool 호출 결과 등 비텍스트 파트는 제외(원문 텍스트만 embedding 의미 있음).
 */
export function buildTurnMemoryText(args: {
  userText: string;
  assistantText: string;
}): string {
  const u = args.userText.trim();
  const a = args.assistantText.trim();
  const parts: string[] = [];
  if (u) parts.push(`사용자: ${u}`);
  if (a) parts.push(`어시스턴트: ${a}`);
  return parts.join("\n\n").slice(0, MAX_INPUT_CHARS);
}

/**
 * 단일 텍스트를 embedding vector 로 변환. rate-limited.
 * 입력이 비었거나 너무 짧으면 null 반환(호출자가 skip).
 */
export async function createMemoryEmbedding(
  text: string,
): Promise<number[] | null> {
  const trimmed = text.trim();
  if (trimmed.length < 5) return null;
  const input = trimmed.slice(0, MAX_INPUT_CHARS);

  const { embedding } = await geminiRateLimiter.execute(async () => {
    return embed({
      model: google.textEmbeddingModel(MEMORY_EMBEDDING_MODEL),
      value: input,
      providerOptions: EMBED_PROVIDER_OPTIONS,
    });
  });
  geminiQuotaTracker.recordRequest();

  return embedding;
}
