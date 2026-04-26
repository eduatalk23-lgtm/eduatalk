// ============================================
// S6: runInterviewGeneration 통합 테스트 (Phase B 신규 부분)
//
// (a) hyperedge 있으면 generateInterviewQuestions 인자에 hyperedgeSummarySection 포함
// (b) hyperedge 없으면 hyperedgeSummarySection undefined
// ============================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import * as generateInterviewQuestionsModule from "@/lib/domains/record-analysis/llm/actions/generateInterviewQuestions";
import * as diagnosisRepo from "@/lib/domains/student-record/repository/diagnosis-repository";

// ── 전역 mock ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/utils/schoolYear", () => ({
  calculateSchoolYear: vi.fn().mockReturnValue(2026),
  getCurriculumYear: vi.fn().mockReturnValue(2022),
}));

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionError: vi.fn(),
  logActionDebug: vi.fn(),
  logActionWarn: vi.fn(),
}));

vi.mock("@/lib/domains/student-record/repository/diagnosis-repository", () => ({
  findDiagnosis: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/domains/record-analysis/llm/actions/generateInterviewQuestions", () => ({
  generateInterviewQuestions: vi.fn(),
}));

vi.mock("@/lib/domains/student-record/constants", () => ({
  COMPETENCY_ITEMS: [],
  COMPETENCY_RUBRIC_QUESTIONS: {},
  COMPETENCY_AREA_LABELS: {},
  getCharLimit: vi.fn().mockReturnValue(500),
  MAJOR_RECOMMENDED_COURSES: {},
  PIPELINE_THRESHOLDS: { MIN_IMPORTED_LENGTH: 20, MIN_CONTENT_LENGTH: 10, DEFAULT_DRAFT_MAX_TOKENS: 2000 },
  ACTIVITY_TYPE_LABELS: { autonomy: "자율", club: "동아리", career: "진로" },
}));

vi.mock("@/lib/domains/student-record/repository/competency-repository", () => ({
  findCompetencyScores: vi.fn().mockResolvedValue([]),
}));

vi.mock("../pipeline/pipeline-unified-input", () => ({
  collectDesignRecords: vi.fn().mockReturnValue([]),
  checkCoverageForTask: vi.fn().mockReturnValue([]),
}));

// hyperedge-repository — 기본: 빈 배열
vi.mock("@/lib/domains/student-record/repository/hyperedge-repository", () => ({
  findHyperedges: vi.fn().mockResolvedValue([]),
}));

// helpers
vi.mock("../pipeline/synthesis/helpers", () => ({
  fetchActiveMainExplorationSection: vi.fn().mockResolvedValue(undefined),
  buildBlueprintContextSection: vi.fn().mockReturnValue(undefined),
  buildHyperedgeSummarySection: vi.fn().mockImplementation((hyperedges: unknown[]) => {
    if (!hyperedges || hyperedges.length === 0) return undefined;
    return "## 하이퍼엣지 요약 — 수학-물리 융합";
  }),
}));

// mid-plan-guide-section
vi.mock("@/lib/domains/record-analysis/llm/mid-plan-guide-section", () => ({
  buildMidPlanSynthesisSection: vi.fn().mockReturnValue(undefined),
}));

// hakjong-score-section
vi.mock("@/lib/domains/record-analysis/llm/hakjong-score-section", () => ({
  buildHakjongScoreSection: vi.fn().mockReturnValue(undefined),
}));

// strategy-summary-section
vi.mock("@/lib/domains/record-analysis/llm/strategy-summary-section", () => ({
  buildStrategySummarySection: vi.fn().mockReturnValue(undefined),
}));

// student-state-repository
vi.mock("@/lib/domains/student-record/repository/student-state-repository", () => ({
  findLatestSnapshot: vi.fn().mockResolvedValue(null),
}));

// resolve-mid-plan
vi.mock("../pipeline/orient/resolve-mid-plan", () => ({
  resolveMidPlan: vi.fn().mockReturnValue(null),
}));

// snapshot-helpers
vi.mock("../pipeline/synthesis/snapshot-helpers", () => ({
  parseSnapshotHakjongScore: vi.fn().mockReturnValue(null),
}));

// ── 공통 팩토리 ───────────────────────────────────────────────────────────────

const LONG_CONTENT =
  "확률과 통계를 활용하여 사회 현상을 수량화하는 탐구 프로젝트를 수행하였으며, 정규분포와 표준편차 개념을 적용하여 실생활 데이터를 분석하고 결론을 도출하였습니다.";

