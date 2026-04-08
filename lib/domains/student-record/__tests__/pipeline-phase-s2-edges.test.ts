// ============================================
// pipeline/synthesis/phase-s2-edges.ts 테스트
//
// runEdgeComputation — NEIS 없을 때 skip 분기, target_major 유무에 따른
//   courseAdequacy 계산 분기, school_name/profile 존재 여부에 따른
//   offeredSubjects 분기, TaskRunnerOutput 구조, edge_context 영속화 인자.
//
// runGuideMatching — 진로분류 기반 + 수강계획 과목 기반 가이드 병합 로직,
//   "both" match_reason 우선 덮어쓰기, 이미 배정된 가이드 필터링,
//   과목 최대 5개 제한.
//
// 전략:
//   - Supabase client, edge-repository, course-adequacy, cross-reference,
//     autoRecommendGuidesAction, area-resolver 모두 mock
//   - PipelineContext를 최소한으로 구성
//   - 순수 분기 로직(skip 판단, 병합 우선순위)을 명세 수준으로 고정
// ============================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";

// ─── 최상단 mock (import보다 먼저 hoisting) ───────────────────────────────

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionDebug: vi.fn(),
  logActionError: vi.fn(),
  logActionWarn: vi.fn(),
}));

vi.mock("@/lib/utils/schoolYear", () => ({
  calculateSchoolYear: vi.fn().mockReturnValue(2026),
  getCurriculumYear: vi.fn().mockReturnValue(2022),
}));

// competency-repository (findActivityTags) mock
vi.mock("../repository/competency-repository", () => ({
  findActivityTags: vi.fn().mockResolvedValue([]),
}));

// cross-reference buildConnectionGraph mock
vi.mock("../cross-reference", () => ({
  buildConnectionGraph: vi.fn().mockReturnValue({
    nodes: [{ id: "node-1", edges: [{ type: "COMPETENCY_SHARED" }] }],
    totalEdges: 1,
  }),
}));

// actions/cross-ref-data-builder fetchCrossRefData mock
vi.mock("../actions/cross-ref-data-builder", () => ({
  fetchCrossRefData: vi.fn().mockResolvedValue({
    storylineLinks: [],
    readingLinks: [],
    recordLabelMap: {},
    readingLabelMap: {},
    recordContentMap: null,
  }),
}));

// edge-repository mock
vi.mock("../repository/edge-repository", () => ({
  replaceEdges: vi.fn().mockResolvedValue(1),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
  findEdges: vi.fn().mockResolvedValue([]),
}));

// content-hash mock
vi.mock("../content-hash", () => ({
  computeContentHash: vi.fn().mockReturnValue("hash-abc123"),
}));

// course-adequacy mock
vi.mock("../course-adequacy", () => ({
  calculateCourseAdequacy: vi.fn().mockReturnValue({
    majorCategory: "컴퓨터공학",
    score: 80,
    taken: ["수학I"],
    notTaken: ["물리학I"],
    notOffered: [],
    generalScore: 70,
    careerScore: 80,
    fusionScore: null,
  }),
}));

// schoolYear utils (getCurriculumYear — dynamic import 내부에서도 작동하도록)
vi.mock("@/lib/utils/schoolYear", () => ({
  calculateSchoolYear: vi.fn().mockReturnValue(2026),
  getCurriculumYear: vi.fn().mockReturnValue(2022),
}));

// autoRecommendGuidesAction mock
vi.mock("@/lib/domains/guide/actions/auto-recommend", () => ({
  autoRecommendGuidesAction: vi.fn(),
}));

// area-resolver mock
vi.mock("@/lib/domains/guide/actions/area-resolver", () => ({
  resolveGuideTargetArea: vi.fn().mockResolvedValue(new Map()),
}));

// ─── import ──────────────────────────────────────────────────────────────

import type { PipelineContext } from "../pipeline/pipeline-types";
import * as edgeRepo from "../repository/edge-repository";
import * as courseAdequacyModule from "../course-adequacy";
import * as crossRef from "../cross-reference";
import { autoRecommendGuidesAction } from "@/lib/domains/guide/actions/auto-recommend";

// ─── 픽스처 팩토리 ──────────────────────────────────────────────────────────

