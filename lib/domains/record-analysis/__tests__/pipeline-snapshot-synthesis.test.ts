// ============================================
// Synthesis Pipeline 스냅샷 테스트
//
// S1: runStorylineGeneration — detectInquiryLinks 호출 인자 + 저장 구조
// S5: runActivitySummary — 레코드 없음 스킵 / runAiStrategy — 약점 없음 스킵 + 정상 전략 구조
// S6: runInterviewGeneration — 기록 없음 스킵 + 정상 질문 구조 / runRoadmapGeneration — 정상 로드맵 구조
//
// 목표: LLM 액션 mock 고정 → 입출력 구조 변경 감지
// ============================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import * as repoModule from "@/lib/domains/student-record/repository";
import * as diagnosisRepo from "@/lib/domains/student-record/repository/diagnosis-repository";
import * as competencyRepo from "@/lib/domains/student-record/repository/competency-repository";
import * as detectInquiryLinksModule from "@/lib/domains/record-analysis/llm/actions/detectInquiryLinks";
import * as generateActivitySummaryModule from "@/lib/domains/record-analysis/llm/actions/generateActivitySummary";
import * as suggestStrategiesModule from "@/lib/domains/record-analysis/llm/actions/suggestStrategies";
import * as generateInterviewQuestionsModule from "@/lib/domains/record-analysis/llm/actions/generateInterviewQuestions";
import * as generateRoadmapModule from "@/lib/domains/record-analysis/llm/actions/generateRoadmap";

// ============================================
// 전역 mock — 각 describe가 재사용
// ============================================

vi.mock("@/lib/utils/schoolYear", () => ({
  calculateSchoolYear: vi.fn().mockReturnValue(2026),
  getCurriculumYear: vi.fn().mockReturnValue(2022),
}));

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionError: vi.fn(),
  logActionDebug: vi.fn(),
  logActionWarn: vi.fn(),
}));

vi.mock("@/lib/domains/student-record/repository", () => ({
  findStorylinesByStudent: vi.fn(),
  deleteAiStorylinesByStudent: vi.fn().mockResolvedValue(0),
  createAiStorylineWithLinks: vi.fn().mockResolvedValue("new-storyline-id"),
  findAllRoadmapItemsByStudent: vi.fn(),
  deleteRoadmapItemById: vi.fn().mockResolvedValue(undefined),
  insertRoadmapItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/domains/student-record/repository/diagnosis-repository", () => ({
  findDiagnosis: vi.fn(),
  findStrategies: vi.fn(),
  deleteStrategy: vi.fn().mockResolvedValue(undefined),
  insertStrategy: vi.fn().mockResolvedValue("new-strategy-id"),
}));

vi.mock("@/lib/domains/student-record/repository/competency-repository", () => ({
  findCompetencyScores: vi.fn(),
}));

vi.mock("@/lib/domains/record-analysis/llm/edge-summary", () => ({
  buildEdgePromptSection: vi.fn().mockReturnValue("## 연결 섹션"),
}));

vi.mock("@/lib/domains/student-record/guide-context", () => ({
  buildGuideContextSection: vi.fn().mockResolvedValue("## 가이드 컨텍스트"),
}));

