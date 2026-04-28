// P2-1 (2026-04-28): slot-aware-score 시그니처 단위 테스트.
//
// 5개 보너스 + hard filter 의 핵심 동작을 작은 fixture 로 고정.
// 후속 Step 2.3/2.4 에서 가중치/필터 강화 시 회귀 detect.

import { describe, it, expect } from "vitest";
import {
  scoreGuideForSlot,
  SLOT_AWARE_BONUS_WEIGHTS,
  type ScoreableGuide,
  type ScoreableStudent,
} from "../slot-aware-score";
import type { Slot } from "../types";

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
      generatedAt: "2026-04-28T00:00:00Z",
      generatorVersion: "v0",
    },
    ...overrides,
  };
}

function makeGuide(overrides: Partial<ScoreableGuide> = {}): ScoreableGuide {
  return {
    id: "guide-1",
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

describe("scoreGuideForSlot", () => {
  it("hard filter — strict tier 에서 difficulty cap 초과 시 제외", () => {
    const slot = makeSlot({
      constraints: {
        maxDifficulty: "intermediate",
        excludeKeywords: [],
        mustMatchCareerFields: [],
        excludeCareerFields: [],
        tierStrictness: "strict",
      },
    });
    const guide = makeGuide({ difficultyLevel: "advanced" });
    const r = scoreGuideForSlot(guide, slot, STUDENT);
    expect(r.passesConstraints).toBe(false);
    expect(r.totalScore).toBe(0);
    expect(r.filterRejectReason).toContain("difficulty cap");
  });

  it("loose tier 는 cap 초과해도 통과 + 점수 산출", () => {
    const slot = makeSlot({
      constraints: {
        maxDifficulty: "intermediate",
        excludeKeywords: [],
        mustMatchCareerFields: [],
        excludeCareerFields: [],
        tierStrictness: "loose",
      },
    });
    const guide = makeGuide({ difficultyLevel: "advanced" });
    const r = scoreGuideForSlot(guide, slot, STUDENT);
    expect(r.passesConstraints).toBe(true);
  });

  it("tierFit — slot.tier=advanced + guide.advanced 정확 매치 시 만점", () => {
    const slot = makeSlot({ tier: "advanced" });
    const guide = makeGuide({ difficultyLevel: "advanced" });
    const r = scoreGuideForSlot(guide, slot, STUDENT);
    const tier = r.bonuses.find((b) => b.name === "tierFit")!;
    expect(tier.rawValue).toBe(1);
    expect(tier.weighted).toBe(SLOT_AWARE_BONUS_WEIGHTS.tierFit);
  });

  it("tierFit — 1단 차이는 절반, 2단 차이는 0", () => {
    const slot = makeSlot({ tier: "advanced" });
    const inter = scoreGuideForSlot(
      makeGuide({ difficultyLevel: "intermediate" }),
      slot,
      STUDENT,
    );
    const basic = scoreGuideForSlot(
      makeGuide({ difficultyLevel: "basic" }),
      slot,
      STUDENT,
    );
    expect(inter.bonuses.find((b) => b.name === "tierFit")!.rawValue).toBe(0.5);
    expect(basic.bonuses.find((b) => b.name === "tierFit")!.rawValue).toBe(0);
  });

  it("subjectFit — career_subject 슬롯에서 subjectId 정확 매치 시 만점", () => {
    const slot = makeSlot({ subareaKey: "subj-math", area: "career_subject" });
    const r = scoreGuideForSlot(
      makeGuide({ subjectId: "subj-math" }),
      slot,
      STUDENT,
    );
    const sf = r.bonuses.find((b) => b.name === "subjectFit")!;
    expect(sf.rawValue).toBe(1);
  });

  it("subjectFit — non-subject 슬롯(club 등) 은 0.5 중립", () => {
    const slot = makeSlot({ area: "club" });
    const r = scoreGuideForSlot(makeGuide({ subjectId: null }), slot, STUDENT);
    const sf = r.bonuses.find((b) => b.name === "subjectFit")!;
    expect(sf.rawValue).toBe(0.5);
  });

  it("milestoneFill — 가이드 milestone 이 슬롯 unfulfilled 와 1/2 겹치면 raw=0.5", () => {
    const slot = makeSlot({
      intent: {
        ...makeSlot().intent,
        unfulfilledMilestoneIds: ["m1", "m2"],
      },
    });
    const guide = makeGuide({ milestoneIds: ["m1"] });
    const r = scoreGuideForSlot(guide, slot, STUDENT);
    expect(r.bonuses.find((b) => b.name === "milestoneFill")!.rawValue).toBe(0.5);
  });

  it("focusFit — 키워드 3개 이상 겹치면 만점 (case-insensitive)", () => {
    const slot = makeSlot({
      intent: { ...makeSlot().intent, focusKeywords: ["AI", "윤리", "정책"] },
    });
    const guide = makeGuide({ keywords: ["ai", "윤리", "정책", "기타"] });
    const r = scoreGuideForSlot(guide, slot, STUDENT);
    expect(r.bonuses.find((b) => b.name === "focusFit")!.rawValue).toBe(1);
  });

  it("weaknessFix — 역량 2개 매치 시 만점", () => {
    const slot = makeSlot({
      intent: {
        ...makeSlot().intent,
        weakCompetencies: ["academic_inquiry", "career_exploration"],
      },
    });
    const guide = makeGuide({
      competencyFocus: ["academic_inquiry", "career_exploration"],
    });
    const r = scoreGuideForSlot(guide, slot, STUDENT);
    expect(r.bonuses.find((b) => b.name === "weaknessFix")!.rawValue).toBe(1);
  });

  it("Provenance breakdown — bonuses 5개 모두 기록", () => {
    const slot = makeSlot();
    const r = scoreGuideForSlot(makeGuide(), slot, STUDENT);
    expect(r.bonuses).toHaveLength(5);
    const names = r.bonuses.map((b) => b.name).sort();
    expect(names).toEqual([
      "focusFit",
      "milestoneFill",
      "subjectFit",
      "tierFit",
      "weaknessFix",
    ]);
    for (const b of r.bonuses) {
      expect(typeof b.rationale).toBe("string");
      expect(b.weighted).toBe(b.rawValue * SLOT_AWARE_BONUS_WEIGHTS[b.name]);
    }
  });
});
