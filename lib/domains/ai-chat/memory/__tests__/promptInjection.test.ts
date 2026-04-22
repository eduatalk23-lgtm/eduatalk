// ============================================
// Phase D-4 Sprint 2 — `[관련 과거 대화]` 프롬프트 조각 생성.
// 순수 함수(renderMemorySection) + embedding·RPC mock 통합 레이어.
// ============================================

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

import {
  buildMemoryPromptSection,
  renderMemorySection,
} from "../promptInjection";
import type { MemorySearchHit } from "../types";

// ---- embedding & repository 를 module 경계에서 mock ----
vi.mock("../embedding", () => ({
  createMemoryEmbedding: vi.fn(),
}));
vi.mock("../repository", () => ({
  searchMemoriesByEmbedding: vi.fn(),
}));

import { createMemoryEmbedding } from "../embedding";
import { searchMemoriesByEmbedding } from "../repository";

const fakeClient = {} as unknown as SupabaseClient<Database>;

beforeEach(() => {
  vi.mocked(createMemoryEmbedding).mockReset();
  vi.mocked(searchMemoriesByEmbedding).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================
// renderMemorySection — 순수 함수
// ============================================================
describe("renderMemorySection", () => {
  const hit = (over: Partial<MemorySearchHit>): MemorySearchHit => ({
    id: "m-1",
    content: "사용자: 성적 어때\n\n어시스턴트: 2학년 2학기 수학 92점.",
    kind: "turn",
    conversationId: "c-1",
    createdAt: "2026-04-10T00:00:00Z",
    score: 0.8,
    ...over,
  });

  it("hits 없음 → 빈 문자열", () => {
    expect(renderMemorySection([])).toBe("");
  });

  it("헤더 + 번호 목록", () => {
    const s = renderMemorySection([hit({}), hit({ id: "m-2" })]);
    expect(s).toContain("[관련 과거 대화 — 장기 기억]");
    expect(s).toContain("- [1] (2026-04-10)");
    expect(s).toContain("- [2] (2026-04-10)");
  });

  it("content 는 whitespace 정규화 + 400자 컷", () => {
    const long = "A".repeat(500);
    const s = renderMemorySection([hit({ content: long })]);
    // 400 자만 포함, 500 자는 포함되지 않아야
    expect(s).toContain("A".repeat(400));
    expect(s).not.toContain("A".repeat(401));
  });

  it("createdAt 누락 시 'unknown'", () => {
    const s = renderMemorySection([
      hit({ createdAt: "" as unknown as string }),
    ]);
    expect(s).toContain("(unknown)");
  });
});

// ============================================================
// buildMemoryPromptSection — 통합 (embedding + search mocked)
// ============================================================
describe("buildMemoryPromptSection", () => {
  it("queryText 짧음(<5) → 빈 결과·embedding 미호출", async () => {
    const r = await buildMemoryPromptSection({
      supabase: fakeClient,
      queryText: "hi",
      ownerUserId: "u-1",
    });
    expect(r.section).toBe("");
    expect(r.usedHits).toBe(0);
    expect(createMemoryEmbedding).not.toHaveBeenCalled();
  });

  it("embedding 실패(throw) → 조용히 빈 결과", async () => {
    vi.mocked(createMemoryEmbedding).mockRejectedValueOnce(new Error("quota"));
    const r = await buildMemoryPromptSection({
      supabase: fakeClient,
      queryText: "2학년 수학 성적 어때",
      ownerUserId: "u-1",
    });
    expect(r.section).toBe("");
    expect(r.usedHits).toBe(0);
    expect(searchMemoriesByEmbedding).not.toHaveBeenCalled();
  });

  it("embedding null(짧은 입력) → 빈 결과", async () => {
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce(null);
    const r = await buildMemoryPromptSection({
      supabase: fakeClient,
      queryText: "2학년 수학 성적 어때",
      ownerUserId: "u-1",
    });
    expect(r.section).toBe("");
  });

  it("search 결과 0건 → 빈 결과", async () => {
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce([0.1, 0.2]);
    vi.mocked(searchMemoriesByEmbedding).mockResolvedValueOnce({
      ok: true,
      hits: [],
    });
    const r = await buildMemoryPromptSection({
      supabase: fakeClient,
      queryText: "2학년 수학 성적 어때",
      ownerUserId: "u-1",
    });
    expect(r.section).toBe("");
    expect(r.usedHits).toBe(0);
  });

  it("currentConversationId 와 같은 hit 은 필터링", async () => {
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce([0.1]);
    vi.mocked(searchMemoriesByEmbedding).mockResolvedValueOnce({
      ok: true,
      hits: [
        {
          id: "m-1",
          content: "같은 대화 hit",
          kind: "turn",
          conversationId: "current",
          createdAt: "2026-04-10T00:00:00Z",
          score: 0.9,
        },
        {
          id: "m-2",
          content: "다른 대화 hit",
          kind: "turn",
          conversationId: "other",
          createdAt: "2026-04-05T00:00:00Z",
          score: 0.8,
        },
      ],
    });
    const r = await buildMemoryPromptSection({
      supabase: fakeClient,
      queryText: "2학년 수학 성적 어때",
      ownerUserId: "u-1",
      currentConversationId: "current",
    });
    expect(r.usedHits).toBe(1);
    expect(r.section).toContain("다른 대화 hit");
    expect(r.section).not.toContain("같은 대화 hit");
  });

  it("성공 시 subjectStudentId 필터가 RPC 에 전달", async () => {
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce([0.5]);
    vi.mocked(searchMemoriesByEmbedding).mockResolvedValueOnce({
      ok: true,
      hits: [
        {
          id: "m-1",
          content: "학생 문맥 hit",
          kind: "turn",
          conversationId: "c-x",
          createdAt: "2026-04-01T00:00:00Z",
          score: 0.7,
        },
      ],
    });
    await buildMemoryPromptSection({
      supabase: fakeClient,
      queryText: "김세린 성적 추이",
      ownerUserId: "u-1",
      subjectStudentId: "s-1",
      matchCount: 3,
      similarityThreshold: 0.5,
    });
    expect(searchMemoriesByEmbedding).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({
        ownerUserId: "u-1",
        subjectStudentId: "s-1",
        matchCount: 3,
        similarityThreshold: 0.5,
      }),
    );
  });

  it("search RPC 실패 시 조용히 빈 결과", async () => {
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce([0.1]);
    vi.mocked(searchMemoriesByEmbedding).mockResolvedValueOnce({
      ok: false,
      error: "vector mismatch",
    });
    const r = await buildMemoryPromptSection({
      supabase: fakeClient,
      queryText: "2학년 수학 성적 어때",
      ownerUserId: "u-1",
    });
    expect(r.section).toBe("");
  });
});