vi.mock("../pipeline/pipeline-unified-input", () => ({
  collectDesignRecords: vi.fn().mockReturnValue([]),
  checkCoverageForTask: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/domains/student-record/constants", () => ({
  COMPETENCY_ITEMS: [
    { code: "academic_inquiry", label: "학업탐구력", area: "academic" },
    { code: "critical_thinking", label: "비판적사고", area: "academic" },
  ],
  COMPETENCY_RUBRIC_QUESTIONS: {
    academic_inquiry: ["탐구 주제 설정", "탐구 과정 기술", "결론 도출"],
    critical_thinking: ["비판적 분석", "논거 제시"],
  },
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

vi.mock("@/lib/domains/record-analysis/llm/actions/detectInquiryLinks", () => ({
  detectInquiryLinks: vi.fn(),
}));

vi.mock("@/lib/domains/record-analysis/llm/actions/generateActivitySummary", () => ({
  generateActivitySummary: vi.fn(),
}));

vi.mock("@/lib/domains/record-analysis/llm/actions/suggestStrategies", () => ({
  suggestStrategies: vi.fn(),
}));

vi.mock("@/lib/domains/record-analysis/llm/actions/generateInterviewQuestions", () => ({
  generateInterviewQuestions: vi.fn(),
}));

vi.mock("@/lib/domains/record-analysis/llm/actions/generateRoadmap", () => ({
  generateAiRoadmap: vi.fn(),
}));

vi.mock("../eval/university-profile-matcher", () => ({
  matchUniversityProfiles: vi.fn().mockReturnValue({ matches: [], summary: "매칭 없음" }),
}));

// ============================================
// 공통 최소 PipelineContext 팩토리
// ============================================
function makeCtx(overrides: Record<string, unknown> = {}) {
  const base = {
    pipelineId: "pipe-s-test",
    studentId: "student-1",
    tenantId: "tenant-1",
    studentGrade: 2,
    snapshot: null as Record<string, unknown> | null,
    tasks: {} as Record<string, string>,
    previews: {} as Record<string, string>,
    results: {} as Record<string, unknown>,
    errors: {} as Record<string, string>,
    pipelineType: "synthesis" as const,
    unifiedInput: { hasAnyDesign: false, grades: {} },
    supabase: buildDefaultSupabase(),
    belief: {} as Record<string, unknown>,
    ...overrides,
  };
  // belief dual write 불변식 모사 (loadPipelineContext 역할)
  const raw = base as Record<string, unknown>;
  const beliefMirror: Record<string, unknown> = { ...(base.belief ?? {}) };
  for (const k of ["resolvedRecords", "analysisContext", "gradeThemes", "blueprint", "qualityPatterns", "previousRunOutputs"]) {
    if (raw[k] !== undefined) beliefMirror[k] = raw[k];
  }
  base.belief = beliefMirror;
  return base;
}

/** 기본 supabase mock — 모든 체인에서 빈 배열/null 반환 */
function buildDefaultSupabase() {
  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = vi.fn().mockImplementation(self);
    chain.eq = vi.fn().mockImplementation(self);
    chain.is = vi.fn().mockImplementation(self);
    chain.in = vi.fn().mockImplementation(self);
    chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
    chain.order = vi.fn().mockImplementation(self);
    chain.upsert = vi.fn().mockResolvedValue({ error: null });
    chain.delete = vi.fn().mockImplementation(self);
    chain.returns = vi.fn().mockResolvedValue({ data: [], error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    // then 핸들러로 await 지원
    (chain as unknown as Promise<unknown>).then = (
      resolve: (v: unknown) => void,
    ) => resolve({ data: [], error: null });
    return chain;
  };

  return {
    from: vi.fn().mockImplementation(() => makeChain()),
  };
}

// ============================================
// S1: runStorylineGeneration
// ============================================

describe("S1 storyline_generation — runStorylineGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("NEIS 레코드도 없고 설계 가이드도 없으면 스킵 문자열 반환", async () => {
    const { runStorylineGeneration } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s1-storyline");

    const ctx = makeCtx({
      neisGrades: [],
      // unifiedInput 없음 → hasAnyDesign = false 분기
    });

    const result = await runStorylineGeneration(ctx as never);
    expect(result).toBe("NEIS 기록 없음 — 기록 임포트 후 감지 가능");
  });

  it("유효 레코드 2건 미만이면 스킵 문자열 반환", async () => {
    const { runStorylineGeneration } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s1-storyline");

    // neisGrades: [1] → 스킵 분기 우회
    // cachedSeteks: 1건이지만 20자 미만 content → 유효 레코드 0건
    const ctx = makeCtx({
      neisGrades: [1],
      cachedSeteks: [
        { id: "s1", content: "짧음", imported_content: null, ai_draft_content: null, grade: 1, subject: { name: "수학" } },
      ],
      cachedChangche: [],
    });

    const result = await runStorylineGeneration(ctx as never);
    expect(result).toBe("기록 2건 미만 — 건너뜀");
  });

  it("정상 케이스: detectInquiryLinks 호출 인자의 records 배열 구조 스냅샷", async () => {
    const detectMock = detectInquiryLinksModule.detectInquiryLinks as MockedFunction<
      typeof detectInquiryLinksModule.detectInquiryLinks
    >;

    detectMock.mockResolvedValue({
      success: true,
      data: {
        suggestedStorylines: [
          {
            title: "수학-물리 융합 탐구",
            keywords: ["역학", "미적분"],
            narrative: "1학년부터 꾸준히 이어온 수리 탐구",
            careerField: "공학",
            grade1Theme: "수리 기초",
            grade2Theme: "물리 응용",
            grade3Theme: null,
            connectionIndices: [0],
          },
        ],
        connections: [
          {
            fromIndex: 0,
            toIndex: 1,
            connectionType: "CONTENT_REFERENCE",
            reasoning: "수학 탐구가 물리로 연결됨",
            strength: "strong",
          },
        ],
      },
    } as never);

    (
      repoModule.findStorylinesByStudent as MockedFunction<
        typeof repoModule.findStorylinesByStudent
      >
    ).mockResolvedValue([]);

    const { runStorylineGeneration } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s1-storyline");

    const ctx = makeCtx({
      neisGrades: [1, 2],
      cachedSeteks: [
        {
          id: "setek-1",
          content: "확률과 통계를 활용한 사회 현상 분석 프로젝트를 수행하였습니다.",
          imported_content: "확률과 통계를 활용한 사회 현상 분석 프로젝트를 수행하였습니다.",
          ai_draft_content: null,
          grade: 1,
          subject: { name: "수학I" },
        },
        {
          id: "setek-2",
          content: "뉴턴의 운동 법칙을 미적분으로 유도하고 실생활 사례에 적용하였습니다.",
          imported_content: "뉴턴의 운동 법칙을 미적분으로 유도하고 실생활 사례에 적용하였습니다.",
          ai_draft_content: null,
          grade: 2,
          subject: { name: "물리I" },
        },
      ],
      cachedChangche: [],
    });

    const result = await runStorylineGeneration(ctx as never);

    expect(detectMock).toHaveBeenCalledOnce();
    const callRecords = detectMock.mock.calls[0][0];

    // 호출 인자 구조 스냅샷
    expect(callRecords).toMatchInlineSnapshot(`
      [
        {
          "content": "확률과 통계를 활용한 사회 현상 분석 프로젝트를 수행하였습니다.",
          "grade": 1,
          "id": "setek-1",
          "index": 0,
          "subject": "수학I",
          "type": "setek",
        },
        {
          "content": "뉴턴의 운동 법칙을 미적분으로 유도하고 실생활 사례에 적용하였습니다.",
          "grade": 2,
          "id": "setek-2",
          "index": 1,
          "subject": "물리I",
          "type": "setek",
        },
      ]
    `);

    // 결과 구조: preview + result.connectionCount
    expect(typeof result).toBe("object");
    const r = result as { preview: string; result: { storylineCount: number; connectionCount: number } };
    expect(r.preview).toContain("스토리라인 생성");
    expect(r.result.connectionCount).toBe(1);
  });

  it("detectInquiryLinks 실패 시 throw", async () => {
    const detectMock = detectInquiryLinksModule.detectInquiryLinks as MockedFunction<
      typeof detectInquiryLinksModule.detectInquiryLinks
    >;
    detectMock.mockResolvedValue({ success: false, error: "AI 오류" });

    const { runStorylineGeneration } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s1-storyline");

    const ctx = makeCtx({
      neisGrades: [1, 2],
      cachedSeteks: [
        {
          id: "s1",
          content: "탐구 내용이 충분히 길어서 20자를 넘어야 합니다.",
          imported_content: "탐구 내용이 충분히 길어서 20자를 넘어야 합니다.",
          ai_draft_content: null,
          grade: 1,
          subject: { name: "수학" },
        },
        {
          id: "s2",
          content: "물리 역학을 통해 실생활 현상을 분석하고 모델링하는 탐구를 진행하였습니다.",
          imported_content: "물리 역학을 통해 실생활 현상을 분석하고 모델링하는 탐구를 진행하였습니다.",
          ai_draft_content: null,
          grade: 2,
          subject: { name: "물리" },
        },
      ],
      cachedChangche: [],
    });

    await expect(runStorylineGeneration(ctx as never)).rejects.toThrow("AI 오류");
  });

  it("세특+창체 혼합 입력 시 세특이 grade 기준 정렬되어 먼저 전달된다", async () => {
    const detectMock = detectInquiryLinksModule.detectInquiryLinks as MockedFunction<
      typeof detectInquiryLinksModule.detectInquiryLinks
    >;
    detectMock.mockResolvedValue({
      success: true,
      data: { suggestedStorylines: [], connections: [] },
    } as never);

    (
      repoModule.findStorylinesByStudent as MockedFunction<
        typeof repoModule.findStorylinesByStudent
      >
    ).mockResolvedValue([]);

    const { runStorylineGeneration } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s1-storyline");

    // 세특은 2학년 먼저 제공하더라도 grade 정렬 후 1학년이 앞에 와야 함
    const ctx = makeCtx({
      neisGrades: [1, 2],
      cachedSeteks: [
        {
          id: "setek-2",
          content: "2학년 수학 세특으로 심화 탐구를 수행하였습니다.",
          imported_content: "2학년 수학 세특으로 심화 탐구를 수행하였습니다.",
          ai_draft_content: null,
          grade: 2,
          subject: { name: "수학II" },
        },
        {
          id: "setek-1",
          content: "1학년 국어 세특으로 문학 분석 탐구를 수행하였습니다.",
          imported_content: "1학년 국어 세특으로 문학 분석 탐구를 수행하였습니다.",
          ai_draft_content: null,
          grade: 1,
          subject: { name: "국어" },
        },
      ],
      cachedChangche: [
        {
          id: "cc-1",
          content: "1학년 동아리 활동으로 STEM 프로젝트를 진행하였습니다.",
          imported_content: "1학년 동아리 활동으로 STEM 프로젝트를 진행하였습니다.",
          ai_draft_content: null,
          grade: 1,
          activity_type: "동아리",
        },
      ],
    });

    await runStorylineGeneration(ctx as never);

    const callRecords = detectMock.mock.calls[0][0];
    // 세특은 grade 기준 정렬(1→2), 창체는 그 뒤에 추가
    expect(callRecords[0].id).toBe("setek-1");
    expect(callRecords[1].id).toBe("setek-2");
    expect(callRecords[2].id).toBe("cc-1");
  });
});

// ============================================
// S5-1: runActivitySummary
// ============================================

describe("S5 activity_summary — runActivitySummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generateActivitySummary 실패 시 throw", async () => {
    const genMock = generateActivitySummaryModule.generateActivitySummary as MockedFunction<
      typeof generateActivitySummaryModule.generateActivitySummary
    >;
    genMock.mockResolvedValue({ success: false, error: "데이터 수집 실패" } as never);

    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>).mockResolvedValue(
      null,
    );

    const { runActivitySummary } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s5-strategy");
    const ctx = makeCtx({ studentGrade: 2 });

    await expect(runActivitySummary(ctx as never, [])).rejects.toThrow("데이터 수집 실패");
  });

  it("정상 케이스: generateActivitySummary 호출 후 완료 문자열 반환", async () => {
    const genMock = generateActivitySummaryModule.generateActivitySummary as MockedFunction<
      typeof generateActivitySummaryModule.generateActivitySummary
    >;
    genMock.mockResolvedValue({
      success: true,
      data: {
        summaryId: "summary-1",
        grade1Summary: "1학년 활동 요약",
        grade2Summary: "2학년 활동 요약",
        overallNarrative: "3개년 성장 서사",
      },
    } as never);

    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>).mockResolvedValue(
      null,
    );

    const { runActivitySummary } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s5-strategy");
    const ctx = makeCtx({ studentGrade: 2 });
    const result = await runActivitySummary(ctx as never, []);

    expect(genMock).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      preview: expect.stringContaining("활동 요약서 생성 완료"),
      result: { summaryCount: expect.any(Number) },
    });
  });

  it("진단 강점/약점이 있으면 extraSections에 진단 섹션이 포함된다", async () => {
    const genMock = generateActivitySummaryModule.generateActivitySummary as MockedFunction<
      typeof generateActivitySummaryModule.generateActivitySummary
    >;
    genMock.mockResolvedValue({ success: true, data: { summaryId: "s-1" } } as never);

    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>).mockResolvedValue({
      id: "diag-1",
      student_id: "student-1",
      tenant_id: "tenant-1",
      school_year: 2026,
      source: "ai",
      strengths: ["수리적 탐구력", "자기주도성"],
      weaknesses: ["글쓰기 표현력"],
      improvements: [
        { priority: "높음", area: "글쓰기", gap: "부족", action: "글쓰기 연습", outcome: "향상" },
      ],
    } as never);

    const { runActivitySummary } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s5-strategy");
    const ctx = makeCtx({ studentGrade: 2 });
    await runActivitySummary(ctx as never, []);

    // generateActivitySummary 세 번째 인자(extraSections)에 진단 섹션 포함 확인
    const extraSections = genMock.mock.calls[0][2] as string | undefined;
    expect(extraSections).toBeDefined();
    expect(extraSections).toContain("종합 진단 요약");
    expect(extraSections).toContain("수리적 탐구력");
    expect(extraSections).toContain("글쓰기 표현력");
  });
});

