// ============================================
// α1-4-b: runCompetencyAwardsForGrade 유닛 테스트
//
// 시나리오:
//   - 빈 수상 기록 → LLM 미호출, activity_tags 정리 + completed
//   - 정상 2건 → LLM 호출 + refreshCompetencyTagsAtomic 호출 + preview
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

const mockFetchAwards = vi.fn();
vi.mock("@/lib/domains/student-record/repository/awards-repository", () => ({
  fetchAwardsByGrade: (...args: unknown[]) => mockFetchAwards(...args),
  buildAwardsHashInput: () => "hash-input",
}));

const mockAnalyzeAwards = vi.fn();
vi.mock("@/lib/domains/record-analysis/llm/actions/analyzeAwardsBatch", () => ({
  analyzeAwardsBatch: (...args: unknown[]) => mockAnalyzeAwards(...args),
}));

const mockRefreshTags = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/domains/student-record/repository/competency-repository", () => ({
  refreshCompetencyTagsAtomic: (...args: unknown[]) => mockRefreshTags(...args),
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

import { runCompetencyAwardsForGrade } from "../pipeline/pipeline-task-runners-competency";
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
    snapshot: { target_major: "공과대학" },
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
    ...overrides,
  } as unknown as PipelineContext;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// 1. 빈 수상 기록
// ============================================

describe("runCompetencyAwardsForGrade — 빈 수상 기록", () => {
  it("LLM 미호출 + preview='수상 기록 없음' + awardCount=0", async () => {
    mockFetchAwards.mockResolvedValue([]);

    const ctx = makeCtx();
    const out = await runCompetencyAwardsForGrade(ctx);

    expect(mockAnalyzeAwards).not.toHaveBeenCalled();
    expect(mockRefreshTags).not.toHaveBeenCalled();
    const output = out as { preview: string; result: Record<string, unknown> };
    expect(output.preview).toContain("수상 기록 없음");
    expect(output.result.awardCount).toBe(0);
    expect(output.result.tagCount).toBe(0);
    expect(output.result.skippedReason).toBe("no_award_records");
  });
});

// ============================================
// 2. 정상 2건
// ============================================

describe("runCompetencyAwardsForGrade — 정상 2건", () => {
  it("LLM 호출 + refreshCompetencyTagsAtomic 호출 + preview 에 건수/테마 + ctx.results 영속화", async () => {
    mockFetchAwards.mockResolvedValue([
      {
        id: "aw-1",
        award_name: "전국공학경시대회 은상",
        award_level: "전국",
        awarding_body: "한국공학한림원",
        participants: "개인",
        award_date: "2024-05-15",
      },
      {
        id: "aw-2",
        award_name: "학생회 행사 기획상",
        award_level: "교내",
        awarding_body: "본교",
        participants: "개인",
        award_date: "2024-09-01",
      },
    ]);
    mockAnalyzeAwards.mockResolvedValue({
      success: true,
      data: {
        recurringThemes: ["공학 탐구", "리더십"],
        leadershipEvidence: ["학생회 행사 기획상으로 조직 리더십 경험"],
        careerRelevance: ["공학경시 은상이 공과대학 지망 경로와 일치"],
        competencyTags: [
          {
            awardId: "aw-1",
            competencyItem: "career_exploration",
            evaluation: "positive",
            reasoning: "공학경시대회 은상 — 목표 전공(공학)과 직접 연결",
          },
          {
            awardId: "aw-2",
            competencyItem: "community_leadership",
            evaluation: "positive",
            reasoning: "학생회 주최 행사 기획상 — 주도적 조직 역할",
          },
        ],
        elapsedMs: 850,
      },
    });

    const ctx = makeCtx();
    const out = await runCompetencyAwardsForGrade(ctx);

    expect(mockAnalyzeAwards).toHaveBeenCalledOnce();
    expect(mockRefreshTags).toHaveBeenCalledOnce();
    const [studentId, tenantId, awardIds, rpcTags] = mockRefreshTags.mock.calls[0];
    expect(studentId).toBe("student-1");
    expect(tenantId).toBe("tenant-1");
    expect(awardIds).toEqual(["aw-1", "aw-2"]);
    expect(rpcTags).toHaveLength(2);
    expect(rpcTags[0].record_type).toBe("award");
    expect(rpcTags[0].tag_context).toBe("analysis");

    const output = out as { preview: string; result: Record<string, unknown> };
    expect(output.preview).toContain("2건");
    expect(output.result.awardCount).toBe(2);
    expect(output.result.tagCount).toBe(2);
    expect(output.result.themeCount).toBe(2);
    expect(output.result.leadershipEvidence).toEqual([
      "학생회 행사 기획상으로 조직 리더십 경험",
    ]);
    expect(output.result.careerRelevance).toEqual([
      "공학경시 은상이 공과대학 지망 경로와 일치",
    ]);

    // ctx.results 영속화 검증 — collectAwardState 가 소비할 필드
    expect(ctx.results["competency_awards"]).toEqual(output.result);
  });
});

// ============================================
// 3. LLM 실패
// ============================================

describe("runCompetencyAwardsForGrade — LLM 실패", () => {
  it("throw → runTaskWithState 가 failed 로 마킹", async () => {
    mockFetchAwards.mockResolvedValue([
      {
        id: "aw-1",
        award_name: "교내 표창",
        award_level: "교내",
        awarding_body: "본교",
        participants: "개인",
        award_date: "2024-03-15",
      },
    ]);
    mockAnalyzeAwards.mockResolvedValue({
      success: false,
      error: "AI 응답 JSON 파싱 실패",
    });

    const ctx = makeCtx();
    await expect(runCompetencyAwardsForGrade(ctx)).rejects.toThrow(
      /수상 역량 분석 실패.*AI 응답 JSON 파싱 실패/,
    );
    expect(mockRefreshTags).not.toHaveBeenCalled();
  });
});
