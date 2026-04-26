// ============================================
// S3: runAiDiagnosis 통합 테스트
//
// Phase A/B 누적 신호 회귀 감지:
//   (a) ctx.belief.gradeThemes → generateAiDiagnosis 호출 인자에 gradeThemesSection 포함
//   (b) ctx.belief.profileCard → profileCardSection 포함
//   (c) hyperedge DB row 주어지면 hyperedgeSummarySection 포함, 0건이면 미포함
// ============================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import * as competencyRepo from "@/lib/domains/student-record/repository/competency-repository";
import * as diagnosisRepo from "@/lib/domains/student-record/repository/diagnosis-repository";
import * as generateDiagnosisModule from "@/lib/domains/record-analysis/llm/actions/generateDiagnosis";

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
  findActivityTags: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/domains/student-record/repository/diagnosis-repository", () => ({
  findDiagnosis: vi.fn().mockResolvedValue(null),
  upsertDiagnosis: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/domains/record-analysis/llm/actions/generateDiagnosis", () => ({
  generateAiDiagnosis: vi.fn(),
}));

vi.mock("@/lib/domains/record-analysis/llm/edge-summary", () => ({
  buildEdgePromptSection: vi.fn().mockReturnValue("## 엣지 섹션"),
}));

vi.mock("@/lib/domains/student-record/guide-context", () => ({
  buildGuideContextSection: vi.fn().mockResolvedValue(""),
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

vi.mock("@/lib/domains/student-record/evaluation-criteria/defaults", () => ({
  formatSetekFlowDetailed: vi.fn().mockReturnValue("8단계 흐름"),
  formatDraftBannedPatterns: vi.fn().mockReturnValue("금지 패턴"),
  formatDiagnosisCareerWeakPatterns: vi.fn().mockReturnValue(""),
  formatDiagnosisMacroPatterns: vi.fn().mockReturnValue(""),
}));

vi.mock("../pipeline/pipeline-unified-input", () => ({
  collectDesignRecords: vi.fn().mockReturnValue([]),
  checkCoverageForTask: vi.fn().mockReturnValue([]),
}));

// score-query: fetchScoresWithSubject
vi.mock("@/lib/domains/student-record/repository/score-query", () => ({
  fetchScoresWithSubject: vi.fn().mockResolvedValue([]),
}));

// course-adequacy: calculateCourseAdequacy
vi.mock("@/lib/domains/student-record/course-adequacy", () => ({
  calculateCourseAdequacy: vi.fn().mockReturnValue(null),
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
    return "## 학년 테마 섹션";
  }),
}));

// narrative-arc-diagnosis-section
vi.mock("@/lib/domains/record-analysis/llm/narrative-arc-diagnosis-section", () => ({
  buildNarrativeArcDiagnosisSection: vi.fn().mockResolvedValue(undefined),
}));

// hyperedge-repository
vi.mock("@/lib/domains/student-record/repository/hyperedge-repository", () => ({
  findHyperedges: vi.fn().mockResolvedValue([]),
}));

// helpers
vi.mock("../pipeline/synthesis/helpers", () => ({
  aggregateQualityPatterns: vi.fn().mockResolvedValue({ qualityPatternSection: undefined, repeatingPatterns: [] }),
  fetchAllYearCompetencyScores: vi.fn().mockResolvedValue([]),
  buildTimeseriesPromptSection: vi.fn().mockReturnValue(""),
  aggregateGradeThemes: vi.fn().mockResolvedValue({}),
  buildCrossSubjectThemesDiagnosisSection: vi.fn().mockReturnValue(undefined),
  fetchActiveMainExplorationSection: vi.fn().mockResolvedValue(undefined),
  buildBlueprintContextSection: vi.fn().mockReturnValue(undefined),
  buildHyperedgeSummarySection: vi.fn().mockImplementation((hyperedges: unknown[]) => {
    if (!hyperedges || hyperedges.length === 0) return undefined;
    return "## 하이퍼엣지 요약";
  }),
}));

// edge-repository
vi.mock("@/lib/domains/student-record/repository/edge-repository", () => ({
  findEdges: vi.fn().mockResolvedValue([]),
  insertEdges: vi.fn().mockResolvedValue(0),
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

// student-record/actions/coursePlan
vi.mock("@/lib/domains/student-record/actions/coursePlan", () => ({
  generateRecommendationsAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

// student-record/types
vi.mock("@/lib/domains/student-record/types", () => ({
  toDbJson: vi.fn().mockImplementation((v: unknown) => v),
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
  chain.upsert = vi.fn().mockResolvedValue({ error: null });
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve({ data: [], error: null });
  return chain;
}

const STUB_ACTIVITY_TAG = {
  id: "tag-1",
  student_id: "student-1",
  tenant_id: "tenant-1",
  record_type: "setek",
  record_id: "rec-1",
  competency_area: "academic",
  competency_item: "academic_inquiry",
  tag_context: "analysis",
  grade_value: "A",
  reasoning: "탐구 과정 기술됨",
  highlight: "탐구 하이라이트",
};

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    pipelineId: "pipe-s3-test",
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

/** 최소 generateAiDiagnosis 성공 응답 */
function makeDiagnosisSuccess() {
  return {
    success: true,
    data: {
      overallGrade: "B+",
      recordDirection: "융합 탐구",
      directionStrength: "moderate",
      directionReasoning: "수학+물리 연결",
      strengths: ["탐구력"],
      weaknesses: [],
      improvements: [],
      recommendedMajors: [],
      strategyNotes: "",
      warnings: [],
      inferredEdges: [],
    },
  };
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("S3 ai_diagnosis — Phase A/B 신호 통합 테스트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(a) ctx.belief.gradeThemes 주어지면 generateAiDiagnosis 호출 인자에 gradeThemesSection 포함", async () => {
    const genMock = generateDiagnosisModule.generateAiDiagnosis as MockedFunction<
      typeof generateDiagnosisModule.generateAiDiagnosis
    >;
    genMock.mockResolvedValue(makeDiagnosisSuccess() as never);

    (competencyRepo.findCompetencyScores as MockedFunction<typeof competencyRepo.findCompetencyScores>)
      .mockResolvedValue([]);
    // 역량 데이터 없음 분기를 피하기 위해 tag 1건 반환
    (competencyRepo.findActivityTags as MockedFunction<typeof competencyRepo.findActivityTags>)
      .mockResolvedValue([STUB_ACTIVITY_TAG] as never);

    const { runAiDiagnosis } = await import(
      "@/lib/domains/record-analysis/pipeline/synthesis/phase-s3-diagnosis"
    );

    const gradeThemes = {
      1: { dominantSubject: "수학", theme: "수리 기반 탐구" },
      2: { dominantSubject: "물리", theme: "역학 응용" },
    };
    const ctx = makeCtx({ belief: { gradeThemes } });

    await runAiDiagnosis(ctx as never, [], null);

    expect(genMock).toHaveBeenCalledOnce();
    // "학년 테마"를 포함하는 인자가 존재하는지 확인 (위치-독립 검증)
    const callArgs = genMock.mock.calls[0];
    const gradeThemesIdx = callArgs.findIndex(
      (arg) => typeof arg === "string" && (arg as string).includes("학년 테마"),
    );
    expect(gradeThemesIdx).toBeGreaterThanOrEqual(0);
  });

  it("(b) ctx.belief.profileCard 주어지면 generateAiDiagnosis 인자에 profileCardSection 포함", async () => {
    const genMock = generateDiagnosisModule.generateAiDiagnosis as MockedFunction<
      typeof generateDiagnosisModule.generateAiDiagnosis
    >;
    genMock.mockResolvedValue(makeDiagnosisSuccess() as never);

    (competencyRepo.findCompetencyScores as MockedFunction<typeof competencyRepo.findCompetencyScores>)
      .mockResolvedValue([]);
    (competencyRepo.findActivityTags as MockedFunction<typeof competencyRepo.findActivityTags>)
      .mockResolvedValue([STUB_ACTIVITY_TAG] as never);

    const { runAiDiagnosis } = await import(
      "@/lib/domains/record-analysis/pipeline/synthesis/phase-s3-diagnosis"
    );

    const profileCard = "## 학생 정체성 프로필\n- 탐구 중심: 수학/물리 융합";
    const ctx = makeCtx({ belief: { profileCard } });

    await runAiDiagnosis(ctx as never, [], null);

    expect(genMock).toHaveBeenCalledOnce();
    // profileCard 값을 포함하는 인자가 존재하는지 확인 (위치-독립 검증)
    const callArgs = genMock.mock.calls[0];
    const profileCardIdx = callArgs.findIndex((arg) => arg === profileCard);
    expect(profileCardIdx).toBeGreaterThanOrEqual(0);
  });

  it("(b-edge) ctx.belief.profileCard 빈 문자열이면 profileCardSection undefined (인자에 포함 안 됨)", async () => {
    const genMock = generateDiagnosisModule.generateAiDiagnosis as MockedFunction<
      typeof generateDiagnosisModule.generateAiDiagnosis
    >;
    genMock.mockResolvedValue(makeDiagnosisSuccess() as never);

    (competencyRepo.findCompetencyScores as MockedFunction<typeof competencyRepo.findCompetencyScores>)
      .mockResolvedValue([]);
    (competencyRepo.findActivityTags as MockedFunction<typeof competencyRepo.findActivityTags>)
      .mockResolvedValue([STUB_ACTIVITY_TAG] as never);

    const { runAiDiagnosis } = await import(
      "@/lib/domains/record-analysis/pipeline/synthesis/phase-s3-diagnosis"
    );

    // profileCard 가 공백만인 경우: profileCardSection 이 undefined 로 전달됨
    const ctx = makeCtx({ belief: { profileCard: "   " } });
    await runAiDiagnosis(ctx as never, [], null);

    expect(genMock).toHaveBeenCalledOnce();
    const callArgs = genMock.mock.calls[0];
    // 마지막 인자가 undefined 여야 함 (profileCard 공백 → undefined 변환)
    const lastArg = callArgs[callArgs.length - 1];
    expect(lastArg).toBeUndefined();
  });

  it("(c-있음) hyperedge DB row 주어지면 generateAiDiagnosis 인자에 hyperedgeSummarySection 포함", async () => {
    const genMock = generateDiagnosisModule.generateAiDiagnosis as MockedFunction<
      typeof generateDiagnosisModule.generateAiDiagnosis
    >;
    genMock.mockResolvedValue(makeDiagnosisSuccess() as never);

    (competencyRepo.findCompetencyScores as MockedFunction<typeof competencyRepo.findCompetencyScores>)
      .mockResolvedValue([]);
    (competencyRepo.findActivityTags as MockedFunction<typeof competencyRepo.findActivityTags>)
      .mockResolvedValue([STUB_ACTIVITY_TAG] as never);

    // hyperedge-repository mock 재정의 — 1건 반환
    const { findHyperedges } = await import("@/lib/domains/student-record/repository/hyperedge-repository");
    (findHyperedges as MockedFunction<typeof findHyperedges>).mockResolvedValue([
      {
        id: "he-1",
        theme_label: "수학-물리 융합",
        shared_competencies: ["academic_inquiry", "critical_thinking"],
        member_record_ids: ["r1", "r2", "r3"],
        confidence: 0.85,
      },
    ] as never);

    const { runAiDiagnosis } = await import(
      "@/lib/domains/record-analysis/pipeline/synthesis/phase-s3-diagnosis"
    );
    const ctx = makeCtx({ belief: {} });
    await runAiDiagnosis(ctx as never, [], null);

    expect(genMock).toHaveBeenCalledOnce();
    const callArgs = genMock.mock.calls[0];
    const hyperedgeIdx = callArgs.findIndex(
      (arg) => typeof arg === "string" && (arg as string).includes("하이퍼엣지"),
    );
    expect(hyperedgeIdx).toBeGreaterThanOrEqual(0);
  });

  it("(c-없음) hyperedge 0건이면 hyperedgeSummarySection undefined", async () => {
    const genMock = generateDiagnosisModule.generateAiDiagnosis as MockedFunction<
      typeof generateDiagnosisModule.generateAiDiagnosis
    >;
    genMock.mockResolvedValue(makeDiagnosisSuccess() as never);

    (competencyRepo.findCompetencyScores as MockedFunction<typeof competencyRepo.findCompetencyScores>)
      .mockResolvedValue([]);
    (competencyRepo.findActivityTags as MockedFunction<typeof competencyRepo.findActivityTags>)
      .mockResolvedValue([STUB_ACTIVITY_TAG] as never);

    const { findHyperedges } = await import("@/lib/domains/student-record/repository/hyperedge-repository");
    (findHyperedges as MockedFunction<typeof findHyperedges>).mockResolvedValue([]);

    const { runAiDiagnosis } = await import(
      "@/lib/domains/record-analysis/pipeline/synthesis/phase-s3-diagnosis"
    );
    const ctx = makeCtx({ belief: {} });
    await runAiDiagnosis(ctx as never, [], null);

    expect(genMock).toHaveBeenCalledOnce();
    const callArgs = genMock.mock.calls[0];
    // "하이퍼엣지"를 포함하는 인자가 없어야 함
    const hasHyperedgeArg = callArgs.some(
      (arg) => typeof arg === "string" && (arg as string).includes("하이퍼엣지"),
    );
    expect(hasHyperedgeArg).toBe(false);
  });
});
