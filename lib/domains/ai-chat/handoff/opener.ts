/**
 * Phase T-4 템플릿 선공 assistant 메시지 빌더
 *
 * LLM 호출 0. 정적 템플릿 보간만 사용.
 * UIMessage 스키마에 직접 삽입되는 형태로 반환.
 *
 * 메시지 구조:
 * - parts[0]: type="text" — openerTemplate 치환된 한국어 한 줄
 * - suggestionChips: ChatShell이 별도 렌더 (from별 4개)
 */

import { randomUUID } from "node:crypto";
import type { UIMessage } from "ai";
import type { HandoffSource, HandoffSeed } from "./sources";
import type { HandoffResolved } from "./validator";

export type HandoffOpenerResult = {
  assistantMessage: UIMessage;
  suggestionChips: readonly HandoffSeed[];
};

function interpolate(template: string, slots: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => slots[key] ?? "");
}

function cleanupText(text: string): string {
  // 연속 공백·콤마 앞 공백 등 정리
  return text
    .replace(/\s+/g, " ")
    .replace(/\s([.,?!])/g, "$1")
    .trim();
}

export function buildHandoffOpener(
  source: HandoffSource,
  resolved: HandoffResolved,
): HandoffOpenerResult {
  const rawText = interpolate(source.openerTemplate, resolved.openerSlots);
  const text = cleanupText(rawText);

  const assistantMessage: UIMessage = {
    id: randomUUID(),
    role: "assistant",
    parts: [{ type: "text", text }],
  } as UIMessage;

  return {
    assistantMessage,
    suggestionChips: source.seeds,
  };
}