// ============================================
// S5-2: runAiStrategy
// ============================================

describe("S5 ai_strategy — runAiStrategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("약점/부족역량/루브릭 약점 모두 없으면 스킵 문자열 반환", async () => {
    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>).mockResolvedValue({
      id: "d1",
      student_id: "s1",
      weaknesses: [],
      strengths: ["탐구력"],
      improvements: [],
    } as never);
    (
      competencyRepo.findCompetencyScores as MockedFunction<typeof competencyRepo.findCompetencyScores>
    ).mockResolvedValue([
      { competency_item: "academic_inquiry", grade_value: "A-", rubric_scores: [] },
    ] as never);
    (diagnosisRepo.findStrategies as MockedFunction<typeof diagnosisRepo.findStrategies>).mockResolvedValue([]);

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };

    const { runAiStrategy } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s5-strategy");
    const ctx = makeCtx({ supabase: mockSupabase, studentGrade: 2 });

    const result = await runAiStrategy(ctx as never);
    expect(result).toBe("약점/부족역량 없음 — 건너뜀");
  });

  it("정상 케이스: suggestStrategies 결과를 DB에 저장하고 카운트 반환", async () => {
    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>).mockResolvedValue({
      id: "d1",
      student_id: "s1",
      weaknesses: ["수학적 표현력 부족"],
      strengths: [],
      improvements: [
        { priority: "높음", area: "수학", gap: "표현력", action: "수식 작성 연습", outcome: "향상" },
      ],
    } as never);
    (
      competencyRepo.findCompetencyScores as MockedFunction<typeof competencyRepo.findCompetencyScores>
    ).mockResolvedValue([
      {
        competency_item: "critical_thinking",
        grade_value: "B-",
        rubric_scores: [{ questionIndex: 0, grade: "B-", reasoning: "논거가 약함" }],
      },
    ] as never);
    (diagnosisRepo.findStrategies as MockedFunction<typeof diagnosisRepo.findStrategies>).mockResolvedValue([]);

    const suggestMock = suggestStrategiesModule.suggestStrategies as MockedFunction<
      typeof suggestStrategiesModule.suggestStrategies
    >;
    suggestMock.mockResolvedValue({
      success: true,
      data: {
        suggestions: [
          {
            targetArea: "수학",
            strategyContent: "수식 표현 훈련을 통해 풀이 과정을 체계화한다.",
            priority: "높음",
            reasoning: "수학적 표현력이 입시에서 핵심 평가 요소",
            sourceUrls: null,
          },
          {
            targetArea: "비판적사고",
            strategyContent: "논문 읽기를 통해 논거 구성 능력을 향상한다.",
            priority: "중간",
            reasoning: "루브릭 비판적 사고 B- 보완",
            sourceUrls: null,
          },
        ],
        summary: "2건의 보완전략 제안",
      },
    });
    (diagnosisRepo.insertStrategy as MockedFunction<typeof diagnosisRepo.insertStrategy>).mockResolvedValue(
      "new-id",
    );

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };

    const { runAiStrategy } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s5-strategy");
    const ctx = makeCtx({ supabase: mockSupabase, studentGrade: 2 });

    const result = await runAiStrategy(ctx as never);

    expect(suggestMock).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ preview: "2건 보완전략 제안됨", result: { savedCount: 2 } });

    // insertStrategy 첫 번째 호출 구조 스냅샷
    const firstCall = (diagnosisRepo.insertStrategy as MockedFunction<typeof diagnosisRepo.insertStrategy>)
      .mock.calls[0][0];
    expect(firstCall).toMatchInlineSnapshot(`
      {
        "grade": 2,
        "priority": "높음",
        "reasoning": "수학적 표현력이 입시에서 핵심 평가 요소",
        "school_year": 2026,
        "source_urls": null,
        "status": "planned",
        "strategy_content": "수식 표현 훈련을 통해 풀이 과정을 체계화한다.",
        "student_id": "student-1",
        "target_area": "수학",
        "tenant_id": "tenant-1",
      }
    `);
  });

  it("기존 planned 전략만 삭제되고 done/in_progress는 보존된다", async () => {
    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>).mockResolvedValue({
      id: "d1",
      student_id: "s1",
      weaknesses: ["약점 A"],
      strengths: [],
      improvements: [],
    } as never);
    (
      competencyRepo.findCompetencyScores as MockedFunction<typeof competencyRepo.findCompetencyScores>
    ).mockResolvedValue([]);
    (diagnosisRepo.findStrategies as MockedFunction<typeof diagnosisRepo.findStrategies>).mockResolvedValue([
      { id: "strat-planned-1", status: "planned", strategy_content: "기존 전략 A" },
      { id: "strat-done-1", status: "done", strategy_content: "완료된 전략" },
    ] as never);

    const suggestMock = suggestStrategiesModule.suggestStrategies as MockedFunction<
      typeof suggestStrategiesModule.suggestStrategies
    >;
    suggestMock.mockResolvedValue({ success: true, data: { suggestions: [], summary: "" } });

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };

    const { runAiStrategy } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s5-strategy");
    const ctx = makeCtx({ supabase: mockSupabase });

    await runAiStrategy(ctx as never);

    const deleteStrategyMock = diagnosisRepo.deleteStrategy as MockedFunction<
      typeof diagnosisRepo.deleteStrategy
    >;
    expect(deleteStrategyMock).toHaveBeenCalledWith("strat-planned-1");
    expect(deleteStrategyMock).not.toHaveBeenCalledWith("strat-done-1");
  });
});

