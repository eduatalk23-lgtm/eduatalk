// 권고3 / Step 2.3 — slot-hard-filter 단위 테스트.

import { describe, it, expect } from "vitest";
import { applyHardFilter } from "../slot-hard-filter";
import type { Slot } from "../types";
import type { ScoreableGuide, ScoreableStudent } from "../slot-aware-score";

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
      unfulfilledMilestones: [],
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
      generatedAt: "2026-04-28T00:00:00Z",
      generatorVersion: "v0",
    },
    ...overrides,
  };
}

function makeGuide(overrides: Partial<ScoreableGuide> = {}): ScoreableGuide {
  return {
    id: "g1",
    subjectId: null,
    subjectName: null,
    difficultyLevel: "intermediate",
    keywords: [],
    competencyFocus: [],
    milestoneIds: [],
    careerFields: [],
    ...overrides,
  };
}

const STUDENT: ScoreableStudent = {
  studentId: "s1",
  maxDifficultyByGrade: { 1: "advanced", 2: "advanced", 3: "advanced" },
  careerCompatibility: [],
};

describe("applyHardFilter", () => {
  it("H1 difficulty cap — guide=advanced > slot.maxDifficulty=intermediate → block (relax 무시)", () => {
    const slot = makeSlot({
      constraints: { ...makeSlot().constraints, maxDifficulty: "intermediate" },
    });
    const r = applyHardFilter(
      makeGuide({ difficultyLevel: "advanced" }),
      slot,
      STUDENT,
      { relaxLevel: 3 }, // 최대 완화여도 H1 은 통과 X
    );
    expect(r.passes).toBe(false);
    expect(r.rejectedBy).toBe("difficulty_cap");
  });

  it("H2 F16 — regular_subject 슬롯 + mainTheme 키워드 3개 매칭 → block", () => {
    const slot = makeSlot({ area: "regular_subject" });
    const r = applyHardFilter(
      makeGuide({ keywords: ["AI", "윤리", "정책"] }),
      slot,
      STUDENT,
      { mainThemeKeywords: ["AI", "윤리", "정책"], f16Threshold: 3 },
    );
    expect(r.passes).toBe(false);
    expect(r.rejectedBy).toBe("career_overuse");
  });

  it("H2 F16 — career_subject 슬롯에서는 mainTheme 매칭이 의도된 결과 → pass", () => {
    const slot = makeSlot({ area: "career_subject" });
    const r = applyHardFilter(
      makeGuide({ keywords: ["AI", "윤리", "정책"] }),
      slot,
      STUDENT,
      { mainThemeKeywords: ["AI", "윤리", "정책"], f16Threshold: 3 },
    );
    expect(r.passes).toBe(true);
  });

  it("H5 mustMatchCareerFields — required 필드 누락 시 block", () => {
    const slot = makeSlot({
      constraints: {
        ...makeSlot().constraints,
        mustMatchCareerFields: ["medicine", "biology"],
      },
    });
    const r = applyHardFilter(
      makeGuide({ careerFields: ["medicine"] }),
      slot,
      STUDENT,
    );
    expect(r.passes).toBe(false);
    expect(r.rejectedBy).toBe("missing_required_career");
  });

  it("H6 tier strict — strict + 가이드 difficulty 가 tier 와 정확히 다르면 block", () => {
    const slot = makeSlot({
      tier: "advanced",
      constraints: { ...makeSlot().constraints, tierStrictness: "strict" },
    });
    const r = applyHardFilter(
      makeGuide({ difficultyLevel: "intermediate" }),
      slot,
      STUDENT,
    );
    expect(r.passes).toBe(false);
    expect(r.rejectedBy).toBe("tier_strict_mismatch");
  });

  it("H6 relaxLevel=1 — strict 미스매치 완화 → pass", () => {
    const slot = makeSlot({
      tier: "advanced",
      constraints: { ...makeSlot().constraints, tierStrictness: "strict" },
    });
    const r = applyHardFilter(
      makeGuide({ difficultyLevel: "intermediate" }),
      slot,
      STUDENT,
      { relaxLevel: 1 },
    );
    expect(r.passes).toBe(true);
  });

  it("H3 excludeKeywords — 매치 시 block, relaxLevel=3 시 통과", () => {
    const slot = makeSlot({
      constraints: { ...makeSlot().constraints, excludeKeywords: ["pseudoscience"] },
    });
    const block = applyHardFilter(
      makeGuide({ keywords: ["pseudoscience"] }),
      slot,
      STUDENT,
    );
    expect(block.passes).toBe(false);
    expect(block.rejectedBy).toBe("exclude_keyword");

    const relaxed = applyHardFilter(
      makeGuide({ keywords: ["pseudoscience"] }),
      slot,
      STUDENT,
      { relaxLevel: 3 },
    );
    expect(relaxed.passes).toBe(true);
  });

  it("기본 케이스 — 모든 hard rule 통과", () => {
    const slot = makeSlot();
    const r = applyHardFilter(makeGuide(), slot, STUDENT);
    expect(r.passes).toBe(true);
    expect(r.rejectedBy).toBe(null);
  });
});