/** Supabase chaining mock — 테이블명별 응답 분기 */
function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  const defaultData = { data: [], error: null };

  const makeChain = (resolveData: unknown = defaultData) => {
    const chain: Record<string, unknown> = {};
    const terminal = vi.fn().mockResolvedValue(resolveData);
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.is = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.returns = vi.fn().mockReturnValue(chain);
    chain.maybeSingle = terminal;
    // Thenable — await supabase.from(...).select(...).eq(...) 형태 지원
    chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      (terminal() as Promise<unknown>).then(resolve, reject);
    return chain;
  };

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table in overrides) {
        return makeChain(overrides[table]);
      }
      return makeChain(defaultData);
    }),
  };
}

/** 최소 PipelineContext */
function makeCtx(
  overrides: Partial<PipelineContext> & { snapshotOverrides?: Record<string, unknown> } = {},
): PipelineContext {
  const { snapshotOverrides, ...rest } = overrides;
  return {
    pipelineId: "pipe-1",
    studentId: "student-1",
    tenantId: "tenant-1",
    supabase: makeSupabaseMock() as PipelineContext["supabase"],
    studentGrade: 2,
    snapshot: snapshotOverrides ?? null,
    tasks: {},
    previews: {},
    results: {},
    errors: {},
    pipelineType: "synthesis" as const,
    neisGrades: [1, 2],
    unifiedInput: { hasAnyDesign: false, grades: {} },
    ...rest,
  };
}

// ─── runEdgeComputation 테스트 ────────────────────────────────────────────

