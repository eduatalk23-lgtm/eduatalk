/**
 * Phase D-4 Sprint 3: 대화 턴 묶음 → 단일 요약 문자열.
 *
 * 트리거는 `summarizeConversation.maybeSummarizeConversation` 가 담당.
 * 이 모듈은:
 *  1. turns → 프롬프트 문자열 합성 (순수)
 *  2. Gemini Flash 로 generateText (rate-limited)
 *  3. 결과 요약 문자열 반환
 *
 * embedding 생성·DB insert 는 호출자 책임 (embedding.ts / repository.ts 경유).
 */

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import {
  geminiRateLimiter,
  geminiQuotaTracker,
} from "@/lib/domains/plan/llm/providers/gemini";

import type { ConversationMemoryRow } from "./types";

/** Flash 모델 1회 호출 기준 안전 상한. */
const MAX_OUTPUT_TOKENS = 512;
/** turn content 가 합쳐졌을 때의 입력 문자 상한. 초과 시 선두부터 잘림. */
const MAX_INPUT_CHARS = 12_000;
/** 요약 저장 시 1 memory content 에 허용되는 최대 문자 수(임베딩 보수적 마진). */
const MAX_SUMMARY_CHARS = 4_000;

/** 사용 모델. embedding 과 독립 — chat 모델이므로 Flash 고정. */
export const SUMMARY_MODEL = "gemini-2.5-flash";

/**
 * turns → 프롬프트. 순수 함수 — 테스트 용이.
 * 너무 긴 경우 **오래된 턴부터** 잘라낸다(최근 턴 보존).
 */
export function buildSummaryPrompt(
  turns: Pick<ConversationMemoryRow, "content" | "createdAt">[],
): string {
  if (turns.length === 0) return "";

  const header = [
    "다음은 같은 사용자와의 연속된 대화 턴입니다. 핵심 질문·결정·사실(학생 이름·수치·과목 등)을 짧은 bullet 8~15줄로 요약하세요.",
    "규칙:",
    "- 어시스턴트가 실제로 제시한 수치(성적·점수·과목명)는 정확히 유지.",
    "- 인사말·잡담·일반적 안내는 제외.",
    "- 한국어, 각 bullet 은 1줄 30자 내외.",
    "- 결론적 bullet 1~2줄을 마지막에 둔다.",
    "",
    "[대화 턴]",
  ].join("\n");

  // 뒤에서부터 채우면서 MAX_INPUT_CHARS 예산을 넘지 않도록.
  const pieces: string[] = [];
  let budget = MAX_INPUT_CHARS - header.length - 16;
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    const line = `--- ${t.createdAt.slice(0, 16).replace("T", " ")}\n${t.content.trim()}`;
    if (line.length + 2 > budget) break;
    pieces.unshift(line);
    budget -= line.length + 2;
  }

  return [header, ...pieces, "", "[요약]"].join("\n\n");
}

export interface GenerateSummaryResult {
  ok: boolean;
  summary?: string;
  reason?: string;
}

/**
 * Gemini Flash 호출. rate-limited. 실패는 {ok:false, reason} 로 조용히 반환.
 *
 * 주의: 이 함수는 onFinish 훅(Next.js request 종료 이후) 경로에서도 호출된다.
 * 장시간 호출은 AbortSignal.timeout 으로 방어 (기본 25초).
 */
export async function generateTurnSummary(
  turns: Pick<ConversationMemoryRow, "content" | "createdAt">[],
  opts: { timeoutMs?: number } = {},
): Promise<GenerateSummaryResult> {
  if (turns.length === 0) return { ok: false, reason: "no-turns" };
  const prompt = buildSummaryPrompt(turns);
  if (prompt.length < 20) return { ok: false, reason: "prompt-too-short" };

  const abortSignal = AbortSignal.timeout(opts.timeoutMs ?? 25_000);

  try {
    const { text } = await geminiRateLimiter.execute(async () => {
      return generateText({
        model: google(SUMMARY_MODEL),
        prompt,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.2,
        abortSignal,
      });
    });
    geminiQuotaTracker.recordRequest();

    const trimmed = (text ?? "").trim();
    if (trimmed.length < 10) return { ok: false, reason: "empty-response" };
    return { ok: true, summary: trimmed.slice(0, MAX_SUMMARY_CHARS) };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `llm-error: ${err.message}`
          : "llm-error: unknown",
    };
  }
}
