// ============================================
// derive-main-theme-runner 단위 테스트 (M1-c W6, 2026-04-27)
//
// 검증 시나리오:
//  1. 진로 정보 전무 → graceful skip (LLM 호출 0)
//  2. 처음 호출 → capability 2회 호출 + ctx.belief 시딩 + ctx.results 영속
//  3. 동일 입력 재호출 → structuralHash cache hit (LLM 호출 0)
//  4. 입력 변경 (수강계획) → cache miss, capability 재호출
//  5. deriveMainTheme 실패 → cascadePlan 호출 안 함, ctx.belief 미시딩
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// Capability mock
vi.mock("../capability/main-theme", () => ({
  deriveMainTheme: vi.fn(),
}));
vi.mock("../capability/cascade-plan", () => ({
  buildCascadePlan: vi.fn(),
}));

import { runDeriveMainThemeForGrade } from "../pipeline/pipeline-task-runners-main-theme";
import { deriveMainTheme } from "../capability/main-theme";
import { buildCascadePlan } from "../capability/cascade-plan";

// 가짜 supabase chain — maybeSingle / order / limit / select 호출에 안전.
function makeFakeSupabase(opts?: {
  classificationName?: string | null;
  previousPipelines?: Array<{ task_results: Record<string, unknown> }>;
}) {
  const previous = opts?.previousPipelines ?? [];
  const classification = opts?.classificationName ?? null;

  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: classification ? { name: classification } : null,
    }),
    // student_record_analysis_pipelines 쿼리 시 await chain 종결로 사용
    then: undefined as unknown,
  };
  // 마지막 .order().eq().eq().limit() 가 await 으로 풀릴 때 data 반환되도록 thenable
  const thenable = {
    ...builder,
    then(resolve: (v: unknown) => void) {
      resolve({ data: previous });
    },
  };
  builder.order = vi.fn().mockReturnValue(thenable);
  builder.limit = vi.fn().mockReturnValue(thenable);

  return {
    from: vi.fn().mockReturnValue(builder),
  };
}

function makeCtx(overrides: Partial<{
  targetMajor: string | null;
  desiredCareerField: string | null;
  classificationId: number | null;
  resolvedRecords: Record<number, unknown>;
  coursePlanData: { plans: Array<{ grade: number; subject_name: string }> };
  neisGrades: number[];
  consultingGrades: number[];
  studentGrade: number;
  previousPipelines: Array<{ task_results: Record<string, unknown> }>;
  classificationName: string | null;
}>) {
  const supabase = makeFakeSupabase({
    classificationName: overrides.classificationName,
    previousPipelines: overrides.previousPipelines,
  });
  const has = <K extends keyof typeof overrides>(k: K) =>
    Object.prototype.hasOwnProperty.call(overrides, k);
  return {
    studentId: "stu-1",
    tenantId: "ten-1",
    studentGrade: overrides.studentGrade ?? 2,
    snapshot: {
      target_major: has("targetMajor") ? overrides.targetMajor : "의예과",
      desired_career_field: has("desiredCareerField") ? overrides.desiredCareerField : "자연계열",
      classification_id: has("classificationId") ? overrides.classificationId : null,
    },
    belief: {
      resolvedRecords: overrides.resolvedRecords ?? {},
      blueprint: undefined,
    } as Record<string, unknown>,
    coursePlanData: overrides.coursePlanData ?? { plans: [] },
    neisGrades: overrides.neisGrades ?? [],
    consultingGrades: overrides.consultingGrades ?? [1, 2, 3],
    results: {} as Record<string, unknown>,
    supabase,
  } as unknown as Parameters<typeof runDeriveMainThemeForGrade>[0];
}

const FAKE_THEME = {
  label: "정밀의료의 윤리·정책",
  rationale: "의예과 + 정책에 관심을 보이는 발화",
  sourceCitations: ["career:의예과"],
  keywords: ["정밀의료", "윤리", "정책"],
};

const FAKE_CASCADE = {
  themeLabel: "정밀의료의 윤리·정책",
  byGrade: {
    "1": {
      tier: "foundational" as const,
      subjects: ["통합과학"],
      contentSummary: "기초",
      rationale: "기초 단계",
    },
    "2": {
      tier: "development" as const,
      subjects: ["생명과학I"],
      contentSummary: "발전",
      rationale: "발전 단계",
    },
    "3": {
      tier: "advanced" as const,
      subjects: ["생명과학II"],
      contentSummary: "심화",
      rationale: "심화 단계",
    },
  },
};

beforeEach(() => {
  vi.mocked(deriveMainTheme).mockReset();
  vi.mocked(buildCascadePlan).mockReset();
});