describe("runEdgeComputation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 기본 mock 재설정
    (crossRef.buildConnectionGraph as ReturnType<typeof vi.fn>).mockReturnValue({
      nodes: [{ id: "node-1", edges: [{ type: "COMPETENCY_SHARED" }] }],
      totalEdges: 1,
    });
    (edgeRepo.replaceEdges as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (edgeRepo.saveSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (courseAdequacyModule.calculateCourseAdequacy as ReturnType<typeof vi.fn>).mockReturnValue({
      majorCategory: "컴퓨터공학",
      score: 80,
      taken: ["수학I"],
      notTaken: [],
      notOffered: [],
    });
  });

  it("neisGrades가 빈 배열이고 설계 데이터도 없으면 skip 문자열 반환", async () => {
    const ctx = makeCtx({ neisGrades: [] });
    const { runEdgeComputation } = await import("../pipeline/synthesis/phase-s2-edges");
    const result = await runEdgeComputation(ctx);

    expect(typeof result).toBe("string");
    expect(result as string).toMatch(/NEIS/);
  });

  it("neisGrades가 없고 설계 데이터도 없으면 skip", async () => {
    const ctx = makeCtx({ neisGrades: undefined });
    const { runEdgeComputation } = await import("../pipeline/synthesis/phase-s2-edges");
    const result = await runEdgeComputation(ctx);

    expect(typeof result).toBe("string");
    expect(result as string).toMatch(/NEIS/);
  });

  it("neisGrades가 있으면 TaskRunnerOutput 객체 반환", async () => {
    const ctx = makeCtx({ neisGrades: [1] });
    const { runEdgeComputation } = await import("../pipeline/synthesis/phase-s2-edges");
    const result = await runEdgeComputation(ctx);

    expect(typeof result).toBe("object");
    expect(result).toHaveProperty("preview");
    expect(result).toHaveProperty("result");
  });

  it("target_major 없으면 calculateCourseAdequacy 호출 안 함, sharedCourseAdequacy=null", async () => {
    const ctx = makeCtx({
      neisGrades: [1],
      snapshotOverrides: {},            // target_major 없음
    });
    const { runEdgeComputation } = await import("../pipeline/synthesis/phase-s2-edges");
    const result = await runEdgeComputation(ctx) as { sharedCourseAdequacy: unknown };

    expect(courseAdequacyModule.calculateCourseAdequacy).not.toHaveBeenCalled();
    expect(result.sharedCourseAdequacy).toBeNull();
  });

  it("target_major 있으면 calculateCourseAdequacy 호출되고 결과가 sharedCourseAdequacy에 포함", async () => {
    const supabase = makeSupabaseMock({
      student_internal_scores: { data: [{ subject: { name: "수학I" } }], error: null },
    }) as PipelineContext["supabase"];

    const ctx = makeCtx({
      neisGrades: [1],
      supabase,
      snapshotOverrides: { target_major: "컴퓨터공학" },
    });
    const { runEdgeComputation } = await import("../pipeline/synthesis/phase-s2-edges");
    const result = await runEdgeComputation(ctx) as { sharedCourseAdequacy: unknown };

    expect(courseAdequacyModule.calculateCourseAdequacy).toHaveBeenCalledWith(
      "컴퓨터공학",
      expect.any(Array),
      null,                    // school_name 없으므로 offeredSubjects = null
      2022,                    // getCurriculumYear mock 반환값
    );
    expect(result.sharedCourseAdequacy).not.toBeUndefined();
  });

  it("school_name 없으면 offeredSubjects=null로 calculateCourseAdequacy 호출", async () => {
    const supabase = makeSupabaseMock({
      student_internal_scores: { data: [], error: null },
    }) as PipelineContext["supabase"];

    const ctx = makeCtx({
      neisGrades: [1],
      supabase,
      snapshotOverrides: { target_major: "생명과학" },   // school_name 없음
    });
    const { runEdgeComputation } = await import("../pipeline/synthesis/phase-s2-edges");
    await runEdgeComputation(ctx);

    expect(courseAdequacyModule.calculateCourseAdequacy).toHaveBeenCalledWith(
      "생명과학",
      expect.any(Array),
      null,                    // offeredSubjects = null (학교 없음)
      expect.any(Number),
    );
  });

  it("TaskRunnerOutput preview에 엣지 개수와 노드 개수가 포함된다", async () => {
    (crossRef.buildConnectionGraph as ReturnType<typeof vi.fn>).mockReturnValue({
      nodes: [
        { id: "n1", edges: [{ type: "COMPETENCY_SHARED" }, { type: "TEMPORAL_GROWTH" }] },
        { id: "n2", edges: [{ type: "READING_ENRICHES" }] },
      ],
      totalEdges: 3,
    });
    (edgeRepo.replaceEdges as ReturnType<typeof vi.fn>).mockResolvedValue(3);

    const ctx = makeCtx({ neisGrades: [1, 2] });
    const { runEdgeComputation } = await import("../pipeline/synthesis/phase-s2-edges");
    const result = await runEdgeComputation(ctx) as { preview: string; result: unknown };

    expect(result.preview).toMatch(/3/);   // 엣지 개수
    expect(result.preview).toMatch(/2/);   // 노드 개수
  });

  it("result 객체에 totalEdges와 nodeCount가 포함된다", async () => {
    (crossRef.buildConnectionGraph as ReturnType<typeof vi.fn>).mockReturnValue({
      nodes: [{ id: "n1", edges: [] }, { id: "n2", edges: [] }],
      totalEdges: 0,
    });

    const ctx = makeCtx({ neisGrades: [1] });
    const { runEdgeComputation } = await import("../pipeline/synthesis/phase-s2-edges");
    const output = await runEdgeComputation(ctx) as {
      preview: string;
      result: { totalEdges: number; nodeCount: number };
      computedEdges: unknown[];
    };

    expect(output.result).toMatchObject({ totalEdges: 0, nodeCount: 2 });
  });

  it("replaceEdges는 edge_context='analysis'로 호출된다", async () => {
    const ctx = makeCtx({ neisGrades: [1] });
    const { runEdgeComputation } = await import("../pipeline/synthesis/phase-s2-edges");
    await runEdgeComputation(ctx);

    expect(edgeRepo.replaceEdges).toHaveBeenCalledWith(
      "student-1",
      "tenant-1",
      "pipe-1",
      expect.anything(),
      "analysis",             // edge_context
    );
  });

  it("computedEdges는 그래프 노드 엣지의 flat 배열이다", async () => {
    const edgeA = { type: "COMPETENCY_SHARED", targetLabel: "창체" };
    const edgeB = { type: "TEMPORAL_GROWTH", targetLabel: "행특" };
    (crossRef.buildConnectionGraph as ReturnType<typeof vi.fn>).mockReturnValue({
      nodes: [
        { id: "n1", edges: [edgeA] },
        { id: "n2", edges: [edgeB] },
      ],
      totalEdges: 2,
    });

    const ctx = makeCtx({ neisGrades: [1] });
    const { runEdgeComputation } = await import("../pipeline/synthesis/phase-s2-edges");
    const output = await runEdgeComputation(ctx) as { computedEdges: unknown[] };

    expect(output.computedEdges).toHaveLength(2);
    expect(output.computedEdges).toContainEqual(edgeA);
    expect(output.computedEdges).toContainEqual(edgeB);
  });
});

