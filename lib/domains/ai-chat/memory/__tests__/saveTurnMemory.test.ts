// ============================================
// Phase D-4 Sprint 2 — saveTurnMemory 훅.
// 마지막 user + assistant 텍스트 → embedding → insertMemory 경로 검증.
// ============================================

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { UIMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

vi.mock("../embedding", () => ({
  createMemoryEmbedding: vi.fn(),
  buildTurnMemoryText: vi.fn(),
}));
vi.mock("../repository", () => ({
  insertMemory: vi.fn(),
}));

import { createMemoryEmbedding, buildTurnMemoryText } from "../embedding";
import { insertMemory } from "../repository";
import { saveTurnMemory } from "../saveTurnMemory";

function msg(
  role: "user" | "assistant",
  text: string,
  id = "m",
): UIMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
  } as unknown as UIMessage;
}

const fakeClient = {} as unknown as SupabaseClient<Database>;

beforeEach(() => {
  vi.mocked(createMemoryEmbedding).mockReset();
  vi.mocked(buildTurnMemoryText).mockReset();
  vi.mocked(insertMemory).mockReset();
  // 기본값: buildTurnMemoryText 는 user+assistant 를 평범히 합친다
  vi.mocked(buildTurnMemoryText).mockImplementation(
    (a) => `사용자: ${a.userText}\n\n어시스턴트: ${a.assistantText}`,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("saveTurnMemory", () => {
  it("user 없음 → inserted=false (embedding 미호출)", async () => {
    const r = await saveTurnMemory({
      supabase: fakeClient,
      messages: [msg("assistant", "opener", "1")],
      ownerUserId: "u-1",
      tenantId: "t-1",
      subjectStudentId: null,
      conversationId: "c-1",
    });
    expect(r).toEqual({ ok: true, inserted: false, reason: "no-user-text" });
    expect(createMemoryEmbedding).not.toHaveBeenCalled();
    expect(insertMemory).not.toHaveBeenCalled();
  });

  it("합본 텍스트 짧음 → too-short 스킵", async () => {
    vi.mocked(buildTurnMemoryText).mockReturnValueOnce("ab");
    const r = await saveTurnMemory({
      supabase: fakeClient,
      messages: [msg("user", "q", "1")],
      ownerUserId: "u-1",
      tenantId: null,
      subjectStudentId: null,
      conversationId: "c-1",
    });
    expect(r).toEqual({ ok: true, inserted: false, reason: "too-short" });
    expect(createMemoryEmbedding).not.toHaveBeenCalled();
  });

  it("embedding 결과 null → embedding-skipped", async () => {
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce(null);
    const r = await saveTurnMemory({
      supabase: fakeClient,
      messages: [
        msg("user", "충분히 긴 질문입니다", "1"),
        msg("assistant", "충분히 긴 답변입니다", "2"),
      ],
      ownerUserId: "u-1",
      tenantId: null,
      subjectStudentId: null,
      conversationId: "c-1",
    });
    expect(r).toEqual({
      ok: true,
      inserted: false,
      reason: "embedding-skipped",
    });
    expect(insertMemory).not.toHaveBeenCalled();
  });

  it("embedding throw → ok:false + error", async () => {
    vi.mocked(createMemoryEmbedding).mockRejectedValueOnce(
      new Error("rate limit"),
    );
    const r = await saveTurnMemory({
      supabase: fakeClient,
      messages: [
        msg("user", "충분히 긴 질문입니다", "1"),
        msg("assistant", "충분히 긴 답변입니다", "2"),
      ],
      ownerUserId: "u-1",
      tenantId: null,
      subjectStudentId: null,
      conversationId: "c-1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("rate limit");
  });

  it("insertMemory 실패 → ok:false", async () => {
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce([0.1, 0.2]);
    vi.mocked(insertMemory).mockResolvedValueOnce({
      ok: false,
      error: "RLS denied",
    });
    const r = await saveTurnMemory({
      supabase: fakeClient,
      messages: [
        msg("user", "충분히 긴 질문입니다", "1"),
        msg("assistant", "충분히 긴 답변입니다", "2"),
      ],
      ownerUserId: "u-1",
      tenantId: null,
      subjectStudentId: null,
      conversationId: "c-1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("RLS denied");
  });

  it("성공 시 마지막 assistant id 를 sourceMessageId 로 전달", async () => {
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce([0.1, 0.2, 0.3]);
    vi.mocked(insertMemory).mockResolvedValueOnce({
      ok: true,
      memory: {
        id: "new-m",
        ownerUserId: "u-1",
        tenantId: "t-1",
        subjectStudentId: "s-1",
        conversationId: "c-1",
        sourceMessageId: "a-final",
        content: "...",
        kind: "turn",
        pinned: false,
        createdAt: "now",
        updatedAt: "now",
      },
    });

    const r = await saveTurnMemory({
      supabase: fakeClient,
      messages: [
        msg("user", "이전 질문", "u-old"),
        msg("assistant", "이전 답변", "a-old"),
        msg("user", "충분히 긴 질문입니다", "u-now"),
        msg("assistant", "충분히 긴 답변1", "a-1"),
        msg("assistant", "충분히 긴 답변2", "a-final"),
      ],
      ownerUserId: "u-1",
      tenantId: "t-1",
      subjectStudentId: "s-1",
      conversationId: "c-1",
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.inserted).toBe(true);
    expect(insertMemory).toHaveBeenCalledTimes(1);
    expect(insertMemory).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({
        ownerUserId: "u-1",
        tenantId: "t-1",
        subjectStudentId: "s-1",
        conversationId: "c-1",
        sourceMessageId: "a-final",
      }),
    );
  });

  it("assistant 없이 user 만 있을 때도 임베딩 시도 (content=user 만)", async () => {
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce([0.1]);
    vi.mocked(insertMemory).mockResolvedValueOnce({
      ok: true,
      memory: {
        id: "new-m",
        ownerUserId: "u-1",
        tenantId: null,
        subjectStudentId: null,
        conversationId: "c-1",
        sourceMessageId: null,
        content: "...",
        kind: "turn",
        pinned: false,
        createdAt: "now",
        updatedAt: "now",
      },
    });
    const r = await saveTurnMemory({
      supabase: fakeClient,
      messages: [msg("user", "충분히 긴 질문만 있음", "1")],
      ownerUserId: "u-1",
      tenantId: null,
      subjectStudentId: null,
      conversationId: "c-1",
    });
    expect(r.ok).toBe(true);
    expect(insertMemory).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({ sourceMessageId: null }),
    );
  });
});