describe("derive_main_theme runner", () => {
  it("진로 정보 전무 → graceful skip (LLM 호출 0)", async () => {
    const ctx = makeCtx({
      targetMajor: null,
      desiredCareerField: null,
      classificationId: null,
    });

    const result = await runDeriveMainThemeForGrade(ctx);

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe("no_career_info");
    expect(result.themeOk).toBe(false);
    expect(deriveMainTheme).not.toHaveBeenCalled();
    expect(buildCascadePlan).not.toHaveBeenCalled();
  });

  it("처음 호출 → capability 2회 호출 + belief 시딩 + results 영속", async () => {
    vi.mocked(deriveMainTheme).mockResolvedValue({
      ok: true,
      theme: FAKE_THEME,
      elapsedMs: 100,
    });
    vi.mocked(buildCascadePlan).mockResolvedValue({
      ok: true,
      plan: FAKE_CASCADE,
      elapsedMs: 120,
    });

    const ctx = makeCtx({});
    const result = await runDeriveMainThemeForGrade(ctx);

    expect(result.themeOk).toBe(true);
    expect(result.cascadeOk).toBe(true);
    expect(result.fromCache).toBe(false);
    expect(result.structuralHash).toBeTruthy();

    expect(deriveMainTheme).toHaveBeenCalledTimes(1);
    expect(buildCascadePlan).toHaveBeenCalledTimes(1);

    // belief 즉시 시딩
    expect((ctx as unknown as { belief: Record<string, unknown> }).belief.mainTheme).toEqual(FAKE_THEME);
    expect((ctx as unknown as { belief: Record<string, unknown> }).belief.cascadePlan).toEqual(FAKE_CASCADE);

    // results 영속 — Synthesis D4 시딩에서 회수할 키
    expect((ctx as unknown as { results: Record<string, unknown> }).results._mainTheme).toEqual(FAKE_THEME);
    expect((ctx as unknown as { results: Record<string, unknown> }).results._cascadePlan).toEqual(FAKE_CASCADE);
    expect((ctx as unknown as { results: Record<string, unknown> }).results._mainThemeMeta).toBeDefined();
  });

  it("동일 입력 재호출 → structuralHash cache hit (LLM 호출 0)", async () => {
    // 1차 호출로 hash 도출
    vi.mocked(deriveMainTheme).mockResolvedValueOnce({
      ok: true,
      theme: FAKE_THEME,
      elapsedMs: 100,
    });
    vi.mocked(buildCascadePlan).mockResolvedValueOnce({
      ok: true,
      plan: FAKE_CASCADE,
      elapsedMs: 120,
    });
    const firstCtx = makeCtx({});
    const firstResult = await runDeriveMainThemeForGrade(firstCtx);
    const firstHash = firstResult.structuralHash;

    // 2차 호출 — 동일 입력 + 이전 결과 영속본 주입
    const previousPipelines = [
      {
        task_results: {
          _mainTheme: FAKE_THEME,
          _cascadePlan: FAKE_CASCADE,
          _mainThemeMeta: { structuralHash: firstHash },
        },
      },
    ];
    const secondCtx = makeCtx({ previousPipelines });
    const secondResult = await runDeriveMainThemeForGrade(secondCtx);

    expect(secondResult.fromCache).toBe(true);
    expect(secondResult.themeOk).toBe(true);
    expect(secondResult.cascadeOk).toBe(true);
    expect(secondResult.structuralHash).toBe(firstHash);

    // capability 추가 호출 0
    expect(deriveMainTheme).toHaveBeenCalledTimes(1); // 1차에서만
    expect(buildCascadePlan).toHaveBeenCalledTimes(1);

    // belief 재시딩 확인
    expect((secondCtx as unknown as { belief: Record<string, unknown> }).belief.mainTheme).toEqual(FAKE_THEME);
  });

  it("수강계획 변경 → cache miss, capability 재호출", async () => {
    vi.mocked(deriveMainTheme).mockResolvedValue({
      ok: true,
      theme: FAKE_THEME,
      elapsedMs: 100,
    });
    vi.mocked(buildCascadePlan).mockResolvedValue({
      ok: true,
      plan: FAKE_CASCADE,
      elapsedMs: 120,
    });

    // 1차: 수강계획 없음
    const ctxA = makeCtx({});
    const resultA = await runDeriveMainThemeForGrade(ctxA);

    // 2차: 수강계획 변경 (이전 hash 와 다른 결과 보장)
    const previousPipelines = [
      {
        task_results: {
          _mainTheme: FAKE_THEME,
          _cascadePlan: FAKE_CASCADE,
          _mainThemeMeta: { structuralHash: resultA.structuralHash },
        },
      },
    ];
    const ctxB = makeCtx({
      previousPipelines,
      coursePlanData: {
        plans: [{ grade: 2, subject_name: "생명과학I" }],
      },
    });
    const resultB = await runDeriveMainThemeForGrade(ctxB);

    expect(resultB.fromCache).toBe(false);
    expect(resultB.structuralHash).not.toBe(resultA.structuralHash);
    // 2번째 ctx 에서 다시 capability 호출
    expect(deriveMainTheme).toHaveBeenCalledTimes(2);
    expect(buildCascadePlan).toHaveBeenCalledTimes(2);
  });

  it("deriveMainTheme 실패 → cascadePlan 호출 안 함, belief 미시딩", async () => {
    vi.mocked(deriveMainTheme).mockResolvedValue({
      ok: false,
      reason: "LLM 응답 파싱 실패",
    });

    const ctx = makeCtx({});
    const result = await runDeriveMainThemeForGrade(ctx);

    expect(result.themeOk).toBe(false);
    expect(result.cascadeOk).toBe(false);
    expect(result.fromCache).toBe(false);

    expect(deriveMainTheme).toHaveBeenCalledTimes(1);
    expect(buildCascadePlan).not.toHaveBeenCalled();

    expect((ctx as unknown as { belief: Record<string, unknown> }).belief.mainTheme).toBeUndefined();
    expect((ctx as unknown as { belief: Record<string, unknown> }).belief.cascadePlan).toBeUndefined();
  });
});