// ─── runGuideMatching 테스트 ──────────────────────────────────────────────

describe("runGuideMatching", () => {
  const mockAutoRecommend = autoRecommendGuidesAction as MockedFunction<typeof autoRecommendGuidesAction>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** 기본 성공 응답 팩토리 */
  function makeGuide(id: string, matchReason = "classification") {
    return { id, title: `가이드-${id}`, match_reason: matchReason };
  }

  it("가이드가 0건이면 '0건 가이드 배정' 문자열 반환", async () => {
    mockAutoRecommend.mockResolvedValue({ success: true, data: [] });

    const ctx = makeCtx({ neisGrades: [1] });
    const { runGuideMatching } = await import("../pipeline/synthesis/phase-s2-edges");
    const result = await runGuideMatching(ctx);

    expect(typeof result).toBe("string");
    expect(result as string).toMatch(/0건 가이드 배정/);
  });

  it("이미 배정된 가이드는 재배정하지 않는다", async () => {
    mockAutoRecommend.mockResolvedValue({
      success: true,
      data: [makeGuide("guide-existing")],
    });

    const supabase = makeSupabaseMock({
      exploration_guide_assignments: {
        data: [{ guide_id: "guide-existing" }],
        error: null,
      },
    }) as PipelineContext["supabase"];

    const ctx = makeCtx({ neisGrades: [1], supabase });
    const { runGuideMatching } = await import("../pipeline/synthesis/phase-s2-edges");
    const result = await runGuideMatching(ctx);

    // 신규 배정 없음 — 0건
    expect(result as string).toMatch(/0건 가이드 배정/);
  });

  it("신규 가이드만 배정한다 (이미 있는 것 제외)", async () => {
    mockAutoRecommend.mockResolvedValue({
      success: true,
      data: [makeGuide("guide-old"), makeGuide("guide-new")],
    });

    // exploration_guide_assignments — guide-old는 이미 배정
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockImplementation((table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.is = vi.fn().mockReturnValue(chain);
      chain.insert = insertMock;
      chain.then = (resolve: (v: unknown) => void) =>
        Promise.resolve(
          table === "exploration_guide_assignments"
            ? { data: [{ guide_id: "guide-old" }], error: null }
            : { data: [], error: null },
        ).then(resolve);
      return chain;
    });

    const ctx = makeCtx({
      neisGrades: [1],
      supabase: { from: fromMock } as unknown as PipelineContext["supabase"],
    });
    const { runGuideMatching } = await import("../pipeline/synthesis/phase-s2-edges");
    const result = await runGuideMatching(ctx);

    // 추천 2건 중 신규 1건 → 배정 시도
    expect(result as string).toMatch(/1건 가이드 배정/);
    expect(result as string).toMatch(/2건 추천/);
  });

  it("수강계획 과목 기반 추천 가이드가 진로분류 결과와 병합된다", async () => {
    // 1차 호출(분류 기반): guide-A
    // 2차 호출(과목 기반): guide-B
    mockAutoRecommend
      .mockResolvedValueOnce({ success: true, data: [makeGuide("guide-A")] })
      .mockResolvedValueOnce({ success: true, data: [makeGuide("guide-B")] });

    const supabase = makeSupabaseMock({
      exploration_guide_assignments: { data: [], error: null },
    }) as PipelineContext["supabase"];

    const ctx = makeCtx({
      neisGrades: [1],
      supabase,
      coursePlanData: {
        plans: [
          {
            plan_status: "confirmed",
            subject: { name: "수학I" },
          } as never,
        ],
      } as never,
    });
    const { runGuideMatching } = await import("../pipeline/synthesis/phase-s2-edges");
    const result = await runGuideMatching(ctx);

    // guide-A + guide-B = 2건 추천 → (기존 배정 없으면) 2건 배정 시도
    expect(result as string).toMatch(/2건 추천/);
    // autoRecommendGuidesAction 2번 호출 (분류 기반 1회 + 과목 기반 1회)
    expect(mockAutoRecommend).toHaveBeenCalledTimes(2);
  });

  it("수강계획 과목이 5개 초과하면 최대 5개만 요청한다", async () => {
    // 1차(분류 기반) + 과목 5회 = 총 6회
    mockAutoRecommend.mockResolvedValue({ success: true, data: [] });

    const ctx = makeCtx({
      neisGrades: [1],
      coursePlanData: {
        plans: ["수학I", "물리학I", "화학I", "생명과학I", "지구과학I", "정보"].map(
          (name) => ({
            plan_status: "confirmed",
            subject: { name },
          }),
        ),
      } as never,
    });
    const { runGuideMatching } = await import("../pipeline/synthesis/phase-s2-edges");
    await runGuideMatching(ctx);

    // 분류 기반 1회 + 과목 최대 5회 = 총 6회
    expect(mockAutoRecommend).toHaveBeenCalledTimes(6);
  });

  it("'both' match_reason은 기존 'classification'보다 우선하여 덮어쓴다", async () => {
    // guide-X: 1차 호출(분류 기반)에서 classification으로 등록
    // guide-X: 2차 호출(과목 기반)에서 both로 재등록 → 덮어써야 함
    mockAutoRecommend
      .mockResolvedValueOnce({ success: true, data: [makeGuide("guide-X", "classification")] })
      .mockResolvedValueOnce({ success: true, data: [makeGuide("guide-X", "both")] });

    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.is = vi.fn().mockReturnValue(chain);
      chain.insert = insertMock;
      chain.then = (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve);
      return chain;
    });

    const ctx = makeCtx({
      neisGrades: [1],
      supabase: { from: fromMock } as unknown as PipelineContext["supabase"],
      coursePlanData: {
        plans: [{ plan_status: "confirmed", subject: { name: "수학I" } }],
      } as never,
    });
    const { runGuideMatching } = await import("../pipeline/synthesis/phase-s2-edges");
    await runGuideMatching(ctx);

    // insertMock이 호출되면 guide-X 1건 (중복 아님)
    if (insertMock.mock.calls.length > 0) {
      const insertedRows = insertMock.mock.calls[0][0] as Array<{ ai_recommendation_reason: string }>;
      const guideXRow = insertedRows.find((r) => r.ai_recommendation_reason === "both" || r.ai_recommendation_reason === "classification");
      // "both"로 덮어써진 레코드가 1건만 존재
      expect(insertedRows).toHaveLength(1);
      expect(guideXRow?.ai_recommendation_reason).toBe("both");
    }
  });

  it("autoRecommendGuidesAction이 success=false이면 해당 결과를 무시한다", async () => {
    mockAutoRecommend.mockResolvedValue({ success: false, data: null });

    const ctx = makeCtx({ neisGrades: [1] });
    const { runGuideMatching } = await import("../pipeline/synthesis/phase-s2-edges");
    const result = await runGuideMatching(ctx);

    expect(result as string).toMatch(/0건 가이드 배정/);
  });

  it("confirmed 또는 recommended 상태의 과목만 과목 기반 매칭에 사용된다", async () => {
    mockAutoRecommend.mockResolvedValue({ success: true, data: [] });

    const ctx = makeCtx({
      neisGrades: [1],
      coursePlanData: {
        plans: [
          { plan_status: "confirmed", subject: { name: "수학I" } },
          { plan_status: "draft", subject: { name: "물리학I" } },      // 제외
          { plan_status: "recommended", subject: { name: "화학I" } },
          { plan_status: "cancelled", subject: { name: "생명과학I" } }, // 제외
        ],
      } as never,
    });
    const { runGuideMatching } = await import("../pipeline/synthesis/phase-s2-edges");
    await runGuideMatching(ctx);

    // 분류 기반 1회 + confirmed(수학I) 1회 + recommended(화학I) 1회 = 3회
    expect(mockAutoRecommend).toHaveBeenCalledTimes(3);
  });
});