function makeInterviewSupabase(hyperedgeCount = 0) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "student_record_interview_questions") {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        });
        const deleteChain: Record<string, unknown> = {};
        const deleteTerminal = vi.fn().mockResolvedValue({ error: null });
        deleteChain.eq = vi.fn().mockImplementation(() => deleteChain);
        (deleteChain as { then: unknown }).then = (
          resolve: (v: unknown) => void,
          reject: (e: unknown) => void,
        ) => (deleteTerminal() as Promise<unknown>).then(resolve, reject);
        chain.delete = vi.fn().mockReturnValue(deleteChain);
        chain.upsert = vi.fn().mockResolvedValue({ error: null });
        chain.insert = vi.fn().mockResolvedValue({ error: null });
        return chain;
      }
      if (table === "student_record_content_quality") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === "student_record_applications") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
        };
      }
      if (table === "student_record_strategies") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      // hyperedge_repository 는 vi.mock 으로 처리
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.is = vi.fn().mockReturnValue(chain);
      chain.returns = vi.fn().mockResolvedValue({ data: [], error: null });
      (chain as { then: unknown }).then = (resolve: (v: unknown) => void) =>
        resolve({ data: [], error: null });
      return chain;
    }),
  };
}

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    pipelineId: "pipe-s6-test",
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
    supabase: makeInterviewSupabase(),
    belief: {} as Record<string, unknown>,
    cachedSeteks: [
      {
        id: "setek-1",
        content: LONG_CONTENT,
        confirmed_content: null,
        imported_content: LONG_CONTENT,
        ai_draft_content: null,
        grade: 1,
        subject: { name: "수학I" },
      },
    ],
    cachedChangche: [],
    ...overrides,
  };
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("S6 interview_generation — hyperedge Phase B 통합 테스트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(a) hyperedge 1건 있으면 generateInterviewQuestions 인자에 hyperedgeSummarySection 포함", async () => {
    const genMock = generateInterviewQuestionsModule.generateInterviewQuestions as MockedFunction<
      typeof generateInterviewQuestionsModule.generateInterviewQuestions
    >;
    genMock.mockResolvedValue({
      success: true,
      data: { questions: [{ question: "탐구 심화 질문", questionType: "activity_depth", difficulty: "medium" }] },
    } as never);

    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>)
      .mockResolvedValue(null);

    // hyperedge 1건 설정
    const { findHyperedges } = await import("@/lib/domains/student-record/repository/hyperedge-repository");
    (findHyperedges as MockedFunction<typeof findHyperedges>).mockResolvedValue([
      {
        id: "he-1",
        theme_label: "수학-물리 융합",
        shared_competencies: ["academic_inquiry", "critical_thinking"],
        member_record_ids: ["r1", "r2", "r3"],
        confidence: 0.82,
      },
    ] as never);

    const { runInterviewGeneration } = await import(
      "@/lib/domains/record-analysis/pipeline/synthesis/phase-s6-interview"
    );
    const ctx = makeCtx();
    await runInterviewGeneration(ctx as never);

    expect(genMock).toHaveBeenCalledOnce();
    const callArg = genMock.mock.calls[0][0];
    expect(callArg).toHaveProperty("hyperedgeSummarySection");
    expect(callArg.hyperedgeSummarySection).toContain("하이퍼엣지");
  });

  it("(b) hyperedge 0건이면 hyperedgeSummarySection undefined", async () => {
    const genMock = generateInterviewQuestionsModule.generateInterviewQuestions as MockedFunction<
      typeof generateInterviewQuestionsModule.generateInterviewQuestions
    >;
    genMock.mockResolvedValue({
      success: true,
      data: { questions: [{ question: "일반 질문", questionType: "activity_depth", difficulty: "medium" }] },
    } as never);

    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>)
      .mockResolvedValue(null);

    const { findHyperedges } = await import("@/lib/domains/student-record/repository/hyperedge-repository");
    (findHyperedges as MockedFunction<typeof findHyperedges>).mockResolvedValue([]);

    const { runInterviewGeneration } = await import(
      "@/lib/domains/record-analysis/pipeline/synthesis/phase-s6-interview"
    );
    const ctx = makeCtx();
    await runInterviewGeneration(ctx as never);

    expect(genMock).toHaveBeenCalledOnce();
    const callArg = genMock.mock.calls[0][0];
    expect(callArg.hyperedgeSummarySection).toBeUndefined();
  });
});
