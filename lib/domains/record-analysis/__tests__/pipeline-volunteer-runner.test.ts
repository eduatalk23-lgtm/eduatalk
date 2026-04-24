// ============================================
// α1-2: runCompetencyVolunteerForGrade 유닛 테스트
//
// 시나리오:
//   - 빈 봉사 기록 → LLM 미호출, activity_tags 정리 + completed
//   - 정상 3건 → LLM 호출 + refreshCompetencyTagsAtomic 호출 + preview
//   - LLM 실패 → throw (runTaskWithState 가 failed 로 마킹)
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ----

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionDebug: vi.fn(),
  logActionError: vi.fn(),
  logActionWarn: vi.fn(),
}));

vi.mock("../pipeline/pipeline-executor", () => ({
  updatePipelineState: vi.fn().mockResolvedValue(undefined),
  checkCancelled: vi.fn().mockResolvedValue(false),
}));

const mockFetchVolunteer = vi.fn();
vi.mock("@/lib/domains/student-record/repository/volunteer-repository", () => ({
  fetchVolunteerByGrade: (...args: unknown[]) => mockFetchVolunteer(...args),
  buildVolunteerHashInput: () => "hash-input",
}));

const mockAnalyzeVolunteer = vi.fn();
vi.mock("@/lib/domains/record-analysis/llm/actions/analyzeVolunteerBatch", () => ({
  analyzeVolunteerBatch: (...args: unknown[]) => mockAnalyzeVolunteer(...args),
}));

const mockRefreshTags = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/domains/student-record/repository/competency-repository", () => ({
  refreshCompetencyTagsAtomic: (...args: unknown[]) => mockRefreshTags(...args),
  // 다른 테스트 공유 mock — 사용되지 않아도 존재해야 함
  findAnalysisCacheByRecordIds: vi.fn().mockResolvedValue([]),
  upsertAnalysisCache: vi.fn().mockResolvedValue(undefined),
  upsertCompetencyScore: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/utils/schoolYear", () => ({
  calculateSchoolYear: () => 2025,
  getCurriculumYear: () => "2022",
}));

vi.mock("@/lib/domains/student-record/rubric-matcher", () => ({
  aggregateCompetencyGrades: vi.fn().mockReturnValue([]),
  computeCourseEffortGrades: vi.fn().mockReturnValue({ item: "effort", grade: "A" }),
  computeCourseAchievementGrades: vi.fn().mockReturnValue({ item: "achievement", grade: "B" }),
}));

vi.mock("../pipeline/pipeline-task-runners-shared", () => ({
  runWithConcurrency: async (items: unknown[], _c: number, fn: (i: unknown) => Promise<void>) => {
    for (const item of items) await fn(item);
    return { cancelled: false };
  },
  collectAnalysisContext: vi.fn(),
  buildStudentProfileCard: vi.fn().mockResolvedValue(undefined),
  enrichCardWithInterestConsistency: vi.fn(async (c: unknown) => c),
  renderStudentProfileCard: vi.fn().mockReturnValue(""),
  computeProfileCardStructuralHash: vi.fn().mockReturnValue("hash"),
}));

vi.mock("@/lib/domains/student-record/constants", () => ({
  PIPELINE_THRESHOLDS: { MIN_IMPORTED_LENGTH: 20, MIN_CONTENT_LENGTH: 10, DEFAULT_DRAFT_MAX_TOKENS: 2000 },
}));

// ---- SUT ----

import { runCompetencyVolunteerForGrade } from "../pipeline/pipeline-task-runners-competency";
import type { PipelineContext } from "../pipeline/pipeline-types";

// ---- Fixtures ----

function makeCtx(overrides: Partial<PipelineContext> = {}): PipelineContext {
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = vi.fn().mockImplementation(self);
    chain.eq = vi.fn().mockImplementation(self);
    chain.in = vi.fn().mockImplementation(self);
    chain.is = vi.fn().mockImplementation(self);
    chain.order = vi.fn().mockImplementation(self);
    chain.delete = vi.fn().mockImplementation(self);
    chain.upsert = vi.fn().mockResolvedValue({ error: null });
    chain.insert = vi.fn().mockResolvedValue({ error: null });
    (chain as { then: unknown }).then = (
      resolve: (v: unknown) => void,
    ) => Promise.resolve({ data: [], error: null }).then(resolve);
    return chain;
  };
  const supabaseMock = {
    from: vi.fn().mockImplementation(() => makeChain()),
  };

  return {
    pipelineId: "pipe-1",
    studentId: "student-1",
    tenantId: "tenant-1",
    supabase: supabaseMock as unknown as PipelineContext["supabase"],
    studentGrade: 2,
    snapshot: { target_major: "사회복지학과" },
    tasks: {},
    previews: {},
    results: {},
    errors: {},
    pipelineType: "grade",
    targetGrade: 2,
    resolvedRecords: {
      2: { hasAnyNeis: true, hasAnySetek: true, hasAnyChangche: false, hasAnyHaengteuk: false },
    },
    cachedSeteks: [],
    cachedChangche: [],
    cachedHaengteuk: [],
    belief: {},
    ...overrides,
  } as unknown as PipelineContext;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// 1. 빈 봉사 기록
