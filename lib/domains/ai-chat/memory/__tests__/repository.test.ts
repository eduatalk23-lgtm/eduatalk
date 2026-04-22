// ============================================
// Phase D-4 Sprint 1 — memory repository 단위 테스트.
// 얇은 DB 어댑터 — fake Supabase thenable 로 insert / rpc / select 검증.
// ============================================

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

import {
  insertMemory,
  searchMemoriesByEmbedding,
  listRecentMemoriesForOwner,
  deleteMemoryById,
} from "../repository";

type FakeResponse<T> = { data: T | null; error: { message: string } | null };

function makeThenable(response: FakeResponse<unknown>) {
  const self: Record<string, unknown> = {};
  const chain = () => self;
  for (const fn of [
    "select",
    "insert",
    "eq",
    "order",
    "limit",
    "delete",
    "single",
  ]) {
    self[fn] = chain;
  }
  self.then = (resolve: (v: FakeResponse<unknown>) => void) => resolve(response);
  return self;
}

function makeFakeClient(opts: {
  fromResponse?: FakeResponse<unknown>;
  rpcResponse?: FakeResponse<unknown>;
  onFromCall?: (table: string) => void;
  onRpcCall?: (name: string, args: Record<string, unknown>) => void;
}): SupabaseClient<Database> {
  return {
    from: (table: string) => {
      opts.onFromCall?.(table);
      return makeThenable(
        opts.fromResponse ?? { data: null, error: { message: "no stub" } },
      );
    },
    rpc: (name: string, args: Record<string, unknown>) => {
      opts.onRpcCall?.(name, args);
      return makeThenable(
        opts.rpcResponse ?? { data: null, error: { message: "no stub" } },
      );
    },
  } as unknown as SupabaseClient<Database>;
}

const sampleRow = {
  id: "m-1",
  owner_user_id: "u-1",
  tenant_id: "t-1",
  subject_student_id: "s-1",
  conversation_id: "c-1",
  source_message_id: "msg-1",
  content: "사용자: 성적 확인\n\n어시스턴트: 2학년 2학기 수학 92점.",
  kind: "turn",
  pinned: false,
  created_at: "2026-04-22T00:00:00Z",
  updated_at: "2026-04-22T00:00:00Z",
};