// ============================================
// S6-1: runInterviewGeneration
// ============================================

describe("S6 interview_generation — runInterviewGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("50자 미만 레코드만 있으면 스킵 문자열 반환", async () => {
    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>).mockResolvedValue(
      null,
    );

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "student_record_interview_questions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.is = vi.fn().mockReturnValue(chain);
        chain.returns = vi.fn().mockResolvedValue({ data: [], error: null });
        return chain;
      }),
    };

    const { runInterviewGeneration } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s6-interview");
    const ctx = makeCtx({
      supabase: mockSupabase,
      cachedSeteks: [
        {
          id: "s1",
          content: "짧음",
          imported_content: null,
          ai_draft_content: null,
          grade: 1,
          subject: { name: "수학" },
        },
      ],
      cachedChangche: [],
    });

    const result = await runInterviewGeneration(ctx as never);
    expect(result).toBe("기록 부족 — 건너뜀");
  });

  it("정상 케이스: generateInterviewQuestions 호출 인자 구조 스냅샷", async () => {
    const genMock = generateInterviewQuestionsModule.generateInterviewQuestions as MockedFunction<
      typeof generateInterviewQuestionsModule.generateInterviewQuestions
    >;

    genMock.mockResolvedValue({
      success: true,
      data: {
        questions: [
          {
            question: "확률분포를 활용한 탐구에서 어떤 변수를 선택했나요?",
            questionType: "activity_depth",
            suggestedAnswer: "정규분포를 선택했습니다.",
            difficulty: "medium",
          },
          {
            question: "탐구 결론에서 발견한 한계점은 무엇인가요?",
            questionType: "critical",
            suggestedAnswer: "표본이 제한적이었습니다.",
            difficulty: "hard",
          },
        ],
      },
    });

    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>).mockResolvedValue(
      null,
    );

    const longContent =
      "확률과 통계를 활용하여 사회 현상을 수량화하는 탐구 프로젝트를 수행하였으며, 정규분포와 표준편차 개념을 적용하여 실생활 데이터를 분석하였습니다.";

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "student_record_interview_questions") {
          // upsert 전 DELETE 호출 대응 (chain: delete().eq().eq())
          const chain: Record<string, unknown> = {};
          chain.select = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          });
          // delete().eq().eq().eq() 체인 지원
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
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.is = vi.fn().mockReturnValue(chain);
        chain.returns = vi.fn().mockResolvedValue({ data: [], error: null });
        return chain;
      }),
    };

    const { runInterviewGeneration } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s6-interview");
    const ctx = makeCtx({
      supabase: mockSupabase,
      cachedSeteks: [
        {
          id: "setek-main",
          content: longContent,
          imported_content: longContent,
          ai_draft_content: null,
          grade: 1,
          subject: { name: "수학I" },
        },
      ],
      cachedChangche: [],
      results: {},
    });

    const result = await runInterviewGeneration(ctx as never);

    expect(genMock).toHaveBeenCalledOnce();

    // 호출 인자 구조 스냅샷
    const callArg = genMock.mock.calls[0][0];
    expect(callArg).toMatchInlineSnapshot(`
      {
        "additionalRecords": [],
        "appliedUniversities": undefined,
        "careerContext": undefined,
        "content": "확률과 통계를 활용하여 사회 현상을 수량화하는 탐구 프로젝트를 수행하였으며, 정규분포와 표준편차 개념을 적용하여 실생활 데이터를 분석하였습니다.",
        "diagnosticWeaknesses": undefined,
        "existingQuestions": undefined,
        "grade": 1,
        "gradeThemesSection": undefined,
        "hakjongScoreSection": undefined,
        "hyperedgeSummarySection": undefined,
        "mainExplorationSection": undefined,
        "midPlanSynthesisSection": undefined,
        "narrativeArcSection": undefined,
        "previousRunOutputsSection": undefined,
        "profileCardSection": undefined,
        "qualityIssues": undefined,
        "qualityPatternsSection": undefined,
        "recordType": "setek",
        "strategySummarySection": undefined,
        "subjectName": "수학I",
        "weakCompetencies": undefined,
      }
    `);

    expect(result).toMatchObject({
      preview: "2건 면접 질문 생성",
      result: {
        totalCount: 2,
        byType: { activity_depth: 1, critical: 1 },
      },
    });
  });

  it("진단 약점이 있으면 diagnosticWeaknesses 필드가 채워진다", async () => {
    const genMock = generateInterviewQuestionsModule.generateInterviewQuestions as MockedFunction<
      typeof generateInterviewQuestionsModule.generateInterviewQuestions
    >;
    genMock.mockResolvedValue({ success: true, data: { questions: [] } });

    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>).mockResolvedValue({
      id: "d1",
      weaknesses: ["글쓰기 표현력 부족", "결론 도출 미흡"],
      strengths: [],
    } as never);

    const longContent =
      "생명과학 실험을 통해 세포 분열 과정을 관찰하고 유사분열과 감수분열을 비교 분석하였습니다. 현미경으로 직접 관찰한 결과를 토대로 보고서를 작성하였습니다.";

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "student_record_interview_questions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.is = vi.fn().mockReturnValue(chain);
        chain.returns = vi.fn().mockResolvedValue({ data: [], error: null });
        return chain;
      }),
    };

    const { runInterviewGeneration } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s6-interview");
    const ctx = makeCtx({
      supabase: mockSupabase,
      cachedSeteks: [
        {
          id: "s1",
          content: longContent,
          imported_content: longContent,
          ai_draft_content: null,
          grade: 1,
          subject: { name: "생명과학I" },
        },
      ],
      cachedChangche: [],
      results: {},
    });

    await runInterviewGeneration(ctx as never);

    const callArg = genMock.mock.calls[0][0];
    expect(callArg.diagnosticWeaknesses).toEqual(["글쓰기 표현력 부족", "결론 도출 미흡"]);
  });
});

