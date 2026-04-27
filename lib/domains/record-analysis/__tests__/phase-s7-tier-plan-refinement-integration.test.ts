// ============================================
// S7: runTierPlanRefinement 통합 테스트 (Phase A/B 신호)
//
// (a) MidPlan + hakjongScore + narrativeArc 모두 주어지면 extractTierPlanSuggestion 인자에 전부 포함
// (b) hyperedge 주어지면 hyperedgeSummarySection 포함
// ============================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import * as extractTierPlanModule from "@/lib/domains/record-analysis/llm/actions/extractTierPlanSuggestion";
import * as judgeTierPlanModule from "@/lib/domains/record-analysis/llm/actions/judgeTierPlanConvergence";

// ── 전역 mock ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/utils/schoolYear", () => ({
  calculateSchoolYear: vi.fn().mockReturnValue(2026),
}));

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionError: vi.fn(),
  logActionDebug: vi.fn(),
  logActionWarn: vi.fn(),
}));

vi.mock("@/lib/domains/record-analysis/llm/actions/extractTierPlanSuggestion", () => ({
  extractTierPlanSuggestion: vi.fn(),
}));

vi.mock("@/lib/domains/record-analysis/llm/actions/judgeTierPlanConvergence", () => ({
  judgeTierPlanConvergence: vi.fn(),
}));

vi.mock("@/lib/domains/record-analysis/blueprint/tier-plan-similarity", () => ({
  compareTierPlans: vi.fn().mockReturnValue({ overall: 0.5, byTier: {}, threshold: 0.85, converged: false }),
  DEFAULT_TIER_PLAN_CONVERGENCE_THRESHOLD: 0.85,
}));

vi.mock("@/lib/constants/career-classification", () => ({
  MAJOR_TO_TIER1: { 수학교육: "교육", 컴퓨터공학: "공학" },
}));

// main-exploration-repository
vi.mock("@/lib/domains/student-record/repository/main-exploration-repository", () => ({
  getActiveMainExploration: vi.fn(),
  createMainExploration: vi.fn().mockResolvedValue({ id: "new-me-id" }),
  getMainExplorationChainDepth: vi.fn().mockResolvedValue(0),
}));

// student-state-repository
vi.mock("@/lib/domains/student-record/repository/student-state-repository", () => ({
  findLatestSnapshot: vi.fn().mockResolvedValue(null),
}));

// hyperedge-repository — 기본: 빈 배열
vi.mock("@/lib/domains/student-record/repository/hyperedge-repository", () => ({
  findHyperedges: vi.fn().mockResolvedValue([]),
}));

// narrative-arc-diagnosis-section — 기본: undefined
vi.mock("@/lib/domains/record-analysis/llm/narrative-arc-diagnosis-section", () => ({
  buildNarrativeArcDiagnosisSection: vi.fn().mockResolvedValue(undefined),
}));

// helpers
vi.mock("../pipeline/synthesis/helpers", () => ({
  buildHyperedgeSummarySection: vi.fn().mockImplementation((hyperedges: unknown[]) => {
    if (!hyperedges || hyperedges.length === 0) return undefined;
    return "## 하이퍼엣지 요약 — 융합 탐구";
  }),
}));

// mid-plan-guide-section
vi.mock("@/lib/domains/record-analysis/llm/mid-plan-guide-section", () => ({
  buildMidPlanSynthesisSection: vi.fn().mockImplementation((midPlan: unknown) => {
    if (!midPlan) return undefined;
    return "## MidPlan 핵심 탐구 축 가설\n- 수학 심화 탐구 중심";
  }),
  buildMidPlanByGradeSection: vi.fn().mockReturnValue(undefined),
}));

// resolve-mid-plan
vi.mock("../pipeline/orient/resolve-mid-plan", () => ({
  resolveMidPlan: vi.fn().mockReturnValue(null),
}));

// ── 공통 팩토리 ───────────────────────────────────────────────────────────────

const BASE_TIER_PLAN = {
  foundational: { theme: "기초 수리 탐구", key_questions: ["Q1"], suggested_activities: ["A1"] },
  development: { theme: "수학 응용", key_questions: ["Q2"], suggested_activities: ["A2"] },
  advanced: { theme: "융합 탐구", key_questions: ["Q3"], suggested_activities: ["A3"] },
};

const ACTIVE_MAIN_EXPLORATION = {
  id: "me-1",
  theme_label: "수학-물리 융합 탐구",
  theme_keywords: ["수학", "물리", "융합"],
  tier_plan: BASE_TIER_PLAN,
  origin: "auto_bootstrap",
  edited_by_consultant_at: null,
};

