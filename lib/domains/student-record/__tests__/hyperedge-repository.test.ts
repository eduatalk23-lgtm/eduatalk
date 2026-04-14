// ============================================
// hyperedge-repository.ts 유닛 테스트
//
// 대상:
//   toHyperedgeRow          — HyperedgeInput → RPC payload 변환
//   findHyperedges          — SELECT 체인 검증
//   replaceHyperedges       — replace_student_record_hyperedges RPC 호출
//   insertHyperedges        — insert RPC 호출 + 빈 배열 조기 반환
//   markHyperedgesStaleByRecord — contains() 호출
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  toHyperedgeRow,
  findHyperedges,
  replaceHyperedges,
  insertHyperedges,
  markHyperedgesStaleByRecord,
  type HyperedgeInput,
  type HyperedgeMember,
} from "../repository/hyperedge-repository";

// ============================================
// 헬퍼: supabase mock
// ============================================

function buildMembers(n: number): HyperedgeMember[] {
  return Array.from({ length: n }, (_, i) => ({
    recordType: "setek",
    recordId: `rec-${i}`,
    label: `세특 ${i}`,
    grade: 1,
  }));
}

function makeSupabaseMock(opts?: {
  selectData?: unknown;
  rpcData?: unknown;
  updateData?: unknown;
}) {
  // SELECT 체인: select().eq().eq().in().order().order() → thenable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectChain: Record<string, any> = {};
  selectChain.select = vi.fn(() => selectChain);
  selectChain.eq = vi.fn(() => selectChain);
  selectChain.in = vi.fn(() => selectChain);
  selectChain.order = vi.fn(() => selectChain);
  selectChain.then = (fn: (v: unknown) => unknown) =>
    Promise.resolve(fn({ data: opts?.selectData ?? [], error: null }));

  // UPDATE 체인: update().contains().eq().select() → Promise
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateChain: Record<string, any> = {};
  updateChain.contains = vi.fn(() => updateChain);
  updateChain.eq = vi.fn(() => updateChain);
  updateChain.select = vi.fn(() =>
    Promise.resolve({ data: opts?.updateData ?? [], error: null }),
  );

  // from()이 반환하는 루트: select/update 분기
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromRoot: Record<string, any> = {
    select: selectChain.select,
    eq: selectChain.eq,
    in: selectChain.in,
    order: selectChain.order,
    update: vi.fn(() => updateChain),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: Record<string, any> = {};
  client.from = vi.fn(() => fromRoot);
  client.rpc = vi.fn(() =>
    Promise.resolve({ data: opts?.rpcData ?? 0, error: null }),
  );
  client._queryChain = selectChain;
  client._updateChain = updateChain;
  client._fromRoot = fromRoot;
  return client;
}

// ============================================
// 1. toHyperedgeRow
// ============================================

describe("toHyperedgeRow", () => {
  it("기본 변환 — members ≥2, hyperedge_type 기본값 theme_convergence", () => {
    const input: HyperedgeInput = {
      themeSlug: "climate-policy",
      themeLabel: "기후변화 정책",
      members: buildMembers(3),
    };
    const row = toHyperedgeRow(input);
    expect(row.theme_slug).toBe("climate-policy");
    expect(row.hyperedge_type).toBe("theme_convergence");
    expect(row.members).toHaveLength(3);
    expect(row.confidence).toBe(0.6); // 기본값
    expect(row.evidence).toBeNull();
    expect(row.shared_keywords).toBeNull();
    expect(row.shared_competencies).toBeNull();
  });

  it("members 개수가 2 미만이면 Error throw (validation)", () => {
    const input: HyperedgeInput = {
      themeSlug: "bad",
      themeLabel: "잘못된",
      members: buildMembers(1),
    };
    expect(() => toHyperedgeRow(input)).toThrow(/members must be ≥2/);
  });

  it("confidence clamp — 범위 초과/음수/NaN 처리", () => {
    const base: HyperedgeInput = {
      themeSlug: "s",
      themeLabel: "l",
      members: buildMembers(2),
    };
    expect(toHyperedgeRow({ ...base, confidence: 1.5 }).confidence).toBe(1);
    expect(toHyperedgeRow({ ...base, confidence: -0.2 }).confidence).toBe(0);
    expect(toHyperedgeRow({ ...base, confidence: NaN }).confidence).toBe(0.6);
    expect(toHyperedgeRow({ ...base, confidence: 0.777 }).confidence).toBe(0.78);
  });

  it("선택 필드 — evidence, shared_keywords, shared_competencies 전파", () => {
    const row = toHyperedgeRow({
      themeSlug: "s",
      themeLabel: "l",
      members: buildMembers(2),
      evidence: "3개 기록 수렴",
      sharedKeywords: ["기후", "정책"],
      sharedCompetencies: ["탐구력", "사고력"],
    });
    expect(row.evidence).toBe("3개 기록 수렴");
    expect(row.shared_keywords).toEqual(["기후", "정책"]);
    expect(row.shared_competencies).toEqual(["탐구력", "사고력"]);
  });
});

// ============================================
// 2. findHyperedges
// ============================================

describe("findHyperedges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("기본 호출 — stale 제외, student_id/tenant_id 필터", async () => {
    const client = makeSupabaseMock({
      selectData: [{ id: "he-1", member_count: 3 }],
    });
    (createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await findHyperedges("stu-1", "ten-1");
    expect(result).toHaveLength(1);
    expect(client.from).toHaveBeenCalledWith("student_record_hyperedges");
    const chain = client._queryChain;
    expect(chain.eq).toHaveBeenCalledWith("student_id", "stu-1");
    expect(chain.eq).toHaveBeenCalledWith("tenant_id", "ten-1");
    expect(chain.eq).toHaveBeenCalledWith("is_stale", false); // 기본 stale 제외
  });

  it("contexts / types 필터 시 in() 호출", async () => {
    const client = makeSupabaseMock({ selectData: [] });
    (createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    await findHyperedges("stu-1", "ten-1", {
      contexts: ["analysis", "synthesis_inferred"],
      types: ["theme_convergence"],
    });
    const chain = client._queryChain;
    expect(chain.in).toHaveBeenCalledWith("edge_context", [
      "analysis",
      "synthesis_inferred",
    ]);
    expect(chain.in).toHaveBeenCalledWith("hyperedge_type", ["theme_convergence"]);
  });

  it("includeStale: true 면 stale 필터 생략", async () => {
    const client = makeSupabaseMock({ selectData: [] });
    (createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    await findHyperedges("stu-1", "ten-1", { includeStale: true });
    const chain = client._queryChain;
    // is_stale eq 호출 X — student_id + tenant_id만
    const calls = chain.eq.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).not.toContain("is_stale");
  });
});

