// ============================================
// loadBlueprintWithStaleness — staleness 감지 유닛 테스트
// (minor-gaps #2, 2026-04-20)
//
// 시나리오:
//   1. main_exploration 만 있음 + blueprint 없음 → reason='insufficient_data'
//   2. blueprint 있음 + main_exploration.updated_at > completed_at → stale + warning
//   3. blueprint 있음 + main_exploration.updated_at <= completed_at → fresh + warning 없음
//   4. loadBlueprintForStudent 는 기존 동작 유지 (staleness 비노출)
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// logging mock
const mockLogWarn = vi.fn();
vi.mock("@/lib/logging/actionLogger", () => ({
  logActionWarn: (...args: unknown[]) => mockLogWarn(...args),
  logActionDebug: vi.fn(),
  logActionError: vi.fn(),
}));

// admin client mock — createSupabaseAdminClient 는 테스트에서 사용 안 함(client 주입)
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => null),
}));

import {
  loadBlueprintForStudent,
  loadBlueprintWithStaleness,
} from "../loader";

// ─── mock client 빌더 ────────────────────────────────────
//
// from("student_record_analysis_pipelines") 와 from("student_main_explorations")
// 두 경로를 분기 mocking. select→eq→eq→eq→eq→order→limit→maybeSingle 체인.

type MaybeSingleResult = { data: unknown; error: { message: string } | null };

function makeClient(opts: {
  blueprint?: MaybeSingleResult;
  mainExploration?: MaybeSingleResult;
}) {
  const bpResult: MaybeSingleResult = opts.blueprint ?? { data: null, error: null };
  const meResult: MaybeSingleResult = opts.mainExploration ?? { data: null, error: null };

  const makeChain = (final: MaybeSingleResult) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = vi.fn().mockImplementation(self);
    chain.eq = vi.fn().mockImplementation(self);
    chain.order = vi.fn().mockImplementation(self);
    chain.limit = vi.fn().mockImplementation(self);
    chain.maybeSingle = vi.fn().mockResolvedValue(final);
    return chain;
  };

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "student_record_analysis_pipelines") return makeChain(bpResult);
      if (table === "student_main_explorations") return makeChain(meResult);
      throw new Error(`unexpected table ${table}`);
    }),
  } as unknown as Parameters<typeof loadBlueprintWithStaleness>[2];
}

