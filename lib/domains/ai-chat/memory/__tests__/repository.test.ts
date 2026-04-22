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
  listMemoriesForOwner,
  deleteMemoryById,
  updateMemoryContent,
  togglePinMemoryById,
  countMemoriesByKind,
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
    "update",
    "maybeSingle",
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

describe("listMemoriesForOwner", () => {
  /** 체인 호출을 캡처하는 전용 thenable. */
  function makeCapturingThenable(
    response: FakeResponse<unknown>,
    capture: Record<string, unknown[][]>,
  ) {
    const self: Record<string, unknown> = {};
    const chain = (name: string) => (...args: unknown[]) => {
      capture[name] = capture[name] ?? [];
      capture[name].push(args);
      return self;
    };
    for (const fn of ["select", "eq", "is", "order", "limit"]) {
      self[fn] = chain(fn);
    }
    self.then = (resolve: (v: FakeResponse<unknown>) => void) =>
      resolve(response);
    return self;
  }

  function makeClientWithCapture(
    response: FakeResponse<unknown>,
    capture: Record<string, unknown[][]>,
  ): SupabaseClient<Database> {
    return {
      from: () => makeCapturingThenable(response, capture),
    } as unknown as SupabaseClient<Database>;
  }

  it("필터 없으면 owner_user_id 만 걸고 최신순 제한", async () => {
    const capture: Record<string, unknown[][]> = {};
    const client = makeClientWithCapture(
      { data: [sampleRow], error: null },
      capture,
    );
    const result = await listMemoriesForOwner(client, {
      ownerUserId: "u-1",
      limit: 20,
    });
    expect(result.ok).toBe(true);
    // owner_user_id eq 1 회만, kind/pinned 는 미호출
    expect(capture.eq).toEqual([["owner_user_id", "u-1"]]);
    expect(capture.is).toBeUndefined();
    expect(capture.order).toEqual([
      ["created_at", { ascending: false }],
    ]);
    expect(capture.limit).toEqual([[20]]);
  });

  it("kind='summary' 필터 시 eq 체인에 kind 추가", async () => {
    const capture: Record<string, unknown[][]> = {};
    const client = makeClientWithCapture(
      { data: [], error: null },
      capture,
    );
    await listMemoriesForOwner(client, {
      ownerUserId: "u-1",
      kind: "summary",
    });
    expect(capture.eq).toEqual([
      ["owner_user_id", "u-1"],
      ["kind", "summary"],
    ]);
  });

  it("subjectStudentId 문자열 시 eq, null 시 is(null)", async () => {
    // 케이스 1: 구체 학생 id
    {
      const cap: Record<string, unknown[][]> = {};
      const c = makeClientWithCapture({ data: [], error: null }, cap);
      await listMemoriesForOwner(c, {
        ownerUserId: "u-1",
        subjectStudentId: "s-9",
      });
      expect(cap.eq).toEqual([
        ["owner_user_id", "u-1"],
        ["subject_student_id", "s-9"],
      ]);
      expect(cap.is).toBeUndefined();
    }
    // 케이스 2: 명시적 null (학생 미지정 기억만)
    {
      const cap: Record<string, unknown[][]> = {};
      const c = makeClientWithCapture({ data: [], error: null }, cap);
      await listMemoriesForOwner(c, {
        ownerUserId: "u-1",
        subjectStudentId: null,
      });
      expect(cap.is).toEqual([["subject_student_id", null]]);
    }
  });

  it("pinnedOnly=true 시 pinned eq 추가", async () => {
    const capture: Record<string, unknown[][]> = {};
    const client = makeClientWithCapture(
      { data: [], error: null },
      capture,
    );
    await listMemoriesForOwner(client, {
      ownerUserId: "u-1",
      pinnedOnly: true,
    });
    expect(capture.eq).toEqual([
      ["owner_user_id", "u-1"],
      ["pinned", true],
    ]);
  });

  it("DB 오류 → ok:false 전파", async () => {
    const capture: Record<string, unknown[][]> = {};
    const client = makeClientWithCapture(
      { data: null, error: { message: "rls" } },
      capture,
    );
    const result = await listMemoriesForOwner(client, { ownerUserId: "u-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("rls");
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

describe("updateMemoryContent", () => {
  it("성공 시 ok:true", async () => {
    const client = makeFakeClient({
      fromResponse: { data: null, error: null },
    });
    const result = await updateMemoryContent(client, {
      id: "m-1",
      content: "수정된 내용",
      embedding: [0.1, 0.2],
    });
    expect(result.ok).toBe(true);
  });

  it("DB 오류 시 ok:false + error 전파", async () => {
    const client = makeFakeClient({
      fromResponse: { data: null, error: { message: "update failed" } },
    });
    const result = await updateMemoryContent(client, {
      id: "m-1",
      content: "x",
      embedding: [0],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("update failed");
  });
});

describe("togglePinMemoryById", () => {
  it("pinned=true 성공", async () => {
    const client = makeFakeClient({
      fromResponse: { data: null, error: null },
    });
    const result = await togglePinMemoryById(client, {
      id: "m-1",
      pinned: true,
    });
    expect(result.ok).toBe(true);
  });

  it("DB 오류 시 ok:false", async () => {
    const client = makeFakeClient({
      fromResponse: { data: null, error: { message: "rls" } },
    });
    const result = await togglePinMemoryById(client, {
      id: "m-1",
      pinned: false,
    });
    expect(result.ok).toBe(false);
  });
});

describe("countMemoriesByKind", () => {
  /**
   * 5건 병렬 HEAD count 쿼리를 시뮬레이션.
   * from() 호출마다 counts 배열에서 순차로 반환.
   * 순서: total → turn → summary → explicit → pinned
   * (Promise.all 순서는 정의 순서 보존이므로 JS 엔진 표준 동작에 의존)
   */
  function makeCountClient(counts: number[]): SupabaseClient<Database> {
    let idx = 0;
    return {
      from: () => {
        const current = counts[idx++] ?? 0;
        const self: Record<string, unknown> = {};
        const chain = () => self;
        for (const fn of ["select", "eq"]) self[fn] = chain;
        self.then = (
          resolve: (v: { count: number; error: null }) => void,
        ) => resolve({ count: current, error: null });
        return self;
      },
    } as unknown as SupabaseClient<Database>;
  }

  function makeErrorCountClient(errMsg: string): SupabaseClient<Database> {
    return {
      from: () => {
        const self: Record<string, unknown> = {};
        const chain = () => self;
        for (const fn of ["select", "eq"]) self[fn] = chain;
        self.then = (
          resolve: (v: { count: null; error: { message: string } }) => void,
        ) => resolve({ count: null, error: { message: errMsg } });
        return self;
      },
    } as unknown as SupabaseClient<Database>;
  }

  it("총/turn/summary/explicit/pinned 5건 count 반환", async () => {
    const client = makeCountClient([42, 20, 5, 10, 7]);
    const result = await countMemoriesByKind(client, { ownerUserId: "u-1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.counts).toEqual({
        total: 42,
        turn: 20,
        summary: 5,
        explicit: 10,
        pinned: 7,
      });
    }
  });

  it("count 가 null 인 경우 0 으로 안전 처리", async () => {
    const client = {
      from: () => {
        const self: Record<string, unknown> = {};
        const chain = () => self;
        for (const fn of ["select", "eq"]) self[fn] = chain;
        self.then = (
          resolve: (v: { count: null; error: null }) => void,
        ) => resolve({ count: null, error: null });
        return self;
      },
    } as unknown as SupabaseClient<Database>;
    const result = await countMemoriesByKind(client, { ownerUserId: "u-1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.counts.total).toBe(0);
      expect(result.counts.turn).toBe(0);
    }
  });

  it("어느 한 쿼리라도 오류면 ok:false", async () => {
    const client = makeErrorCountClient("boom");
    const result = await countMemoriesByKind(client, { ownerUserId: "u-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("boom");
  });
});