function makeS7Supabase() {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = vi.fn().mockImplementation(self);
      chain.eq = vi.fn().mockImplementation(self);
      chain.order = vi.fn().mockImplementation(self);
      chain.limit = vi.fn().mockImplementation(self);
      chain.in = vi.fn().mockImplementation(self);

      if (table === "students") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { grade: 2, target_major: "컴퓨터공학", target_major_2: null },
          error: null,
        });
      } else if (table === "student_record_diagnosis") {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { weaknesses: ["글쓰기 부족"] }, error: null });
      } else if (table === "student_record_strategies") {
        // limit returns data directly (array)
        chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
      } else if (table === "student_record_roadmap_items") {
        chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
      } else {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
      }
      (chain as { then: unknown }).then = (resolve: (v: unknown) => void) =>
        resolve({ data: [], error: null });
      return chain;
    }),
  };
}

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    pipelineId: "pipe-s7-test",
    studentId: "student-1",
    tenantId: "tenant-1",
    studentGrade: 2,
    snapshot: null,
    tasks: {} as Record<string, string>,
    previews: {} as Record<string, string>,
    results: {} as Record<string, unknown>,
    errors: {} as Record<string, string>,
    pipelineType: "synthesis" as const,
    unifiedInput: { hasAnyDesign: false, grades: {} },
    supabase: makeS7Supabase(),
    belief: {} as Record<string, unknown>,
    neisGrades: [1, 2],
    ...overrides,
  };
}

function makeSuggestionSuccess() {
  return {
    success: true,
    data: {
      themeLabel: "수학-물리 개선 탐구",
      tierPlan: {
        foundational: { theme: "개선 기초", key_questions: ["Q1-new"], suggested_activities: ["A1-new"] },
        development: { theme: "개선 응용", key_questions: ["Q2-new"], suggested_activities: ["A2-new"] },
        advanced: { theme: "개선 융합", key_questions: ["Q3-new"], suggested_activities: ["A3-new"] },
      },
      reasoning: "진단 결과 반영",
    },
    modelName: "gemini-flash",
  };
}

