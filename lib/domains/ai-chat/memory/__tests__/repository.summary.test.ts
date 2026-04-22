// ============================================
// Phase D-4 Sprint 3 — repository 요약 쿼리 단위 테스트.
// findLatestSummary / countTurnMemoriesInConversation / listTurnMemoriesSince.
// ============================================

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

import {
  findLatestSummary,
  countTurnMemoriesInConversation,
  listTurnMemoriesSince,
} from "../repository";

/**
 * 필요한 체인 메서드를 전부 지원하는 fake thenable.
 * from().select(...).eq(...).eq(...).eq(...).order(...).limit(...) — 그리고
 * countMode 시에는 `{ count, error }` 구조로, 아니면 `{ data, error }`.
 */
function makeThenable(
  response: { data?: unknown; count?: number; error: { message: string } | null },
  capture?: Record<string, unknown[]>,
) {
  const self: Record<string, unknown> = {};
  const chain = (name: string) => (...args: unknown[]) => {
    if (capture) {
      capture[name] = capture[name] ?? [];
      (capture[name] as unknown[][]).push(args);
    }
    return self;
  };
  for (const fn of [
    "select",
    "eq",
    "gt",
    "order",
    "limit",
  ]) {
    self[fn] = chain(fn);
  }
  self.then = (
    resolve: (v: {
      data: unknown | null;
      count?: number;
      error: { message: string } | null;
    }) => void,
  ) =>
    resolve({
      data: response.data ?? null,
      count: response.count,
      error: response.error,
    });
  return self;
}

function makeFakeClient(
  response: { data?: unknown; count?: number; error: { message: string } | null },
  capture?: Record<string, unknown[]>,
): SupabaseClient<Database> {
  return {
    from: () => makeThenable(response, capture),
  } as unknown as SupabaseClient<Database>;
}

const summaryRow = {
  id: "sum-1",
  owner_user_id: "u-1",
  tenant_id: "t-1",
  subject_student_id: null,
  conversation_id: "c-1",
  source_message_id: null,
  content: "• 성적 확인 요청\n• 2학년 2학기 수학 92점",
  kind: "summary" as const,
  pinned: false,
  created_at: "2026-04-22T10:00:00Z",
  updated_at: "2026-04-22T10:00:00Z",
};

describe("findLatestSummary", () => {
  it("데이터 있으면 mapRow 된 summary 반환", async () => {
    const client = makeFakeClient({ data: [summaryRow], error: null });
    const result = await findLatestSummary(client, {
      conversationId: "c-1",
      ownerUserId: "u-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).not.toBeNull();
      expect(result.summary?.id).toBe("sum-1");
      expect(result.summary?.kind).toBe("summary");
      expect(result.summary?.conversationId).toBe("c-1");
    }
  });

  it("데이터 없으면 summary=null", async () => {
    const client = makeFakeClient({ data: [], error: null });
    const result = await findLatestSummary(client, {
      conversationId: "c-1",
      ownerUserId: "u-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.summary).toBeNull();
  });

  it("DB 오류 전파", async () => {
    const client = makeFakeClient({ error: { message: "rls denied" } });
    const result = await findLatestSummary(client, {
      conversationId: "c-1",
      ownerUserId: "u-1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("rls denied");
  });
});

describe("countTurnMemoriesInConversation", () => {
  it("count 값 반환", async () => {
    const client = makeFakeClient({ count: 12, error: null });
    const result = await countTurnMemoriesInConversation(client, {
      conversationId: "c-1",
      ownerUserId: "u-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.count).toBe(12);
  });

  it("count null 은 0", async () => {
    const client = makeFakeClient({ error: null });
    const result = await countTurnMemoriesInConversation(client, {
      conversationId: "c-1",
      ownerUserId: "u-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.count).toBe(0);
  });

  it("에러 전파", async () => {
    const client = makeFakeClient({ error: { message: "timeout" } });
    const result = await countTurnMemoriesInConversation(client, {
      conversationId: "c-1",
      ownerUserId: "u-1",
    });
    expect(result.ok).toBe(false);
  });
});

describe("listTurnMemoriesSince", () => {
  const turnRow = {
    ...summaryRow,
    id: "t-1",
    kind: "turn" as const,
    content: "사용자: q\n\n어시스턴트: a",
  };

  it("sinceIso 있을 때 gt 호출 + mapRow 결과", async () => {
    const capture: Record<string, unknown[]> = {};
    const client = makeFakeClient(
      { data: [turnRow, { ...turnRow, id: "t-2" }], error: null },
      capture,
    );
    const result = await listTurnMemoriesSince(client, {
      conversationId: "c-1",
      ownerUserId: "u-1",
      sinceIso: "2026-04-22T09:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.turns).toHaveLength(2);
      expect(result.turns[0].kind).toBe("turn");
    }
    expect(capture.gt?.length ?? 0).toBe(1);
  });

  it("sinceIso=null 이면 gt 호출 없음", async () => {
    const capture: Record<string, unknown[]> = {};
    const client = makeFakeClient({ data: [], error: null }, capture);
    const result = await listTurnMemoriesSince(client, {
      conversationId: "c-1",
      ownerUserId: "u-1",
      sinceIso: null,
    });
    expect(result.ok).toBe(true);
    expect(capture.gt).toBeUndefined();
  });

  it("DB 오류 전파", async () => {
    const client = makeFakeClient({ error: { message: "fail" } });
    const result = await listTurnMemoriesSince(client, {
      conversationId: "c-1",
      ownerUserId: "u-1",
      sinceIso: null,
    });
    expect(result.ok).toBe(false);
  });
});
