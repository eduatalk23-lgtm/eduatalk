// ============================================
// S5: runAiStrategy 통합 테스트 (Phase A/B 신호)
//
// (a) ctx.belief.gradeThemes + ctx.belief.profileCard → suggestStrategies 인자에 둘 다 포함
// (b) narrativeArc DB row → narrativeArcSection 포함
// ============================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import * as competencyRepo from "@/lib/domains/student-record/repository/competency-repository";
import * as diagnosisRepo from "@/lib/domains/student-record/repository/diagnosis-repository";
import * as suggestStrategiesModule from "@/lib/domains/record-analysis/llm/actions/suggestStrategies";

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

vi.mock("@/lib/domains/student-record/repository/competency-repository", () => ({
  findCompetencyScores: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/domains/student-record/repository/diagnosis-repository", () => ({
  findDiagnosis: vi.fn().mockResolvedValue(null),
  findStrategies: vi.fn().mockResolvedValue([]),
  insertStrategy: vi.fn().mockResolvedValue("new-id"),
  deleteStrategy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/domains/record-analysis/llm/actions/suggestStrategies", () => ({
  suggestStrategies: vi.fn(),
}));

vi.mock("@/lib/domains/student-record/constants", () => ({
  COMPETENCY_ITEMS: [
    { code: "academic_inquiry", label: "학업탐구력", area: "academic" },
    { code: "critical_thinking", label: "비판적사고", area: "academic" },
  ],
  COMPETENCY_RUBRIC_QUESTIONS: {
    academic_inquiry: ["탐구 주제", "결론 도출"],
    critical_thinking: ["비판적 분석"],
  },
  COMPETENCY_AREA_LABELS: {},
  getCharLimit: vi.fn().mockReturnValue(500),
  MAJOR_RECOMMENDED_COURSES: {},
  PIPELINE_THRESHOLDS: { MIN_IMPORTED_LENGTH: 20, MIN_CONTENT_LENGTH: 10, DEFAULT_DRAFT_MAX_TOKENS: 2000 },
  ACTIVITY_TYPE_LABELS: { autonomy: "자율", club: "동아리", career: "진로" },
}));

vi.mock("@/lib/domains/student-record/guide-context", () => ({
  buildGuideContextSection: vi.fn().mockResolvedValue(""),
}));

vi.mock("@/lib/domains/student-record/repository/hyperedge-repository", () => ({
  findHyperedges: vi.fn().mockResolvedValue([]),
}));

// helpers
vi.mock("../pipeline/synthesis/helpers", () => ({
  fetchAllYearCompetencyScores: vi.fn().mockResolvedValue([]),
  buildUniversityMatchPromptSection: vi.fn().mockReturnValue(undefined),
  buildHyperedgeSummarySection: vi.fn().mockReturnValue(undefined),
  buildGradeThemesByGradeSection: vi.fn().mockImplementation((byGrade: unknown) => {
    if (!byGrade || Object.keys(byGrade as object).length === 0) return undefined;
    return "## 학년 테마 섹션";
  }),
  competencyGradeToScore: vi.fn().mockReturnValue(0),
  aggregateQualityPatterns: vi.fn().mockResolvedValue({ qualityPatternSection: undefined, repeatingPatterns: [] }),
  fetchActiveMainExplorationSection: vi.fn().mockResolvedValue(undefined),
  buildBlueprintContextSection: vi.fn().mockReturnValue(undefined),
  buildGapTrackerContextSection: vi.fn().mockReturnValue(undefined),
}));

vi.mock("@/lib/domains/record-analysis/eval/university-profile-matcher", () => ({
  matchUniversityProfiles: vi.fn().mockReturnValue({ matches: [], summary: "" }),
  collectSubjectDirectionScores: vi.fn().mockReturnValue(undefined),
}));

// resolve-mid-plan
vi.mock("../pipeline/orient/resolve-mid-plan", () => ({
  resolveMidPlan: vi.fn().mockReturnValue(null),
}));

// mid-plan-guide-section
vi.mock("@/lib/domains/record-analysis/llm/mid-plan-guide-section", () => ({
  buildMidPlanSynthesisSection: vi.fn().mockReturnValue(undefined),
}));

// hakjong-score-section
vi.mock("@/lib/domains/record-analysis/llm/hakjong-score-section", () => ({
  buildHakjongScoreSection: vi.fn().mockReturnValue(undefined),
}));