function makeJudgeNotConverged() {
  return {
    success: true,
    converged: false,
    data: {
      verdict: "substantial_change",
      reasoning: "핵심 탐구 방향 변경",
      deltaCategories: ["theme"],
    },
    modelName: "gemini-flash",
  };
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("S7 tier_plan_refinement — Phase A/B 신호 통합 테스트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(a) MidPlan + narrativeArc + hakjongScore 모두 있으면 extractTierPlanSuggestion 인자에 전부 포함", async () => {
    const extractMock = extractTierPlanModule.extractTierPlanSuggestion as MockedFunction<
      typeof extractTierPlanModule.extractTierPlanSuggestion
    >;
    extractMock.mockResolvedValue(makeSuggestionSuccess() as never);

    const judgeMock = judgeTierPlanModule.judgeTierPlanConvergence as MockedFunction<
      typeof judgeTierPlanModule.judgeTierPlanConvergence
    >;
    judgeMock.mockResolvedValue(makeJudgeNotConverged() as never);

    // main exploration 활성화
    const { getActiveMainExploration } = await import(
      "@/lib/domains/student-record/repository/main-exploration-repository"
    );
    (getActiveMainExploration as MockedFunction<typeof getActiveMainExploration>).mockResolvedValue(
      ACTIVE_MAIN_EXPLORATION as never,
    );

    // midPlan 설정
    const { resolveMidPlan } = await import("../pipeline/orient/resolve-mid-plan");
    (resolveMidPlan as MockedFunction<typeof resolveMidPlan>).mockReturnValue({
      focusHypothesis: "수학-물리 융합 기반 공학적 문제 해결",
    } as never);

    // narrativeArc 섹션 반환
    const { buildNarrativeArcDiagnosisSection } = await import(
      "@/lib/domains/record-analysis/llm/narrative-arc-diagnosis-section"
    );
    (buildNarrativeArcDiagnosisSection as MockedFunction<typeof buildNarrativeArcDiagnosisSection>)
      .mockResolvedValue("## 세특 8단계 서사\n- 3/8단계 완성");

    // hakjongScore: findLatestSnapshot에서 반환
    const { findLatestSnapshot } = await import(
      "@/lib/domains/student-record/repository/student-state-repository"
    );
    (findLatestSnapshot as MockedFunction<typeof findLatestSnapshot>).mockResolvedValue({
      snapshot_data: {
        hakjongScore: { academic: 78, activity: 65, career: 72, total: 71.7 },
      },
    } as never);

    const { runTierPlanRefinement } = await import(
      "@/lib/domains/record-analysis/pipeline/synthesis/phase-s7-tier-plan-refinement"
    );
    const ctx = makeCtx();
    await runTierPlanRefinement(ctx as never);

    expect(extractMock).toHaveBeenCalledOnce();
    const callArg = extractMock.mock.calls[0][0];

    // midPlanSynthesisSection 포함
    expect(callArg).toHaveProperty("midPlanSynthesisSection");
    expect(callArg.midPlanSynthesisSection).toContain("MidPlan");

    // narrativeArcSection 포함
    expect(callArg).toHaveProperty("narrativeArcSection");
    expect(callArg.narrativeArcSection).toContain("8단계");
  });

  it("(b) hyperedge 1건 있으면 extractTierPlanSuggestion 인자에 hyperedgeSummarySection 포함", async () => {
    const extractMock = extractTierPlanModule.extractTierPlanSuggestion as MockedFunction<
      typeof extractTierPlanModule.extractTierPlanSuggestion
    >;
    extractMock.mockResolvedValue(makeSuggestionSuccess() as never);

    const judgeMock = judgeTierPlanModule.judgeTierPlanConvergence as MockedFunction<
      typeof judgeTierPlanModule.judgeTierPlanConvergence
    >;
    judgeMock.mockResolvedValue(makeJudgeNotConverged() as never);

    const { getActiveMainExploration } = await import(
      "@/lib/domains/student-record/repository/main-exploration-repository"
    );
    (getActiveMainExploration as MockedFunction<typeof getActiveMainExploration>).mockResolvedValue(
      ACTIVE_MAIN_EXPLORATION as never,
    );

    // hyperedge 1건 설정
    const { findHyperedges } = await import("@/lib/domains/student-record/repository/hyperedge-repository");
    (findHyperedges as MockedFunction<typeof findHyperedges>).mockResolvedValue([
      {
        id: "he-1",
        theme_label: "수학-물리 융합",
        shared_competencies: ["academic_inquiry", "creative_synthesis"],
        member_record_ids: ["r1", "r2", "r3"],
        confidence: 0.79,
      },
    ] as never);

    const { runTierPlanRefinement } = await import(
      "@/lib/domains/record-analysis/pipeline/synthesis/phase-s7-tier-plan-refinement"
    );
    const ctx = makeCtx();
    await runTierPlanRefinement(ctx as never);

    expect(extractMock).toHaveBeenCalledOnce();
    const callArg = extractMock.mock.calls[0][0];
    expect(callArg).toHaveProperty("hyperedgeSummarySection");
    expect(callArg.hyperedgeSummarySection).toContain("하이퍼엣지");
  });

  it("(b-edge) hyperedge 0건이면 hyperedgeSummarySection undefined", async () => {
    const extractMock = extractTierPlanModule.extractTierPlanSuggestion as MockedFunction<
      typeof extractTierPlanModule.extractTierPlanSuggestion
    >;
    extractMock.mockResolvedValue(makeSuggestionSuccess() as never);

    const judgeMock = judgeTierPlanModule.judgeTierPlanConvergence as MockedFunction<
      typeof judgeTierPlanModule.judgeTierPlanConvergence
    >;
    judgeMock.mockResolvedValue(makeJudgeNotConverged() as never);

    const { getActiveMainExploration } = await import(
      "@/lib/domains/student-record/repository/main-exploration-repository"
    );
    (getActiveMainExploration as MockedFunction<typeof getActiveMainExploration>).mockResolvedValue(
      ACTIVE_MAIN_EXPLORATION as never,
    );

    const { findHyperedges } = await import("@/lib/domains/student-record/repository/hyperedge-repository");
    (findHyperedges as MockedFunction<typeof findHyperedges>).mockResolvedValue([]);

    const { runTierPlanRefinement } = await import(
      "@/lib/domains/record-analysis/pipeline/synthesis/phase-s7-tier-plan-refinement"
    );
    const ctx = makeCtx();
    await runTierPlanRefinement(ctx as never);

    expect(extractMock).toHaveBeenCalledOnce();
    const callArg = extractMock.mock.calls[0][0];
    expect(callArg.hyperedgeSummarySection).toBeUndefined();
  });
});
