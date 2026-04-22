// ============================================
// Phase D-4 Sprint 3 — maybeSummarizeConversation 단위 테스트.
// repository / summaryGeneration / embedding 전부 mock.
// 트리거 조건·실패 분기·insert 경로를 전부 검증.
// ============================================

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

vi.mock("../repository", () => ({
  findLatestSummary: vi.fn(),
  countTurnMemoriesInConversation: vi.fn(),
  listTurnMemoriesSince: vi.fn(),
  insertMemory: vi.fn(),
}));
vi.mock("../summaryGeneration", () => ({
  generateTurnSummary: vi.fn(),
}));
vi.mock("../embedding", () => ({
  createMemoryEmbedding: vi.fn(),
}));

import {
  findLatestSummary,
  countTurnMemoriesInConversation,
  listTurnMemoriesSince,
  insertMemory,
} from "../repository";
import { generateTurnSummary } from "../summaryGeneration";
import { createMemoryEmbedding } from "../embedding";
import {
  maybeSummarizeConversation,
  MIN_TURNS_FOR_SUMMARY,
  MIN_NEW_TURNS_SINCE_LAST_SUMMARY,
} from "../summarizeConversation";

const fakeClient = {} as unknown as SupabaseClient<Database>;

function baseArgs() {
  return {
    supabase: fakeClient,
    conversationId: "c-1",
    ownerUserId: "u-1",
    tenantId: "t-1" as string | null,
    subjectStudentId: null as string | null,
  };
}

function turn(id: string) {
  return {
    id,
    ownerUserId: "u-1",
    tenantId: "t-1",
    subjectStudentId: null,
    conversationId: "c-1",
    sourceMessageId: null,
    content: `사용자: q${id}\n\n어시스턴트: a${id}`,
    kind: "turn" as const,
    pinned: false,
    createdAt: "2026-04-22T09:00:00Z",
    updatedAt: "2026-04-22T09:00:00Z",
  };
}

beforeEach(() => {
  vi.mocked(findLatestSummary).mockReset();
  vi.mocked(countTurnMemoriesInConversation).mockReset();
  vi.mocked(listTurnMemoriesSince).mockReset();
  vi.mocked(insertMemory).mockReset();
  vi.mocked(generateTurnSummary).mockReset();
  vi.mocked(createMemoryEmbedding).mockReset();
});

describe("maybeSummarizeConversation — 조건 스킵", () => {
  it("총 turn 수 < 10 → below-total-turn-threshold", async () => {
    vi.mocked(countTurnMemoriesInConversation).mockResolvedValueOnce({
      ok: true,
      count: MIN_TURNS_FOR_SUMMARY - 1,
    });
    const result = await maybeSummarizeConversation(baseArgs());
    expect(result.ok).toBe(true);
    if (result.ok && !result.summarized) {
      expect(result.reason).toBe("below-total-turn-threshold");
    }
    expect(findLatestSummary).not.toHaveBeenCalled();
    expect(generateTurnSummary).not.toHaveBeenCalled();
  });

  it("새 turn 수 < 5 → below-new-turn-threshold", async () => {
    vi.mocked(countTurnMemoriesInConversation).mockResolvedValueOnce({
      ok: true,
      count: 20,
    });
    vi.mocked(findLatestSummary).mockResolvedValueOnce({
      ok: true,
      summary: {
        ...turn("prev-sum"),
        kind: "summary",
      },
    });
    vi.mocked(listTurnMemoriesSince).mockResolvedValueOnce({
      ok: true,
      turns: Array.from(
        { length: MIN_NEW_TURNS_SINCE_LAST_SUMMARY - 1 },
        (_, i) => turn(`t${i}`),
      ),
    });
    const result = await maybeSummarizeConversation(baseArgs());
    expect(result.ok).toBe(true);
    if (result.ok && !result.summarized) {
      expect(result.reason).toBe("below-new-turn-threshold");
    }
    expect(generateTurnSummary).not.toHaveBeenCalled();
  });
});

