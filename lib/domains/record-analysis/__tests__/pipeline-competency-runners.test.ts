// ============================================
// pipeline-task-runners-competency.ts 유닛 테스트
//
// 핵심 시나리오:
//   - 캐시 히트 → LLM 미호출
//   - 캐시 미스 → LLM 호출 + 결과 저장
//   - 청크 분할 (chunkSize=2, 미캐시 5건 → 2건만 처리 + hasMore=true)
//   - 실패 레코드 재시도 (10초 대기 mock)
//   - NEIS 없음 → 건너뜀
//   - targetGrade null → throw
//
// 전략:
//   - LLM/repository/content-hash를 vi.mock으로 교체
//   - PipelineContext 최소 픽스처
//   - setTimeout을 vi.useFakeTimers로 제어
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

const mockAnalyze = vi.fn();
vi.mock("@/lib/domains/record-analysis/llm/actions/analyzeWithHighlight", () => ({
  analyzeSetekWithHighlight: (...args: unknown[]) => mockAnalyze(...args),
}));

const mockFindCache = vi.fn();
const mockRefreshTags = vi.fn().mockResolvedValue(undefined);
const mockUpsertCache = vi.fn().mockResolvedValue(undefined);
const mockUpsertScore = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/domains/student-record/repository/competency-repository", () => ({
  findAnalysisCacheByRecordIds: (...args: unknown[]) => mockFindCache(...args),
  refreshCompetencyTagsAtomic: (...args: unknown[]) => mockRefreshTags(...args),
  upsertAnalysisCache: (...args: unknown[]) => mockUpsertCache(...args),
  upsertCompetencyScore: (...args: unknown[]) => mockUpsertScore(...args),
}));

