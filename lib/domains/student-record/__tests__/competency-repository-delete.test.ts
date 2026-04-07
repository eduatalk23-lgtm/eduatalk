// ============================================
// competency-repository deleteAnalysisResultsByGrade 유닛 테스트
//
// 대상 함수:
//   deleteAnalysisResultsByGrade — 특정 학년의 AI 파생 분석 데이터 3테이블 삭제
//
// 전략:
//   createSupabaseServerClient → supabase 체이닝 mock
//   3단계 검증: record ID 조회 → score 삭제 → tags+quality 병렬 삭제
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 의존성 mock ──

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionError: vi.fn(),
  logActionWarn: vi.fn(),
  logActionDebug: vi.fn(),
}));

import { deleteAnalysisResultsByGrade } from "../repository/competency-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionWarn } from "@/lib/logging/actionLogger";

const mockClientFactory = createSupabaseServerClient as ReturnType<typeof vi.fn>;
const mockLogWarn = logActionWarn as ReturnType<typeof vi.fn>;

// ── 헬퍼 ──

interface QueryChain {
  select: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  _result: { data: { id: string }[] | null; error: null | { message: string } };
}

function makeChain(data: { id: string }[] | null = [], error: null | { message: string } = null): QueryChain {
  const chain: QueryChain = {
    select: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    _result: { data, error },
  };
  // 터미널 호출 시 결과 반환 (Promise.all 내에서)
  // eq/is/in이 마지막으로 호출될 때 결과를 반환하도록 설정
  chain.eq.mockImplementation(() => chain);
  chain.is.mockImplementation(() => chain);
  chain.in.mockImplementation(() => chain);
  chain.select.mockImplementation(() => chain);
  chain.delete.mockImplementation(() => chain);
  // then을 추가하여 Promise처럼 동작
  (chain as unknown as { then: (fn: (v: unknown) => unknown) => Promise<unknown> }).then = (fn) =>
    Promise.resolve(fn(chain._result));
  return chain;
}

// supabase.from() 호출 시 테이블별 체인을 반환하도록 설정
let tableChains: Record<string, QueryChain>;

function setupMock(overrides?: Partial<Record<string, QueryChain>>) {
  tableChains = {
    student_record_seteks: makeChain([{ id: "s1" }, { id: "s2" }]),
    student_record_changche: makeChain([{ id: "c1" }]),
    student_record_haengteuk: makeChain([{ id: "h1" }]),
    student_record_competency_scores: makeChain([]),
    student_record_activity_tags: makeChain([]),
    student_record_content_quality: makeChain([]),
    ...overrides,
  };

  const fromFn = vi.fn((table: string) => {
    return tableChains[table] ?? makeChain([]);
  });

  mockClientFactory.mockResolvedValue({ from: fromFn });
}

// ── 테스트 ──

