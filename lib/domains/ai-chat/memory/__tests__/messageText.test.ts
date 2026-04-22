// ============================================
// Phase D-4 Sprint 2 — UIMessage 텍스트 추출 유틸.
// ============================================

import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";

import {
  extractLastTurn,
  extractLastUserText,
  extractTextFromMessage,
} from "../messageText";

function msg(
  role: "user" | "assistant",
  parts: Array<Record<string, unknown>>,
  id = "m",
): UIMessage {
  return { id, role, parts } as unknown as UIMessage;
}

describe("extractTextFromMessage", () => {
  it("text 파트만 모아 join", () => {
    const m = msg("assistant", [
      { type: "text", text: "첫 줄" },
      { type: "tool-getScores", state: "output-available" },
      { type: "text", text: "두 번째 줄" },
    ]);
    expect(extractTextFromMessage(m)).toBe("첫 줄\n두 번째 줄");
  });

  it("text 파트 없음 → 빈 문자열", () => {
    const m = msg("assistant", [
      { type: "tool-getScores", state: "input-available" },
    ]);
    expect(extractTextFromMessage(m)).toBe("");
  });

  it("parts 누락 → 빈 문자열", () => {
    const m = {
      id: "x",
      role: "user",
      parts: undefined as unknown as UIMessage["parts"],
    } as UIMessage;
    expect(extractTextFromMessage(m)).toBe("");
  });

  it("타입 불일치 파트는 스킵", () => {
    const m = msg("user", [
      { type: "text", text: 123 }, // text 필드가 string 아님
      { type: "text", text: "정상" },
    ]);
    expect(extractTextFromMessage(m)).toBe("정상");
  });
});

describe("extractLastUserText", () => {
  it("마지막 user 텍스트 반환", () => {
    const messages: UIMessage[] = [
      msg("user", [{ type: "text", text: "A" }], "1"),
      msg("assistant", [{ type: "text", text: "B" }], "2"),
      msg("user", [{ type: "text", text: "C" }], "3"),
    ];
    expect(extractLastUserText(messages)).toBe("C");
  });

  it("user 없으면 빈 문자열", () => {
    const messages: UIMessage[] = [
      msg("assistant", [{ type: "text", text: "hi" }]),
    ];
    expect(extractLastUserText(messages)).toBe("");
  });
});

describe("extractLastTurn", () => {
  it("마지막 user + 뒤따르는 assistant 합본", () => {
    const messages: UIMessage[] = [
      msg("user", [{ type: "text", text: "이전" }], "1"),
      msg("assistant", [{ type: "text", text: "응답1" }], "2"),
      msg("user", [{ type: "text", text: "성적 보여줘" }], "3"),
      msg("assistant", [{ type: "text", text: "2학년 92점." }], "4"),
    ];
    const r = extractLastTurn(messages);
    expect(r.userText).toBe("성적 보여줘");
    expect(r.assistantText).toBe("2학년 92점.");
    expect(r.lastAssistantId).toBe("4");
  });

  it("user 뒤에 assistant 없음 → assistantText 빈 값", () => {
    const messages: UIMessage[] = [
      msg("user", [{ type: "text", text: "hello" }], "1"),
    ];
    const r = extractLastTurn(messages);
    expect(r.userText).toBe("hello");
    expect(r.assistantText).toBe("");
    expect(r.lastAssistantId).toBeNull();
  });

  it("user 전혀 없음 → 모두 비어 있음", () => {
    const messages: UIMessage[] = [
      msg("assistant", [{ type: "text", text: "opener" }], "1"),
    ];
    const r = extractLastTurn(messages);
    expect(r.userText).toBe("");
    expect(r.assistantText).toBe("");
    expect(r.lastAssistantId).toBeNull();
  });

  it("user 이후 assistant 여러 개 → 모두 이어붙이고 마지막 id 선택", () => {
    const messages: UIMessage[] = [
      msg("user", [{ type: "text", text: "Q" }], "1"),
      msg("assistant", [{ type: "text", text: "A1" }], "2"),
      msg("assistant", [{ type: "text", text: "A2" }], "3"),
    ];
    const r = extractLastTurn(messages);
    expect(r.userText).toBe("Q");
    expect(r.assistantText).toBe("A1\n\nA2");
    expect(r.lastAssistantId).toBe("3");
  });
});
