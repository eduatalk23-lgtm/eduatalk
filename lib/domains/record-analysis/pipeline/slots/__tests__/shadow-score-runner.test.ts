// Step B Shadow 측정 — runSlotAwareScoreShadow 단위 테스트.
//
// 매칭 무영향(graceful) 보장 + 박제 형식 + Top-K 정렬 검증.

import { describe, it, expect, vi } from "vitest";
import { runSlotAwareScoreShadow } from "../shadow-score-runner";
import type { Slot } from "../types";
import type { RankedGuide } from "@/lib/domains/guide/capability/ranking";

function makeSlot(overrides: Partial<Slot> = {}): Slot {
  return {
    id: "g1_career_subject:math_advanced#abc",
    grade: 1,
    area: "career_subject",
    subareaKey: "subj-math",
    tier: "advanced",
    intent: {
      contentSummary: "",
      rationale: "",
      unfulfilledMilestoneIds: [],
      targetConvergenceIds: [],
      focusHypothesis: null,
      focusKeywords: [],
      weakCompetencies: [],
      qualityIssuesToCover: [],
    },
    constraints: {
      maxDifficulty: "advanced",
      excludeKeywords: [],
      mustMatchCareerFields: [],
      excludeCareerFields: [],
      tierStrictness: "loose",
    },
    state: {
      expectedCount: 1,
      currentCount: 0,
      fillRatio: 0,
      priority: 50,
      isFulfilled: false,
    },
    derivedFrom: {
      blueprintId: null,
      cascadeNodeRef: null,
      tierPlanRef: null,
      midPlanRef: null,
      generatedAt: "2026-04-29",
      generatorVersion: "v2.0",
    },
    ...overrides,
  };
}

function makeRanked(id: string, title: string): RankedGuide {
  return {
    id,
    title,
    guide_type: "topic_exploration",
    match_reason: "",
    baseScore: 1,
    continuityScore: 1,
    difficultyScore: 1,
    sequelBonus: 1,
    majorBonus: 1,
    hyperedgeBonus: 1,
    narrativeArcBonus: 1,
    storylineBonus: 1,
    midPlanBonus: 1,
    finalScore: 1,
  } as unknown as RankedGuide;
}

function makeMockSupabase(opts: {
  subjectMappings?: Array<{ guide_id: string; subject_id: string }>;
  guides?: Array<{ id: string; difficulty_level: string | null }>;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "exploration_guide_subject_mappings") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: opts.subjectMappings ?? [] }),
          }),
        };
      }
      if (table === "exploration_guides") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: opts.guides ?? [] }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

function makeCtx(slots: Slot[], supabase: unknown) {
  return {
    supabase,
    results: { _slots: slots as unknown as Record<string, unknown> },
    previews: {} as Record<string, string>,
  };
}

describe("runSlotAwareScoreShadow — graceful behavior", () => {
  it("slots 빈 경우 박제 안 함", async () => {
    const supabase = makeMockSupabase({});
    const ctx = makeCtx([], supabase);
    await runSlotAwareScoreShadow({
      ctx: ctx as never,
      studentId: "s1",
      tenantId: "t1",
      ranked: [makeRanked("g1", "Guide 1")],
      maxDifficultyByGrade: { 1: "advanced", 2: "advanced", 3: "advanced" },
    });
    expect(ctx.results["_slotAwareScores"]).toBeUndefined();
  });

  it("ranked 빈 경우 박제 안 함", async () => {
    const supabase = makeMockSupabase({});
    const ctx = makeCtx([makeSlot()], supabase);
    await runSlotAwareScoreShadow({
      ctx: ctx as never,
      studentId: "s1",
      tenantId: "t1",
      ranked: [],
      maxDifficultyByGrade: { 1: "advanced", 2: "advanced", 3: "advanced" },
    });
    expect(ctx.results["_slotAwareScores"]).toBeUndefined();
  });

  it("DB 에러 시 graceful — 매칭 무중단", async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error("db down");
      }),
    };
    const ctx = makeCtx([makeSlot()], supabase);
    await expect(
      runSlotAwareScoreShadow({
        ctx: ctx as never,
        studentId: "s1",
        tenantId: "t1",
        ranked: [makeRanked("g1", "Guide 1")],
        maxDifficultyByGrade: { 1: "advanced", 2: "advanced", 3: "advanced" },
      }),
    ).resolves.toBeUndefined();
    expect(ctx.results["_slotAwareScores"]).toBeUndefined();
  });
});

describe("runSlotAwareScoreShadow — 박제 형식", () => {
  it("topKPerSlot + stats 박제, preview 요약 포함", async () => {
    const supabase = makeMockSupabase({
      subjectMappings: [
        { guide_id: "g1", subject_id: "subj-math" },
        { guide_id: "g2", subject_id: "subj-math" },
      ],
      guides: [
        { id: "g1", difficulty_level: "advanced" },
        { id: "g2", difficulty_level: "basic" },
      ],
    });
    const slot = makeSlot();
    const ctx = makeCtx([slot], supabase);
    await runSlotAwareScoreShadow({
      ctx: ctx as never,
      studentId: "s1",
      tenantId: "t1",
      ranked: [makeRanked("g1", "Advanced Math"), makeRanked("g2", "Basic Math")],
      maxDifficultyByGrade: { 1: "advanced", 2: "advanced", 3: "advanced" },
    });
    const result = ctx.results["_slotAwareScores"] as unknown as {
      topKPerSlot: Array<{ slotId: string; candidates: Array<{ guideId: string; breakdown: { totalScore: number } }> }>;
      stats: { slotCount: number; rankedCount: number; pairsScored: number };
    };
    expect(result.stats.slotCount).toBe(1);
    expect(result.stats.rankedCount).toBe(2);
    expect(result.stats.pairsScored).toBe(2);
    expect(result.topKPerSlot[0].slotId).toBe(slot.id);
    // advanced slot tier + advanced guide → tierFit 만점, basic guide 보다 totalScore 높음
    const candidates = result.topKPerSlot[0].candidates;
    expect(candidates[0].guideId).toBe("g1");
    expect(candidates[0].breakdown.totalScore).toBeGreaterThan(candidates[1].breakdown.totalScore);
    expect(ctx.previews["slot_aware_score_shadow"]).toBeDefined();
  });
});
