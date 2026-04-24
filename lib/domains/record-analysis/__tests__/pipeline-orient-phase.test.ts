// ============================================
// Orient Phase MVP 규칙 단위 테스트 (Step 2, 2026-04-24)
// ============================================

import { describe, it, expect } from "vitest";
import {
  runOrientPhase,
  skipIfOrientSkipped,
} from "../pipeline/pipeline-orient-phase";
import type { PipelineContext } from "../pipeline/pipeline-types";

function makeCtx(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    pipelineId: "p1",
    studentId: "s1",
    tenantId: "t1",
    supabase: {} as PipelineContext["supabase"],
    studentGrade: 2,
    snapshot: null,
    tasks: {},
    previews: {},
    results: {},
    errors: {},
    pipelineType: "grade",
    belief: {},
    ...overrides,
  };
}

describe("runOrientPhase", () => {
  it("규칙 1: gradeMode='analysis' → draft_* 3종 skip", async () => {
    const ctx = makeCtx({ gradeMode: "analysis" });
    const d = await runOrientPhase(ctx);
    expect(d.skipTasks).toContain("draft_generation");
    expect(d.skipTasks).toContain("draft_analysis");
    expect(d.skipTasks).toContain("draft_refinement");
    expect(d.rationale.some((r) => r.includes("분석 모드"))).toBe(true);
  });

  it("규칙 1: 전 학년 NEIS 완비 → draft_* 3종 skip", async () => {
    const ctx = makeCtx({
      resolvedRecords: {
        1: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: true },
        2: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: true },
        3: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: true },
      },
    });
    const d = await runOrientPhase(ctx);
    expect(d.skipTasks).toContain("draft_generation");
    expect(d.skipTasks).toContain("draft_analysis");
    expect(d.skipTasks).toContain("draft_refinement");
    expect(d.rationale.some((r) => r.includes("NEIS 완비"))).toBe(true);
  });

  it("규칙 2: prioritizedWeaknesses 0건 → competency_* fast tier 권고", async () => {
    const ctx = makeCtx({
      narrativeContext: { prioritizedWeaknesses: [], recordPriorityOrder: [] },
    });
    const d = await runOrientPhase(ctx);
    expect(d.modelTier.competency_setek).toBe("fast");
    expect(d.modelTier.competency_changche).toBe("fast");
    expect(d.modelTier.competency_haengteuk).toBe("fast");
  });

  it("규칙 3: 1학년 + NEIS 전무 → competency_* fast tier", async () => {
    const ctx = makeCtx({
      studentGrade: 1,
      resolvedRecords: {
        1: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: false },
      },
    });
    const d = await runOrientPhase(ctx);
    expect(d.modelTier.competency_setek).toBe("fast");
    expect(d.rationale.some((r) => r.includes("1학년 온보딩"))).toBe(true);
  });

  it("규칙 4: 기본값 — 빈 skipTasks / 빈 modelTier / 기본 경로 rationale", async () => {
    const ctx = makeCtx({
      studentGrade: 2,
      resolvedRecords: {
        2: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: false },
      },
      narrativeContext: {
        prioritizedWeaknesses: [
          {
            source: "competency",
            code: "academic_inquiry",
            label: "학업 탐구",
            severity: "high",
            rationale: "C 등급",
            weight: 3,
          },
        ],
        recordPriorityOrder: [],
      },
    });
    const d = await runOrientPhase(ctx);
    expect(d.skipTasks).toEqual([]);
    expect(Object.keys(d.modelTier)).toEqual([]);
    expect(d.rationale.some((r) => r.includes("기본 경로"))).toBe(true);
  });
});

describe("skipIfOrientSkipped", () => {
  it("plannerDirective 없으면 false", () => {
    const ctx = makeCtx();
    expect(skipIfOrientSkipped(ctx, "draft_generation")).toBe(false);
  });

  it("skipTasks 에 포함되면 true + failed 마킹", () => {
    const ctx = makeCtx({
      plannerDirective: {
        skipTasks: ["draft_generation"],
        modelTier: {},
        rationale: ["테스트"],
      },
    });
    expect(skipIfOrientSkipped(ctx, "draft_generation")).toBe(true);
    expect(ctx.tasks.draft_generation).toBe("failed");
    expect(ctx.errors.draft_generation).toContain("테스트");
  });

  it("이미 completed 이면 true (중복 실행 방지)", () => {
    const ctx = makeCtx({
      tasks: { draft_generation: "completed" },
      plannerDirective: { skipTasks: [], modelTier: {}, rationale: [] },
    });
    expect(skipIfOrientSkipped(ctx, "draft_generation")).toBe(true);
  });

  it("skipTasks 에 없으면 false (기본 경로)", () => {
    const ctx = makeCtx({
      plannerDirective: { skipTasks: [], modelTier: {}, rationale: [] },
    });
    expect(skipIfOrientSkipped(ctx, "draft_generation")).toBe(false);
  });
});