const mockComputeHash = vi.fn();
vi.mock("@/lib/domains/student-record/content-hash", () => ({
  computeRecordContentHash: (...args: unknown[]) => mockComputeHash(...args),
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

vi.mock("@/lib/domains/student-record/course-adequacy", () => ({
  calculateCourseAdequacy: vi.fn().mockReturnValue(null),
}));

vi.mock("../pipeline/pipeline-task-runners-shared", () => ({
  runWithConcurrency: async (items: unknown[], _concurrency: number, fn: (item: unknown) => Promise<void>) => {
    for (const item of items as unknown[]) await fn(item);
    return { cancelled: false };
  },
  collectAnalysisContext: vi.fn(),
  // Layer 0 profile card는 유닛 테스트 환경에서는 빈 카드로 처리 (undefined 반환)
  buildStudentProfileCard: vi.fn().mockResolvedValue(undefined),
  enrichCardWithInterestConsistency: vi.fn(async (card: unknown) => card),
  renderStudentProfileCard: vi.fn().mockReturnValue(""),
  computeProfileCardStructuralHash: vi.fn().mockReturnValue("hash-stub"),
}));

vi.mock("@/lib/domains/student-record/constants", () => ({
  PIPELINE_THRESHOLDS: { MIN_IMPORTED_LENGTH: 20, MIN_CONTENT_LENGTH: 10, DEFAULT_DRAFT_MAX_TOKENS: 2000 },
}));

// ---- SUT ----

import {
  runCompetencySetekForGrade,
  runCompetencySetekChunkForGrade,
  runCompetencyChangcheForGrade,
  runCompetencyHaengteukForGrade,
} from "../pipeline/pipeline-task-runners-competency";
import type { PipelineContext } from "../pipeline/pipeline-types";

// ---- Fixtures ----

function makeCtx(overrides: Partial<PipelineContext> = {}): PipelineContext {
  // Phase 0 증거 체인: saveResult가 .select("id").eq().eq().eq().eq() 체인을 호출하므로
  // self-returning chain으로 mock하여 모든 chainable 메서드 호출 후 빈 data 반환.
  const makeChain = (terminalData: unknown = { data: [], error: null }): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    const terminal = vi.fn().mockResolvedValue(terminalData);
    chain.select = vi.fn().mockImplementation(self);
    chain.eq = vi.fn().mockImplementation(self);
    chain.in = vi.fn().mockImplementation(self);
    chain.is = vi.fn().mockImplementation(self);
    chain.order = vi.fn().mockImplementation(self);
    chain.limit = vi.fn().mockImplementation(self);
    chain.returns = vi.fn().mockImplementation(self);
    chain.upsert = vi.fn().mockResolvedValue({ error: null });
    chain.insert = vi.fn().mockResolvedValue({ error: null });
    chain.delete = vi.fn().mockImplementation(self);
    chain.maybeSingle = terminal;
    (chain as { then: unknown }).then = (
      resolve: (v: unknown) => void,
      reject: (e: unknown) => void,
    ) => (terminal() as Promise<unknown>).then(resolve, reject);
    return chain;
  };
  const supabaseMock = {
    from: vi.fn().mockImplementation(() => makeChain()),
  };

  const base = {
    pipelineId: "pipe-1",
    studentId: "student-1",
    tenantId: "tenant-1",
    supabase: supabaseMock as unknown as PipelineContext["supabase"],
    studentGrade: 2,
    snapshot: null,
    tasks: {},
    previews: {},
    results: {},
    errors: {},
    pipelineType: "grade",
    targetGrade: 2,
    resolvedRecords: {
      2: { hasAnyNeis: true, hasAnySetek: true, hasAnyChangche: false, hasAnyHaengteuk: false },
    },
    cachedSeteks: [
      { id: "setek-1", grade: 2, imported_content: "가".repeat(30), subject: { name: "국어" } },
      { id: "setek-2", grade: 2, imported_content: "나".repeat(30), subject: { name: "수학" } },
      { id: "setek-3", grade: 2, imported_content: "다".repeat(30), subject: { name: "영어" } },
    ],
    cachedChangche: [],
    cachedHaengteuk: [],
    belief: {},
    ...overrides,
  } as unknown as PipelineContext;
  // belief dual write 불변식 모사 (loadPipelineContext 역할)
  base.belief = {
    ...base.belief,
    ...(base.resolvedRecords ? { resolvedRecords: base.resolvedRecords } : {}),
    ...(base.analysisContext ? { analysisContext: base.analysisContext } : {}),
    ...(base.gradeThemes ? { gradeThemes: base.gradeThemes } : {}),
    ...(base.blueprint ? { blueprint: base.blueprint } : {}),
    ...(base.qualityPatterns ? { qualityPatterns: base.qualityPatterns } : {}),
    ...(base.previousRunOutputs ? { previousRunOutputs: base.previousRunOutputs } : {}),
  };
  return base;
}

/** 성공 LLM 응답 */
function mockSuccessResult(recordId: string) {
  return {
    success: true,
    data: {
      sections: [{ tags: [{ competencyItem: "inquiry", evaluation: "A", reasoning: "탐구력", highlight: "적극적" }] }],
      competencyGrades: [{ item: "inquiry", grade: "A" }],
      contentQuality: { specificity: 20, coherence: 12, depth: 20, grammar: 8, scientificValidity: 20, overallScore: 80, issues: [], feedback: "" },
      recordId,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // 기본: 캐시 없음
  mockFindCache.mockResolvedValue([]);
  mockComputeHash.mockReturnValue("hash-new");
});

// ============================================
// 1. 캐시 히트 → LLM 미호출
// ============================================

describe("캐시 히트", () => {
  it("전체 캐시 → LLM 미호출 + allCached: true", async () => {
    mockFindCache.mockResolvedValue([
      { record_id: "setek-1", content_hash: "hash-new", analysis_result: { sections: [], competencyGrades: [] } },
      { record_id: "setek-2", content_hash: "hash-new", analysis_result: { sections: [], competencyGrades: [] } },
      { record_id: "setek-3", content_hash: "hash-new", analysis_result: { sections: [], competencyGrades: [] } },
    ]);

    const result = await runCompetencySetekForGrade(makeCtx());
    expect(mockAnalyze).not.toHaveBeenCalled();
    expect(typeof result === "object" && result !== null ? (result as { result: { allCached: boolean } }).result.allCached : false).toBe(true);
  });

  it("부분 캐시 → 미캐시 레코드만 LLM 호출", async () => {
    mockFindCache.mockResolvedValue([
      { record_id: "setek-1", content_hash: "hash-new", analysis_result: { sections: [], competencyGrades: [] } },
    ]);
    mockAnalyze.mockResolvedValue(mockSuccessResult("setek-2"));

    await runCompetencySetekForGrade(makeCtx());
    // setek-1 캐시, setek-2, setek-3만 호출
    expect(mockAnalyze).toHaveBeenCalledTimes(2);
  });
});

// ============================================
// 2. 캐시 미스 → LLM 호출 + 저장
// ============================================

describe("캐시 미스", () => {
  it("LLM 성공 → 태그 + 캐시 + quality 저장", async () => {
    mockAnalyze.mockResolvedValue(mockSuccessResult("setek-1"));

    await runCompetencySetekForGrade(makeCtx());
    expect(mockRefreshTags).toHaveBeenCalled();
    expect(mockUpsertCache).toHaveBeenCalled();
  });
});

// ============================================
// 3. 청크 분할
// ============================================

describe("청크 분할 (runCompetencySetekChunkForGrade)", () => {
  it("chunkSize=1 + 미캐시 3건 → 1건 처리 + hasMore=true", async () => {
    mockAnalyze.mockResolvedValue(mockSuccessResult("setek-1"));

    const result = await runCompetencySetekChunkForGrade(makeCtx(), 1);
    expect(result.hasMore).toBe(true);
    expect(result.totalUncached).toBe(3);
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });

  it("chunkSize >= 미캐시 수 → hasMore=false", async () => {
    mockAnalyze.mockResolvedValue(mockSuccessResult("any"));

    const result = await runCompetencySetekChunkForGrade(makeCtx(), 10);
    expect(result.hasMore).toBe(false);
  });
});

// ============================================
// 4. 실패 + 재시도
// ============================================

describe("실패 레코드 재시도", () => {
  it("첫 시도 실패 → 10초 후 재시도 → 성공", async () => {
    vi.useFakeTimers();

    let callCount = 0;
    mockAnalyze.mockImplementation(() => {
      callCount++;
      // 첫 3번(첫 시도)은 모두 실패, 이후(재시도)는 성공
      if (callCount <= 3) return Promise.resolve({ success: false, error: "rate limit" });
      return Promise.resolve(mockSuccessResult("any"));
    });

    const promise = runCompetencySetekForGrade(makeCtx());
    // setTimeout(10s) 진행
    await vi.advanceTimersByTimeAsync(10_000);
    await promise;

    // 최소 4번(3 실패 + 재시도)
    expect(callCount).toBeGreaterThanOrEqual(4);

    vi.useRealTimers();
  });

  it("B7 완결성 가드: 실패율 10% 초과 시 throw (재실행 cascade 유도)", async () => {
    vi.useFakeTimers();

    mockAnalyze.mockResolvedValue({ success: false, error: "permanent error" });

    const promise = runCompetencySetekForGrade(makeCtx());
    // unhandled rejection 방지: 즉시 catch 핸들러 부착
    const settled = promise.catch((e) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    const err = await settled;

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/부분 실행|> 10%/);

    vi.useRealTimers();
  });
});

// ============================================
// 5. NEIS 없음 → 건너뜀
// ============================================

describe("NEIS 없는 학년", () => {
  it("hasAnyNeis: false → 즉시 스킵 메시지", async () => {
    const ctx = makeCtx({
      resolvedRecords: {
        2: { hasAnyNeis: false, hasAnySetek: false, hasAnyChangche: false, hasAnyHaengteuk: false },
      },
    } as Partial<PipelineContext>);

    const result = await runCompetencySetekForGrade(ctx);
    expect(typeof result === "string").toBe(true);
    expect(result as string).toContain("건너뜀");
    expect(mockAnalyze).not.toHaveBeenCalled();
  });
});

// ============================================
// 6. targetGrade null → throw
// ============================================

describe("targetGrade 미설정", () => {
  it("throw Error", async () => {
    const ctx = makeCtx({ targetGrade: undefined } as Partial<PipelineContext>);
    await expect(runCompetencySetekForGrade(ctx)).rejects.toThrow("targetGrade");
  });
});

// ============================================
// 7. 창체/행특 기본 동작
// ============================================

describe("runCompetencyChangcheForGrade", () => {
  it("창체 레코드 없음 → 대상 없음", async () => {
    const ctx = makeCtx();
    const result = await runCompetencyChangcheForGrade(ctx);
    expect(typeof result === "object" ? (result as { preview: string }).preview : result).toContain("대상 없음");
  });
});

describe("runCompetencyHaengteukForGrade", () => {
  it("행특 레코드 없음 → 대상 없음 (집계 포함)", async () => {
    const ctx = makeCtx();
    const result = await runCompetencyHaengteukForGrade(ctx);
    expect(typeof result === "object" ? (result as { preview: string }).preview : result).toContain("대상 없음");
  });
});

// ============================================
// 8. 짧은 콘텐츠 필터링 (< 20자)
// ============================================

describe("짧은 콘텐츠 필터", () => {
  it("imported_content < 20자 → 분석 대상에서 제외", async () => {
    const ctx = makeCtx({
      cachedSeteks: [
        { id: "short-1", grade: 2, imported_content: "짧음", subject: { name: "국어" } },
      ],
    } as Partial<PipelineContext>);

    const result = await runCompetencySetekForGrade(ctx);
    expect(mockAnalyze).not.toHaveBeenCalled();
    expect(typeof result === "string" ? result : (result as { preview: string }).preview).toContain("대상 없음");
  });

  it("imported_content 빈 문자열 → 제외", async () => {
    const ctx = makeCtx({
      cachedSeteks: [
        { id: "empty-1", grade: 2, imported_content: "", subject: { name: "국어" } },
      ],
    } as Partial<PipelineContext>);

    const result = await runCompetencySetekForGrade(ctx);
    expect(mockAnalyze).not.toHaveBeenCalled();
  });
});