// ============================================
// S6-2: runRoadmapGeneration
// ============================================

describe("S6 roadmap_generation — runRoadmapGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("LLM 성공 케이스: 출력 구조 스냅샷 (preview + result)", async () => {
    const roadmapMock = generateRoadmapModule.generateAiRoadmap as MockedFunction<
      typeof generateRoadmapModule.generateAiRoadmap
    >;
    roadmapMock.mockResolvedValue({
      success: true,
      data: {
        items: [
          { id: "r1", area: "setek", plan_content: "[AI] 수학 심화 탐구", grade: 1, semester: 1 },
          { id: "r2", area: "general", plan_content: "[AI] 독서 활동 강화", grade: 2, semester: null },
        ],
        mode: "analysis",
      },
    } as never);

    const { runRoadmapGeneration } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s6-interview");
    const ctx = makeCtx({ neisGrades: [1, 2], studentGrade: 2 });

    const result = await runRoadmapGeneration(ctx as never);

    expect(result).toMatchInlineSnapshot(`
      {
        "preview": "2건 AI 로드맵 (analysis)",
        "result": {
          "itemCount": 2,
          "items": [
            {
              "area": "setek",
              "grade": 1,
              "semester": 1,
            },
            {
              "area": "general",
              "grade": 2,
              "semester": null,
            },
          ],
          "mode": "analysis",
        },
      }
    `);
  });

  it("LLM 실패 + 스토리라인/진단 없으면 스킵 문자열 반환 (fallback)", async () => {
    const roadmapMock = generateRoadmapModule.generateAiRoadmap as MockedFunction<
      typeof generateRoadmapModule.generateAiRoadmap
    >;
    roadmapMock.mockResolvedValue({ success: false, error: "AI 오류" });

    (
      repoModule.findStorylinesByStudent as MockedFunction<typeof repoModule.findStorylinesByStudent>
    ).mockResolvedValue([]);
    (
      repoModule.findAllRoadmapItemsByStudent as MockedFunction<typeof repoModule.findAllRoadmapItemsByStudent>
    ).mockResolvedValue([]);
    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>).mockResolvedValue(
      null,
    );

    const { runRoadmapGeneration } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s6-interview");
    const ctx = makeCtx({ studentGrade: 2 });

    const result = await runRoadmapGeneration(ctx as never);
    expect(result).toBe("스토리라인/진단 없음 — 건너뜀");
  });

  it("LLM 실패 fallback: 스토리라인 기반 insertRoadmapItem 호출 구조 검증", async () => {
    const roadmapMock = generateRoadmapModule.generateAiRoadmap as MockedFunction<
      typeof generateRoadmapModule.generateAiRoadmap
    >;
    roadmapMock.mockResolvedValue({ success: false, error: "AI 오류" });

    (
      repoModule.findStorylinesByStudent as MockedFunction<typeof repoModule.findStorylinesByStudent>
    ).mockResolvedValue([
      {
        id: "sl-1",
        title: "[AI] 수학-물리 융합",
        keywords: ["수학", "물리"],
        grade_1_theme: "수리 기초 탐구",
        grade_2_theme: "물리 응용 탐구",
        grade_3_theme: null,
        sort_order: 0,
      },
    ] as never);
    (
      repoModule.findAllRoadmapItemsByStudent as MockedFunction<typeof repoModule.findAllRoadmapItemsByStudent>
    ).mockResolvedValue([]);
    (repoModule.insertRoadmapItem as MockedFunction<typeof repoModule.insertRoadmapItem>).mockResolvedValue(
      undefined,
    );

    (diagnosisRepo.findDiagnosis as MockedFunction<typeof diagnosisRepo.findDiagnosis>).mockResolvedValue({
      id: "d1",
      weaknesses: [],
      improvements: [
        { priority: "높음", area: "탐구역량", action: "심화 탐구 추진" },
      ],
    } as never);

    // activitySummary 액션 mock (fetchSetekGuides)
    vi.mock("@/lib/domains/student-record/actions/activitySummary", () => ({
      fetchSetekGuides: vi.fn().mockResolvedValue({ success: true, data: [] }),
    }));

    const { runRoadmapGeneration } = await import("@/lib/domains/record-analysis/pipeline/synthesis/phase-s6-interview");
    const ctx = makeCtx({ studentGrade: 2 });

    await runRoadmapGeneration(ctx as never);

    const insertMock = repoModule.insertRoadmapItem as MockedFunction<typeof repoModule.insertRoadmapItem>;
    expect(insertMock).toHaveBeenCalled();

    // 첫 번째 삽입: 스토리라인 1학년 테마
    const firstCall = insertMock.mock.calls[0][0];
    expect(firstCall.area).toBe("setek");
    expect(firstCall.plan_content).toContain("[AI]");
    expect(firstCall.plan_content).toContain("수학-물리 융합");
    expect(firstCall.student_id).toBe("student-1");
    expect(firstCall.tenant_id).toBe("tenant-1");
    expect(firstCall.grade).toBeTypeOf("number");
    expect(firstCall.school_year).toBe(2026);
  });
});
