/**
 * Phase D-4 Sprint 2: UIMessage → 텍스트 추출 유틸.
 *
 * tool call·tool result·reasoning 등 비텍스트 파트는 embedding 의미가
 * 떨어지므로 제외하고, `type:"text"` 만 합친다.
 */

import type { UIMessage } from "ai";

export function extractTextFromMessage(message: UIMessage): string {
  const parts = Array.isArray(message.parts) ? message.parts : [];
  const texts: string[] = [];
  for (const p of parts) {
    if (
      typeof p === "object" &&
      p !== null &&
      (p as { type?: unknown }).type === "text" &&
      typeof (p as { text?: unknown }).text === "string"
    ) {
      texts.push((p as { text: string }).text);
    }
  }
  return texts.join("\n").trim();
}

/**
 * 메시지 배열에서 마지막 user 메시지의 텍스트를 반환. 없으면 빈 문자열.
 * route.ts 전단 주입 경로에서 사용.
 */
export function extractLastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return extractTextFromMessage(messages[i]);
    }
  }
  return "";
}

/**
 * 마지막 user 와 그 뒤에 이어지는 assistant 묶음을 하나의 "턴" 으로 추출.
 * saveTurnMemory 훅에서 finalMessages 로부터 방금 완료된 턴을 식별할 때 사용.
 */
export function extractLastTurn(messages: UIMessage[]): {
  userText: string;
  assistantText: string;
  lastAssistantId: string | null;
} {
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) {
    return { userText: "", assistantText: "", lastAssistantId: null };
  }

  const userText = extractTextFromMessage(messages[lastUserIdx]);
  const assistantMsgs = messages
    .slice(lastUserIdx + 1)
    .filter((m) => m.role === "assistant");
  const assistantText = assistantMsgs
    .map(extractTextFromMessage)
    .filter((t) => t.length > 0)
    .join("\n\n");
  const lastAssistantId =
    assistantMsgs.length > 0
      ? assistantMsgs[assistantMsgs.length - 1].id ?? null
      : null;

  return { userText, assistantText, lastAssistantId };
}
