// ============================================
// Phase D-4 Sprint 3 — summaryGeneration 단위 테스트.
// buildSummaryPrompt(순수) + generateTurnSummary(generateText mocked).
// ============================================

import { describe, expect, it, vi, beforeEach } from "vitest";

// generateText / rate limiter / quota tracker 모두 mock.
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: vi.fn(),
  };
});
vi.mock("@/lib/domains/plan/llm/providers/gemini", () => ({
  geminiRateLimiter: {
    execute: async <T>(fn: () => Promise<T>) => fn(),
  },
  geminiQuotaTracker: {
    recordRequest: vi.fn(),
  },
}));
vi.mock("@ai-sdk/google", () => ({
  google: (id: string) => ({ id }),
}));

import { generateText } from "ai";
import {
  buildSummaryPrompt,
  generateTurnSummary,
} from "../summaryGeneration";

type Turn = { content: string; createdAt: string };

beforeEach(() => {
  vi.mocked(generateText).mockReset();
});

function turn(content: string, createdAt: string): Turn {
  return { content, createdAt };
}

describe("buildSummaryPrompt", () => {
  it("빈 배열이면 빈 문자열", () => {
    expect(buildSummaryPrompt([])).toBe("");
  });

  it("턴 본문이 포함되고 시간 prefix 부착", () => {
    const out = buildSummaryPrompt([
      turn("사용자: 안녕\n\n어시스턴트: 네", "2026-04-22T09:00:00Z"),
    ]);
    expect(out).toContain("[요약]");
    expect(out).toContain("사용자: 안녕");
    expect(out).toContain("2026-04-22 09:00");
  });

  it("여러 턴을 시간순으로 유지", () => {
    const out = buildSummaryPrompt([
      turn("T1", "2026-04-22T09:00:00Z"),
      turn("T2", "2026-04-22T09:10:00Z"),
      turn("T3", "2026-04-22T09:20:00Z"),
    ]);
    expect(out.indexOf("T1")).toBeLessThan(out.indexOf("T2"));
    expect(out.indexOf("T2")).toBeLessThan(out.indexOf("T3"));
  });

  it("예산 초과 시 오래된 턴부터 drop (최근 턴 보존)", () => {
    const huge = "x".repeat(4000);
    const turns = [
      turn(huge + "_OLD", "2026-04-22T09:00:00Z"),
      turn(huge + "_MID", "2026-04-22T09:10:00Z"),
      turn(huge + "_NEW", "2026-04-22T09:20:00Z"),
    ];
    const out = buildSummaryPrompt(turns);
    // 최근(_NEW)은 반드시 포함. 오래된 것(_OLD) 은 예산 초과로 제거될 수 있음.
    expect(out).toContain("_NEW");
    expect(out.length).toBeLessThan(14_000);
  });

  it("규칙 헤더 포함 — 수치 유지 원칙", () => {
    const out = buildSummaryPrompt([
      turn("T1", "2026-04-22T09:00:00Z"),
    ]);
    expect(out).toContain("수치(성적·점수·과목명)는 정확히 유지");
  });
});

describe("generateTurnSummary", () => {
  it("빈 turns → ok:false", async () => {
    const result = await generateTurnSummary([]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no-turns");
    expect(vi.mocked(generateText)).not.toHaveBeenCalled();
  });

  it("generateText 성공 시 summary 반환", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "• bullet 1\n• bullet 2",
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await generateTurnSummary([
      turn("사용자: 성적\n\n어시스턴트: 92점", "2026-04-22T09:00:00Z"),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).toContain("bullet 1");
    }
  });

  it("응답 텍스트가 너무 짧으면 empty-response", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "짧",
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await generateTurnSummary([
      turn("사용자: q\n\n어시스턴트: a", "2026-04-22T09:00:00Z"),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty-response");
  });

  it("generateText throw → reason=llm-error", async () => {
    vi.mocked(generateText).mockRejectedValueOnce(
      new Error("rate limit exceeded"),
    );
    const result = await generateTurnSummary([
      turn("사용자: q\n\n어시스턴트: a", "2026-04-22T09:00:00Z"),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("llm-error");
  });

  it("응답 텍스트가 MAX_SUMMARY_CHARS 초과 시 잘림", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "a".repeat(10_000),
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await generateTurnSummary([
      turn("사용자: q\n\n어시스턴트: a", "2026-04-22T09:00:00Z"),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary!.length).toBeLessThanOrEqual(4_000);
    }
  });
});