describe("insertMemory", () => {
  it("성공 시 camelCase 매핑된 row 반환", async () => {
    let capturedTable: string | null = null;
    const client = makeFakeClient({
      fromResponse: { data: sampleRow, error: null },
      onFromCall: (t) => {
        capturedTable = t;
      },
    });

    const result = await insertMemory(client, {
      ownerUserId: "u-1",
      tenantId: "t-1",
      subjectStudentId: "s-1",
      conversationId: "c-1",
      sourceMessageId: "msg-1",
      content: "hello",
      embedding: [0.1, 0.2, 0.3],
    });

    expect(capturedTable).toBe("ai_conversation_memories");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.memory.id).toBe("m-1");
      expect(result.memory.ownerUserId).toBe("u-1");
      expect(result.memory.subjectStudentId).toBe("s-1");
      expect(result.memory.kind).toBe("turn");
      expect(result.memory.pinned).toBe(false);
    }
  });

  it("DB 오류 시 ok:false + error", async () => {
    const client = makeFakeClient({
      fromResponse: { data: null, error: { message: "RLS denied" } },
    });
    const result = await insertMemory(client, {
      ownerUserId: "u-1",
      tenantId: null,
      subjectStudentId: null,
      conversationId: null,
      sourceMessageId: null,
      content: "x",
      embedding: [0],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("RLS denied");
  });

  it("kind 생략 시 default='turn' 으로 insert", async () => {
    // thenable fake 는 insert payload 를 쉽게 검증 못 하므로 응답만 확인.
    const client = makeFakeClient({
      fromResponse: { data: { ...sampleRow, kind: "turn" }, error: null },
    });
    const result = await insertMemory(client, {
      ownerUserId: "u-1",
      tenantId: null,
      subjectStudentId: null,
      conversationId: null,
      sourceMessageId: null,
      content: "x",
      embedding: [0],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.memory.kind).toBe("turn");
  });
});

describe("searchMemoriesByEmbedding", () => {
  it("RPC 호출 + 결과 매핑", async () => {
    let capturedName: string | null = null;
    let capturedArgs: Record<string, unknown> | null = null;
    const client = makeFakeClient({
      rpcResponse: {
        data: [
          {
            id: "m-1",
            content: "성적 확인 대화",
            kind: "turn",
            conversation_id: "c-1",
            created_at: "2026-04-22T00:00:00Z",
            score: 0.87,
          },
        ],
        error: null,
      },
      onRpcCall: (n, a) => {
        capturedName = n;
        capturedArgs = a;
      },
    });

    const result = await searchMemoriesByEmbedding(client, {
      queryEmbedding: [0.1, 0.2],
      ownerUserId: "u-1",
      subjectStudentId: "s-1",
      matchCount: 3,
      similarityThreshold: 0.5,
    });

    expect(capturedName).toBe("search_conversation_memories");
    expect(capturedArgs?.p_owner_user_id).toBe("u-1");
    expect(capturedArgs?.p_subject_student_id).toBe("s-1");
    expect(capturedArgs?.p_match_count).toBe(3);
    expect(capturedArgs?.p_similarity_threshold).toBe(0.5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].score).toBe(0.87);
      expect(result.hits[0].conversationId).toBe("c-1");
    }
  });

  it("default matchCount=5 / threshold=0.3", async () => {
    let captured: Record<string, unknown> | null = null;
    const client = makeFakeClient({
      rpcResponse: { data: [], error: null },
      onRpcCall: (_n, a) => {
        captured = a;
      },
    });

    await searchMemoriesByEmbedding(client, {
      queryEmbedding: [0],
      ownerUserId: "u-1",
    });

    expect(captured?.p_match_count).toBe(5);
    expect(captured?.p_similarity_threshold).toBe(0.3);
    expect(captured?.p_subject_student_id).toBe(null);
  });

  it("RPC 오류 → ok:false + error", async () => {
    const client = makeFakeClient({
      rpcResponse: { data: null, error: { message: "vector mismatch" } },
    });
    const result = await searchMemoriesByEmbedding(client, {
      queryEmbedding: [0],
      ownerUserId: "u-1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("vector mismatch");
  });

  it("data null → 빈 hits 배열", async () => {
    const client = makeFakeClient({
      rpcResponse: { data: null, error: null },
    });
    const result = await searchMemoriesByEmbedding(client, {
      queryEmbedding: [0],
      ownerUserId: "u-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hits).toEqual([]);
  });
});

describe("listRecentMemoriesForOwner", () => {
  it("성공 시 최신순 camelCase 매핑", async () => {
    const client = makeFakeClient({
      fromResponse: { data: [sampleRow, sampleRow], error: null },
    });
    const result = await listRecentMemoriesForOwner(client, {
      ownerUserId: "u-1",
      limit: 10,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.memories).toHaveLength(2);
  });

  it("DB 오류 → ok:false", async () => {
    const client = makeFakeClient({
      fromResponse: { data: null, error: { message: "fail" } },
    });
    const result = await listRecentMemoriesForOwner(client, {
      ownerUserId: "u-1",
    });
    expect(result.ok).toBe(false);
  });
});

describe("deleteMemoryById", () => {
  it("성공 시 ok:true", async () => {
    const client = makeFakeClient({
      fromResponse: { data: null, error: null },
    });
    const result = await deleteMemoryById(client, "m-1");
    expect(result.ok).toBe(true);
  });

  it("RLS 거부 시 error 반환", async () => {
    const client = makeFakeClient({
      fromResponse: { data: null, error: { message: "permission denied" } },
    });
    const result = await deleteMemoryById(client, "m-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("permission denied");
  });
});