describe("maybeSummarizeConversation — 실패 분기", () => {
  beforeEach(() => {
    vi.mocked(countTurnMemoriesInConversation).mockResolvedValue({
      ok: true,
      count: 12,
    });
    vi.mocked(findLatestSummary).mockResolvedValue({
      ok: true,
      summary: null,
    });
    vi.mocked(listTurnMemoriesSince).mockResolvedValue({
      ok: true,
      turns: [turn("a"), turn("b"), turn("c"), turn("d"), turn("e")],
    });
  });

  it("LLM 실패 시 reason 전파(ok:true, summarized:false)", async () => {
    vi.mocked(generateTurnSummary).mockResolvedValueOnce({
      ok: false,
      reason: "llm-error: rate limit",
    });
    const result = await maybeSummarizeConversation(baseArgs());
    expect(result.ok).toBe(true);
    if (result.ok && !result.summarized) {
      expect(result.reason).toContain("llm-error");
    }
    expect(createMemoryEmbedding).not.toHaveBeenCalled();
  });

  it("embedding null 이면 embedding-skipped", async () => {
    vi.mocked(generateTurnSummary).mockResolvedValueOnce({
      ok: true,
      summary: "• bullet",
    });
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce(null);
    const result = await maybeSummarizeConversation(baseArgs());
    expect(result.ok).toBe(true);
    if (result.ok && !result.summarized) {
      expect(result.reason).toBe("embedding-skipped");
    }
    expect(insertMemory).not.toHaveBeenCalled();
  });

  it("embedding throw → ok:false + error", async () => {
    vi.mocked(generateTurnSummary).mockResolvedValueOnce({
      ok: true,
      summary: "• bullet",
    });
    vi.mocked(createMemoryEmbedding).mockRejectedValueOnce(
      new Error("embed fail"),
    );
    const result = await maybeSummarizeConversation(baseArgs());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("embed fail");
  });

  it("insertMemory 실패 → ok:false + error 전파", async () => {
    vi.mocked(generateTurnSummary).mockResolvedValueOnce({
      ok: true,
      summary: "• bullet",
    });
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce([0.1, 0.2]);
    vi.mocked(insertMemory).mockResolvedValueOnce({
      ok: false,
      error: "RLS denied",
    });
    const result = await maybeSummarizeConversation(baseArgs());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("RLS denied");
  });
});

describe("maybeSummarizeConversation — 성공 경로", () => {
  it("모든 단계 통과 → summarized:true + kind='summary' insert", async () => {
    vi.mocked(countTurnMemoriesInConversation).mockResolvedValueOnce({
      ok: true,
      count: 15,
    });
    vi.mocked(findLatestSummary).mockResolvedValueOnce({
      ok: true,
      summary: null,
    });
    const turns = [
      turn("a"),
      turn("b"),
      turn("c"),
      turn("d"),
      turn("e"),
      turn("f"),
    ];
    vi.mocked(listTurnMemoriesSince).mockResolvedValueOnce({
      ok: true,
      turns,
    });
    vi.mocked(generateTurnSummary).mockResolvedValueOnce({
      ok: true,
      summary: "• 핵심1\n• 핵심2",
    });
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce(
      new Array(768).fill(0.01),
    );
    vi.mocked(insertMemory).mockResolvedValueOnce({
      ok: true,
      memory: {
        ...turn("sum-new"),
        kind: "summary",
        content: "• 핵심1\n• 핵심2",
      },
    });

    const result = await maybeSummarizeConversation(baseArgs());
    expect(result.ok).toBe(true);
    if (result.ok && result.summarized) {
      expect(result.memoryId).toBe("sum-new");
      expect(result.turnCount).toBe(turns.length);
    }

    // insertMemory 가 kind='summary' 로 호출됐는지
    const call = vi.mocked(insertMemory).mock.calls[0];
    expect(call[1].kind).toBe("summary");
    expect(call[1].conversationId).toBe("c-1");
    expect(call[1].sourceMessageId).toBeNull();
  });

  it("이전 summary 있으면 그 createdAt 이 sinceIso 로 전달", async () => {
    vi.mocked(countTurnMemoriesInConversation).mockResolvedValueOnce({
      ok: true,
      count: 20,
    });
    vi.mocked(findLatestSummary).mockResolvedValueOnce({
      ok: true,
      summary: {
        ...turn("prev-sum"),
        kind: "summary",
        createdAt: "2026-04-22T08:00:00Z",
      },
    });
    vi.mocked(listTurnMemoriesSince).mockResolvedValueOnce({
      ok: true,
      turns: Array.from({ length: 6 }, (_, i) => turn(`n${i}`)),
    });
    vi.mocked(generateTurnSummary).mockResolvedValueOnce({
      ok: true,
      summary: "• ok",
    });
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce([0.1]);
    vi.mocked(insertMemory).mockResolvedValueOnce({
      ok: true,
      memory: { ...turn("sum-2"), kind: "summary" },
    });

    await maybeSummarizeConversation(baseArgs());
    const listCall = vi.mocked(listTurnMemoriesSince).mock.calls[0];
    expect(listCall[1].sinceIso).toBe("2026-04-22T08:00:00Z");
  });
});

describe("maybeSummarizeConversation — repository 에러 전파", () => {
  it("count 에러 → ok:false", async () => {
    vi.mocked(countTurnMemoriesInConversation).mockResolvedValueOnce({
      ok: false,
      error: "db down",
    });
    const result = await maybeSummarizeConversation(baseArgs());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("db down");
  });

  it("findLatestSummary 에러 → ok:false", async () => {
    vi.mocked(countTurnMemoriesInConversation).mockResolvedValueOnce({
      ok: true,
      count: 20,
    });
    vi.mocked(findLatestSummary).mockResolvedValueOnce({
      ok: false,
      error: "timeout",
    });
    const result = await maybeSummarizeConversation(baseArgs());
    expect(result.ok).toBe(false);
  });
});
