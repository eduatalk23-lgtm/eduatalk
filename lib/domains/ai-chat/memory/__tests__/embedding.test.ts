// ============================================
// Phase D-4 Sprint 1 — embedding util 단위 테스트.
// embed 호출과 rate limiter 연계를 mock 으로 검증. 실제 LLM 호출 없음.
// ============================================

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    embed: vi.fn(),
  };
});
vi.mock("@ai-sdk/google", () => ({
  google: {
    textEmbeddingModel: vi.fn(() => ({ __mock: "model" })),
  },
}));
vi.mock("@/lib/domains/plan/llm/providers/gemini", () => ({
  geminiRateLimiter: {
    execute: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  },
  geminiQuotaTracker: {
    recordRequest: vi.fn(),
  },
}));

import { embed } from "ai";
import {
  buildTurnMemoryText,
  createMemoryEmbedding,
  MEMORY_EMBEDDING_DIM,
  MEMORY_EMBEDDING_MODEL,
} from "../embedding";
import {
  geminiRateLimiter,
  geminiQuotaTracker,
} from "@/lib/domains/plan/llm/providers/gemini";

describe("buildTurnMemoryText", () => {
  it("user + assistant 합본 — 라벨 포함", () => {
    const text = buildTurnMemoryText({
      userText: "김세린 성적 보여줘",
      assistantText: "2학년 2학기 수학 92점입니다.",
    });
    expect(text).toContain("사용자: 김세린 성적 보여줘");
    expect(text).toContain("어시스턴트: 2학년 2학기 수학 92점입니다.");
  });

  it("한쪽 공백 → 그 파트 생략", () => {
    const t1 = buildTurnMemoryText({ userText: "x", assistantText: "" });
    expect(t1).toContain("사용자: x");
    expect(t1).not.toContain("어시스턴트");

    const t2 = buildTurnMemoryText({ userText: "   ", assistantText: "a" });
    expect(t2).toContain("어시스턴트: a");
    expect(t2).not.toContain("사용자:");
  });

  it("양쪽 모두 공백 → 빈 문자열", () => {
    const text = buildTurnMemoryText({ userText: "", assistantText: " " });
    expect(text).toBe("");
  });

  it("8000자 초과 → 잘림", () => {
    const long = "가".repeat(5000);
    const text = buildTurnMemoryText({ userText: long, assistantText: long });
    expect(text.length).toBeLessThanOrEqual(8000);
  });
});

describe("createMemoryEmbedding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("정상 텍스트 → embedding 배열 반환 + quota tracker 호출", async () => {
    vi.mocked(embed).mockResolvedValueOnce({
      embedding: new Array(MEMORY_EMBEDDING_DIM).fill(0.1),
    } as unknown as Awaited<ReturnType<typeof embed>>);

    const result = await createMemoryEmbedding("의미 있는 대화 내용");

    expect(result).not.toBeNull();
    expect(result).toHaveLength(MEMORY_EMBEDDING_DIM);
    expect(geminiRateLimiter.execute).toHaveBeenCalledTimes(1);
    expect(geminiQuotaTracker.recordRequest).toHaveBeenCalledTimes(1);
  });

  it("너무 짧은 텍스트 → null (embed 호출 안 함)", async () => {
    const r1 = await createMemoryEmbedding("");
    const r2 = await createMemoryEmbedding("짧");
    const r3 = await createMemoryEmbedding("  짧  ");
    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(r3).toBeNull();
    expect(embed).not.toHaveBeenCalled();
  });

  it("embed 실패 시 throw (호출자가 try/catch 책임)", async () => {
    vi.mocked(embed).mockRejectedValueOnce(new Error("rate limited"));
    await expect(
      createMemoryEmbedding("정상 길이 텍스트 입니다"),
    ).rejects.toThrow("rate limited");
  });

  it("모델/옵션 정확히 전달 (gemini 768)", async () => {
    vi.mocked(embed).mockResolvedValueOnce({
      embedding: new Array(MEMORY_EMBEDDING_DIM).fill(0),
    } as unknown as Awaited<ReturnType<typeof embed>>);

    await createMemoryEmbedding("정상 길이 텍스트 입니다");

    const { google } = await import("@ai-sdk/google");
    expect(google.textEmbeddingModel).toHaveBeenCalledWith(MEMORY_EMBEDDING_MODEL);

    const arg = vi.mocked(embed).mock.calls[0][0] as Record<string, unknown>;
    expect(arg.providerOptions).toEqual({
      google: { outputDimensionality: MEMORY_EMBEDDING_DIM },
    });
  });
});