// ============================================
// 3. replaceHyperedges
// ============================================

describe("replaceHyperedges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("RPC 호출 payload 검증 — rows + context", async () => {
    const client = makeSupabaseMock({ rpcData: 2 });
    (createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const hyperedges: HyperedgeInput[] = [
      { themeSlug: "t1", themeLabel: "L1", members: buildMembers(3) },
      { themeSlug: "t2", themeLabel: "L2", members: buildMembers(3) },
    ];

    const count = await replaceHyperedges(
      "stu-1",
      "ten-1",
      "pipe-1",
      hyperedges,
      "analysis",
    );
    expect(count).toBe(2);
    expect(client.rpc).toHaveBeenCalledWith(
      "replace_student_record_hyperedges",
      expect.objectContaining({
        p_student_id: "stu-1",
        p_tenant_id: "ten-1",
        p_pipeline_id: "pipe-1",
        p_edge_context: "analysis",
        p_hyperedges: expect.arrayContaining([
          expect.objectContaining({ theme_slug: "t1" }),
          expect.objectContaining({ theme_slug: "t2" }),
        ]),
      }),
    );
  });
});

// ============================================
// 4. insertHyperedges
// ============================================

describe("insertHyperedges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("빈 배열 — RPC 호출 없이 0 반환", async () => {
    const client = makeSupabaseMock({ rpcData: 5 });
    (createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const count = await insertHyperedges("stu-1", "ten-1", "pipe-1", []);
    expect(count).toBe(0);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("synthesis_inferred 기본 context로 RPC 호출", async () => {
    const client = makeSupabaseMock({ rpcData: 1 });
    (createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    await insertHyperedges("stu-1", "ten-1", null, [
      { themeSlug: "t1", themeLabel: "L1", members: buildMembers(3) },
    ]);
    expect(client.rpc).toHaveBeenCalledWith(
      "insert_student_record_hyperedges",
      expect.objectContaining({
        p_edge_context: "synthesis_inferred",
        p_pipeline_id: null,
      }),
    );
  });
});

// ============================================
// 5. markHyperedgesStaleByRecord
// ============================================

describe("markHyperedgesStaleByRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("members jsonb containment 쿼리 + stale 업데이트", async () => {
    const client = makeSupabaseMock({ updateData: [{ id: "he-1" }, { id: "he-2" }] });
    (createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const count = await markHyperedgesStaleByRecord("rec-X", "record updated");
    expect(count).toBe(2);

    expect(client._fromRoot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_stale: true,
        stale_reason: "record updated",
      }),
    );
    const updateChain = client._updateChain;
    expect(updateChain.contains).toHaveBeenCalledWith("members", [{ recordId: "rec-X" }]);
    expect(updateChain.eq).toHaveBeenCalledWith("is_stale", false);
  });
});