// student-state-repository
vi.mock("@/lib/domains/student-record/repository/student-state-repository", () => ({
  findLatestSnapshot: vi.fn().mockResolvedValue(null),
}));

// grade-themes-section
vi.mock("@/lib/domains/record-analysis/llm/grade-themes-section", () => ({
  buildGradeThemesSection: vi.fn().mockImplementation((gradeThemes: unknown) => {
    if (!gradeThemes) return undefined;
    return "## 학년 교과 테마 섹션";
  }),
}));

// narrative-arc-diagnosis-section
vi.mock("@/lib/domains/record-analysis/llm/narrative-arc-diagnosis-section", () => ({
  buildNarrativeArcDiagnosisSection: vi.fn().mockResolvedValue(undefined),
}));

// projected-quality-section
vi.mock("@/lib/domains/record-analysis/llm/projected-quality-section", () => ({
  fetchProjectedQualitySummary: vi.fn().mockResolvedValue([]),
  buildProjectedQualitySection: vi.fn().mockReturnValue(undefined),
}));

// pipeline-previous-run
vi.mock("../pipeline/pipeline-previous-run", () => ({
  getPreviousRunResult: vi.fn().mockReturnValue(null),
}));

// ── 공통 팩토리 ───────────────────────────────────────────────────────────────

function makeChain() {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.eq = vi.fn().mockImplementation(self);
  chain.is = vi.fn().mockImplementation(self);
  chain.in = vi.fn().mockImplementation(self);
  chain.order = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve({ data: [], error: null });
  return chain;
}

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    pipelineId: "pipe-s5-test",
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
    supabase: { from: vi.fn().mockImplementation(() => makeChain()) },
    belief: {} as Record<string, unknown>,
    neisGrades: [1, 2],
    ...overrides,
  };
}