// ============================================

describe("runCompetencyVolunteerForGrade — 빈 봉사 기록", () => {
  it("LLM 미호출 + preview='봉사 기록 없음' + activityCount=0", async () => {
    mockFetchVolunteer.mockResolvedValue([]);

    const ctx = makeCtx();
    const out = await runCompetencyVolunteerForGrade(ctx);

    expect(mockAnalyzeVolunteer).not.toHaveBeenCalled();
    expect(mockRefreshTags).not.toHaveBeenCalled();
    expect(typeof out).toBe("object");
    const output = out as { preview: string; result: Record<string, unknown> };
    expect(output.preview).toContain("봉사 기록 없음");
    expect(output.result.activityCount).toBe(0);
    expect(output.result.totalHours).toBe(0);
    expect(output.result.skippedReason).toBe("no_volunteer_records");
  });
});

// ============================================
// 2. 정상 3건
// ============================================

describe("runCompetencyVolunteerForGrade — 정상 3건", () => {
  it("LLM 호출 + refreshCompetencyTagsAtomic 호출 + preview 에 시간/테마", async () => {
    mockFetchVolunteer.mockResolvedValue([
      { id: "v-1", hours: 5, description: "노인복지관 방문", activity_date: "2024-03-15", location: "A" },
      { id: "v-2", hours: 3, description: "환경 정화 활동", activity_date: "2024-04-01", location: "B" },
      { id: "v-3", hours: 4, description: "지역 청소년 멘토링", activity_date: "2024-05-10", location: "C" },
    ]);
    mockAnalyzeVolunteer.mockResolvedValue({
      success: true,
      data: {
        totalHours: 12,
        recurringThemes: ["복지 지원", "환경 보전"],
        caringEvidence: ["노인복지관 정기 방문으로 지속적 돌봄 확인"],
        leadershipEvidence: [],
        competencyTags: [
          { volunteerId: "v-1", competencyItem: "community_caring", evaluation: "positive", reasoning: "정기 방문" },
          { volunteerId: "v-2", competencyItem: "community_caring", evaluation: "positive", reasoning: "환경 기여" },
        ],
        elapsedMs: 1200,
      },
    });

    const ctx = makeCtx();
    const out = await runCompetencyVolunteerForGrade(ctx);

    expect(mockAnalyzeVolunteer).toHaveBeenCalledOnce();
    expect(mockRefreshTags).toHaveBeenCalledOnce();
    const [studentId, tenantId, volunteerIds, rpcTags] = mockRefreshTags.mock.calls[0];
    expect(studentId).toBe("student-1");
    expect(tenantId).toBe("tenant-1");
    expect(volunteerIds).toEqual(["v-1", "v-2", "v-3"]);
    expect(rpcTags).toHaveLength(2);
    expect(rpcTags[0].record_type).toBe("volunteer");
    expect(rpcTags[0].tag_context).toBe("analysis");

    const output = out as { preview: string; result: Record<string, unknown> };
    expect(output.preview).toContain("3건");
    expect(output.preview).toContain("12시간");
    expect(output.preview).toContain("복지 지원");
    expect(output.result.activityCount).toBe(3);
    expect(output.result.totalHours).toBe(12);
    expect(output.result.tagCount).toBe(2);
    expect(output.result.themeCount).toBe(2);
  });
});

// ============================================
// 3. LLM 실패
// ============================================

describe("runCompetencyVolunteerForGrade — LLM 실패", () => {
  it("throw → runTaskWithState 가 failed 로 마킹", async () => {
    mockFetchVolunteer.mockResolvedValue([
      { id: "v-1", hours: 5, description: "봉사", activity_date: "2024-03-15", location: "A" },
    ]);
    mockAnalyzeVolunteer.mockResolvedValue({
      success: false,
      error: "AI 응답 JSON 파싱 실패",
    });

    const ctx = makeCtx();
    await expect(runCompetencyVolunteerForGrade(ctx)).rejects.toThrow(
      /봉사 역량 분석 실패.*AI 응답 JSON 파싱 실패/,
    );
    expect(mockRefreshTags).not.toHaveBeenCalled();
  });
});