const SAMPLE_BLUEPRINT = {
  targetConvergences: [
    { id: "conv-1", theme: "과학탐구", competencies: ["academic_inquiry"] },
  ],
  storylineSkeleton: { overarchingTheme: "", yearThemes: {}, narrativeArc: "" },
  competencyGrowthTargets: [],
  milestones: {},
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// 1. insufficient_data — main_exploration 있고 blueprint 없음
// ============================================

describe("loadBlueprintWithStaleness — insufficient_data", () => {
  it("blueprint 부재 시 staleness.reason='insufficient_data' + warning 없음", async () => {
    const client = makeClient({
      blueprint: { data: null, error: null },
      mainExploration: { data: { updated_at: "2026-04-20T10:00:00Z" }, error: null },
    });

    const result = await loadBlueprintWithStaleness("s-1", "t-1", client);

    expect(result.blueprint).toBeNull();
    expect(result.staleness.reason).toBe("insufficient_data");
    expect(result.staleness.isStale).toBe(false);
    expect(result.staleness.blueprintCompletedAt).toBeNull();
    // warning 은 blueprint 조회 에러·로드 예외 때만 — insufficient_data 는 정상 상태
    expect(mockLogWarn).not.toHaveBeenCalled();
  });

  it("main_exploration·blueprint 둘 다 없음 → insufficient_data", async () => {
    const client = makeClient({
      blueprint: { data: null, error: null },
      mainExploration: { data: null, error: null },
    });
    const result = await loadBlueprintWithStaleness("s-1", "t-1", client);
    expect(result.staleness.reason).toBe("insufficient_data");
    expect(result.staleness.mainExplorationUpdatedAt).toBeNull();
    expect(result.staleness.blueprintCompletedAt).toBeNull();
  });
});

// ============================================
// 2. stale — main_exploration 이 blueprint 이후 갱신됨
// ============================================

describe("loadBlueprintWithStaleness — stale 감지", () => {
  it("main.updated_at > blueprint.completed_at → isStale=true + warning 로그", async () => {
    const client = makeClient({
      blueprint: {
        data: {
          id: "bp-1",
          task_results: { _blueprintPhase: SAMPLE_BLUEPRINT },
          updated_at: "2026-04-10T10:00:00Z",
          completed_at: "2026-04-10T10:05:00Z",
          status: "completed",
        },
        error: null,
      },
      mainExploration: {
        data: { updated_at: "2026-04-20T10:00:00Z" },
        error: null,
      },
    });

    const result = await loadBlueprintWithStaleness("s-1", "t-1", client);

    expect(result.blueprint).not.toBeNull();
    expect(result.staleness.isStale).toBe(true);
    expect(result.staleness.reason).toBe("stale");
    expect(result.staleness.mainExplorationUpdatedAt).toBe("2026-04-20T10:00:00Z");
    expect(result.staleness.blueprintCompletedAt).toBe("2026-04-10T10:05:00Z");
    // warning 한 번은 호출됨
    expect(mockLogWarn).toHaveBeenCalledTimes(1);
    const [, message] = mockLogWarn.mock.calls[0];
    expect(String(message)).toContain("stale 감지");
  });
});

// ============================================
// 3. fresh — blueprint 가 main_exploration 이후 완료됨
// ============================================

describe("loadBlueprintWithStaleness — fresh", () => {
  it("blueprint.completed_at >= main.updated_at → isStale=false + warning 없음", async () => {
    const client = makeClient({
      blueprint: {
        data: {
          id: "bp-1",
          task_results: { _blueprintPhase: SAMPLE_BLUEPRINT },
          updated_at: "2026-04-20T10:00:00Z",
          completed_at: "2026-04-20T10:05:00Z",
          status: "completed",
        },
        error: null,
      },
      mainExploration: {
        data: { updated_at: "2026-04-20T09:00:00Z" },
        error: null,
      },
    });

    const result = await loadBlueprintWithStaleness("s-1", "t-1", client);

    expect(result.blueprint).not.toBeNull();
    expect(result.staleness.isStale).toBe(false);
    expect(result.staleness.reason).toBe("fresh");
    expect(mockLogWarn).not.toHaveBeenCalled();
  });
});

// ============================================
// 4. blueprint 구조 불완전 — targetConvergences·milestones 모두 없음 → blueprint=null
// ============================================

describe("loadBlueprintWithStaleness — 구조 검증", () => {
  it("_blueprintPhase 가 있지만 최소 필드 미충족 → blueprint null 반환", async () => {
    const client = makeClient({
      blueprint: {
        data: {
          id: "bp-1",
          task_results: { _blueprintPhase: { some: "garbage" } },
          updated_at: "2026-04-20T10:00:00Z",
          completed_at: "2026-04-20T10:05:00Z",
          status: "completed",
        },
        error: null,
      },
      mainExploration: {
        data: { updated_at: "2026-04-20T09:00:00Z" },
        error: null,
      },
    });

    const result = await loadBlueprintWithStaleness("s-1", "t-1", client);
    expect(result.blueprint).toBeNull();
    // staleness 는 여전히 계산됨 — blueprint.completed_at 이 있고 main 도 있으므로
    expect(result.staleness.reason).toBe("fresh");
  });
});

// ============================================
// 5. loadBlueprintForStudent — 기존 동작 유지
// ============================================

describe("loadBlueprintForStudent — wrapper 호환성", () => {
  it("staleness 정보는 숨기고 blueprint 만 반환", async () => {
    const client = makeClient({
      blueprint: {
        data: {
          id: "bp-1",
          task_results: { _blueprintPhase: SAMPLE_BLUEPRINT },
          updated_at: "2026-04-20T10:00:00Z",
          completed_at: "2026-04-20T10:05:00Z",
          status: "completed",
        },
        error: null,
      },
      mainExploration: {
        data: { updated_at: "2026-04-20T09:00:00Z" },
        error: null,
      },
    });

    const bp = await loadBlueprintForStudent("s-1", "t-1", client);
    expect(bp).not.toBeNull();
    expect(bp?.targetConvergences).toHaveLength(1);
  });
});