function makeStrategySuccess() {
  return {
    success: true,
    data: {
      suggestions: [
        {
          targetArea: "탐구역량",
          strategyContent: "심화 탐구 주제 설정 연습",
          priority: "높음",
          reasoning: "학업탐구력 강화",
          sourceUrls: null,
        },
      ],
      summary: "1건 제안",
    },
  };
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("S5 ai_strategy — Phase A/B 신호 통합 테스트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(a) gradeThemes + profileCard 모두 주어지면 suggestStrategies 인자에 둘 다 포함", async () => {
    const suggestMock = suggestStrategiesModule.suggestStrategies as MockedFunction<
      typeof suggestStrategiesModule.suggestStrategies
    >;
    suggestMock.mockResolvedValue(makeStrategySuccess() as never);

    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>).mockResolvedValue({
      id: "d1",
      student_id: "student-1",
      weaknesses: ["표현력 부족"],
      strengths: [],
      improvements: [],
    } as never);
    (competencyRepo.findCompetencyScores as MockedFunction<typeof competencyRepo.findCompetencyScores>)
      .mockResolvedValue([]);
    (diagnosisRepo.findStrategies as MockedFunction<typeof diagnosisRepo.findStrategies>)
      .mockResolvedValue([]);

    const { runAiStrategy } = await import(
      "@/lib/domains/record-analysis/pipeline/synthesis/phase-s5-strategy"
    );

    // 격차 4 이후: Synthesis 단독 phase 라 gradeThemesByGrade 만 사용 (단일 gradeThemes 폴백 제거).
    const gradeThemesByGrade = {
      1: { themes: [{ id: "t1", label: "수학" }], dominantThemeIds: ["t1"] },
      2: { themes: [{ id: "t2", label: "물리" }], dominantThemeIds: ["t2"] },
    };
    const profileCard = "## 학생 프로필\n수학-물리 융합 탐구 학생";
    const ctx = makeCtx({
      belief: { gradeThemesByGrade, profileCard },
    });

    await runAiStrategy(ctx as never);

    expect(suggestMock).toHaveBeenCalledOnce();
    const callArg = suggestMock.mock.calls[0][0];

    // gradeThemesSection 포함 여부
    expect(callArg).toHaveProperty("gradeThemesSection");
    expect(callArg.gradeThemesSection).toContain("학년");

    // profileCardSection 포함 여부
    expect(callArg).toHaveProperty("profileCardSection");
    expect(callArg.profileCardSection).toBe(profileCard);
  });

  it("(a-edge) profileCard 미설정 시 profileCardSection undefined", async () => {
    const suggestMock = suggestStrategiesModule.suggestStrategies as MockedFunction<
      typeof suggestStrategiesModule.suggestStrategies
    >;
    suggestMock.mockResolvedValue(makeStrategySuccess() as never);

    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>).mockResolvedValue({
      id: "d1",
      student_id: "student-1",
      weaknesses: ["약점 A"],
      strengths: [],
      improvements: [],
    } as never);
    (competencyRepo.findCompetencyScores as MockedFunction<typeof competencyRepo.findCompetencyScores>)
      .mockResolvedValue([]);
    (diagnosisRepo.findStrategies as MockedFunction<typeof diagnosisRepo.findStrategies>)
      .mockResolvedValue([]);

    const { runAiStrategy } = await import(
      "@/lib/domains/record-analysis/pipeline/synthesis/phase-s5-strategy"
    );
    const ctx = makeCtx({ belief: {} }); // profileCard 없음

    await runAiStrategy(ctx as never);

    const callArg = suggestMock.mock.calls[0][0];
    expect(callArg.profileCardSection).toBeUndefined();
  });

  it("(b) narrativeArc DB row 있으면 suggestStrategies 인자에 narrativeArcSection 포함", async () => {
    const suggestMock = suggestStrategiesModule.suggestStrategies as MockedFunction<
      typeof suggestStrategiesModule.suggestStrategies
    >;
    suggestMock.mockResolvedValue(makeStrategySuccess() as never);

    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>).mockResolvedValue({
      id: "d1",
      student_id: "student-1",
      weaknesses: ["결론 도출 미흡"],
      strengths: [],
      improvements: [],
    } as never);
    (competencyRepo.findCompetencyScores as MockedFunction<typeof competencyRepo.findCompetencyScores>)
      .mockResolvedValue([]);
    (diagnosisRepo.findStrategies as MockedFunction<typeof diagnosisRepo.findStrategies>)
      .mockResolvedValue([]);

    // narrative-arc-diagnosis-section mock 재정의 — 실제 섹션 반환
    const { buildNarrativeArcDiagnosisSection } = await import(
      "@/lib/domains/record-analysis/llm/narrative-arc-diagnosis-section"
    );
    (buildNarrativeArcDiagnosisSection as MockedFunction<typeof buildNarrativeArcDiagnosisSection>)
      .mockResolvedValue("## 세특 8단계 서사 완성도\n- 수학I: 호기심→주제→탐구 3단계 감지");

    const { runAiStrategy } = await import(
      "@/lib/domains/record-analysis/pipeline/synthesis/phase-s5-strategy"
    );
    const ctx = makeCtx({ belief: {} });

    await runAiStrategy(ctx as never);

    expect(suggestMock).toHaveBeenCalledOnce();
    const callArg = suggestMock.mock.calls[0][0];
    expect(callArg).toHaveProperty("narrativeArcSection");
    expect(callArg.narrativeArcSection).toContain("8단계");
  });

  it("(b-edge) narrativeArc 없으면 narrativeArcSection undefined", async () => {
    const suggestMock = suggestStrategiesModule.suggestStrategies as MockedFunction<
      typeof suggestStrategiesModule.suggestStrategies
    >;
    suggestMock.mockResolvedValue(makeStrategySuccess() as never);

    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>).mockResolvedValue({
      id: "d1",
      student_id: "student-1",
      weaknesses: ["약점 B"],
      strengths: [],
      improvements: [],
    } as never);
    (competencyRepo.findCompetencyScores as MockedFunction<typeof competencyRepo.findCompetencyScores>)
      .mockResolvedValue([]);
    (diagnosisRepo.findStrategies as MockedFunction<typeof diagnosisRepo.findStrategies>)
      .mockResolvedValue([]);

    const { buildNarrativeArcDiagnosisSection } = await import(
      "@/lib/domains/record-analysis/llm/narrative-arc-diagnosis-section"
    );
    (buildNarrativeArcDiagnosisSection as MockedFunction<typeof buildNarrativeArcDiagnosisSection>)
      .mockResolvedValue(undefined); // 없음

    const { runAiStrategy } = await import(
      "@/lib/domains/record-analysis/pipeline/synthesis/phase-s5-strategy"
    );
    const ctx = makeCtx({ belief: {} });

    await runAiStrategy(ctx as never);

    const callArg = suggestMock.mock.calls[0][0];
    expect(callArg.narrativeArcSection).toBeUndefined();
  });
});