describe("deleteAnalysisResultsByGrade", () => {
  const STUDENT_ID = "student-1";
  const TENANT_ID = "tenant-1";
  const GRADE = 1;
  const TARGET_YEAR = 2025;

  beforeEach(() => {
    vi.clearAllMocks();
    setupMock();
  });

  it("3종 레코드 테이블에서 record ID를 조회한다", async () => {
    await deleteAnalysisResultsByGrade(STUDENT_ID, TENANT_ID, GRADE, TARGET_YEAR);

    const fromFn = (await createSupabaseServerClient() as { from: ReturnType<typeof vi.fn> }).from;
    const calledTables = fromFn.mock.calls.map((c: string[]) => c[0]);
    expect(calledTables).toContain("student_record_seteks");
    expect(calledTables).toContain("student_record_changche");
    expect(calledTables).toContain("student_record_haengteuk");
  });

  it("competency_scores를 school_year + source 필터로 삭제한다", async () => {
    await deleteAnalysisResultsByGrade(STUDENT_ID, TENANT_ID, GRADE, TARGET_YEAR);

    const scoreChain = tableChains.student_record_competency_scores;
    expect(scoreChain.delete).toHaveBeenCalled();
    // eq 호출에 student_id, tenant_id, school_year 포함 확인
    const eqCalls = scoreChain.eq.mock.calls.map((c: string[]) => c[0]);
    expect(eqCalls).toContain("student_id");
    expect(eqCalls).toContain("tenant_id");
    expect(eqCalls).toContain("school_year");
    // in 호출에 source 필터 확인
    const inCalls = scoreChain.in.mock.calls.map((c: string[]) => c[0]);
    expect(inCalls).toContain("source");
  });

  it("activity_tags를 record_id + tag_context 필터로 삭제한다", async () => {
    await deleteAnalysisResultsByGrade(STUDENT_ID, TENANT_ID, GRADE, TARGET_YEAR);

    const tagChain = tableChains.student_record_activity_tags;
    expect(tagChain.delete).toHaveBeenCalled();
    const inCalls = tagChain.in.mock.calls.map((c: string[]) => c[0]);
    expect(inCalls).toContain("record_id");
    expect(inCalls).toContain("tag_context");
  });

  it("content_quality를 record_id + source 필터로 삭제한다", async () => {
    await deleteAnalysisResultsByGrade(STUDENT_ID, TENANT_ID, GRADE, TARGET_YEAR);

    const qualityChain = tableChains.student_record_content_quality;
    expect(qualityChain.delete).toHaveBeenCalled();
    const inCalls = qualityChain.in.mock.calls.map((c: string[]) => c[0]);
    expect(inCalls).toContain("record_id");
    expect(inCalls).toContain("source");
  });

  it("recordIds가 비어있으면 scores만 삭제하고 tags/quality는 스킵", async () => {
    setupMock({
      student_record_seteks: makeChain([]),
      student_record_changche: makeChain([]),
      student_record_haengteuk: makeChain([]),
    });

    await deleteAnalysisResultsByGrade(STUDENT_ID, TENANT_ID, GRADE, TARGET_YEAR);

    // scores는 school_year 기반이므로 recordIds 없이도 삭제
    const scoreChain = tableChains.student_record_competency_scores;
    expect(scoreChain.delete).toHaveBeenCalled();

    // tags/quality는 호출 안 됨 (recordIds 없으므로)
    const tagChain = tableChains.student_record_activity_tags;
    const qualityChain = tableChains.student_record_content_quality;
    expect(tagChain.delete).not.toHaveBeenCalled();
    expect(qualityChain.delete).not.toHaveBeenCalled();
  });

  it("score 삭제 실패 시 경고 로그만 남기고 throw하지 않는다", async () => {
    setupMock({
      student_record_competency_scores: makeChain(null, { message: "score delete error" }),
    });

    await expect(
      deleteAnalysisResultsByGrade(STUDENT_ID, TENANT_ID, GRADE, TARGET_YEAR),
    ).resolves.toBeUndefined();

    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.objectContaining({ action: "deleteAnalysisResultsByGrade" }),
      expect.stringContaining("역량 점수 삭제 실패"),
      expect.any(Object),
    );
  });

  it("tag 삭제 실패 시 경고 로그만 남긴다", async () => {
    setupMock({
      student_record_activity_tags: makeChain(null, { message: "tag delete error" }),
    });

    await expect(
      deleteAnalysisResultsByGrade(STUDENT_ID, TENANT_ID, GRADE, TARGET_YEAR),
    ).resolves.toBeUndefined();

    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.objectContaining({ action: "deleteAnalysisResultsByGrade" }),
      expect.stringContaining("태그 삭제 실패"),
      expect.any(Object),
    );
  });

  it("quality 삭제 실패 시 경고 로그만 남긴다", async () => {
    setupMock({
      student_record_content_quality: makeChain(null, { message: "quality delete error" }),
    });

    await expect(
      deleteAnalysisResultsByGrade(STUDENT_ID, TENANT_ID, GRADE, TARGET_YEAR),
    ).resolves.toBeUndefined();

    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.objectContaining({ action: "deleteAnalysisResultsByGrade" }),
      expect.stringContaining("품질 삭제 실패"),
      expect.any(Object),
    );
  });
});
