// ============================================
// pipeline/slots/__tests__/slot-generator.test.ts
//
// Step 2.1 Slot Generator 단위 테스트 (8 케이스).
// ============================================

import { describe, it, expect } from "vitest";
import { generateSlots } from "../slot-generator";
import { makeSlotId } from "../slot-id";
import { computeSlotPriority } from "../slot-priority";
import { expectedCountFor } from "../slot-config";
import type { CascadePlan } from "../../../capability/cascade-plan";
import type { SlotGeneratorInput, Slot } from "../types";

// ── 헬퍼 ─────────────────────────────────────

function buildCascade(byGrade: Record<number, Partial<CascadePlan["byGrade"][string]>>): CascadePlan {
  const map: CascadePlan["byGrade"] = {};
  for (const [g, node] of Object.entries(byGrade)) {
    map[g] = {
      tier: node.tier ?? "development",
      subjects: node.subjects ?? [],
      contentSummary: node.contentSummary ?? "기본 요약",
      rationale: node.rationale ?? "기본 근거",
      evidenceFromNeis: node.evidenceFromNeis,
    } as CascadePlan["byGrade"][string];
  }
  return { themeLabel: "AI 의료영상", byGrade: map };
}

function baseInput(overrides?: Partial<SlotGeneratorInput>): SlotGeneratorInput {
  return {
    studentId: "test-student",
    tenantId: "test-tenant",
    currentGrade: 2,
    blueprint: null,
    blueprintId: null,
    cascadePlan: null,
    tierPlan: null,
    midPlanByGrade: {},
    coursePlanByGrade: {},
    weakCompetenciesByGrade: {},
    qualityIssuesByGrade: {},
    maxDifficultyByGrade: {},
    careerCompatibility: ["의료보건"],
    mainThemeKeywords: ["AI", "의료영상", "진단"],
    ...overrides,
  };
}

// ── 테스트 ───────────────────────────────────

describe("generateSlots — 1. 정상 케이스 (G1+G2+G3 모두 cascadeNode 존재)", () => {
  it("3학년분 슬롯 모두 도출 — 학년당 최소 4개(고정 area)", () => {
    const input = baseInput({
      cascadePlan: buildCascade({
        1: { tier: "foundational", subjects: ["생명과학I", "정보"] },
        2: { tier: "development", subjects: ["생명과학II", "확률과통계"] },
        3: { tier: "advanced", subjects: ["미적분", "화학II"] },
      }),
    });
    const out = generateSlots(input);
    // 학년당: 교과 슬롯 2개 + 고정 4개(club·career·autonomy·haengteuk) = 6개
    // 3학년 × 6 = 18 슬롯 (최소)
    expect(out.slots.length).toBeGreaterThanOrEqual(18);
    expect(out.generationStats.byGrade[1]).toBeGreaterThanOrEqual(6);
    expect(out.generationStats.byGrade[2]).toBeGreaterThanOrEqual(6);
    expect(out.generationStats.byGrade[3]).toBeGreaterThanOrEqual(6);
    expect(out.warnings.length).toBe(0);
  });
});

describe("generateSlots — 2. G1 cascadeNode 없음 (전입생 시뮬레이션)", () => {
  it("G1 슬롯 0개 + warning + G2/G3 정상", () => {
    const input = baseInput({
      cascadePlan: buildCascade({
        2: { tier: "development", subjects: ["생명과학II"] },
        3: { tier: "advanced", subjects: ["미적분"] },
      }),
    });
    const out = generateSlots(input);
    expect(out.generationStats.byGrade[1] ?? 0).toBe(0);
    expect(out.generationStats.byGrade[2]).toBeGreaterThan(0);
    expect(out.generationStats.byGrade[3]).toBeGreaterThan(0);
    expect(out.warnings.some((w) => w.includes("G1") && w.includes("cascadeNode 없음"))).toBe(true);
  });
});

describe("generateSlots — 3. cascadePlan 자체 null", () => {
  it("슬롯 0개 + warnings 3개(학년별)", () => {
    const input = baseInput({ cascadePlan: null });
    const out = generateSlots(input);
    expect(out.slots.length).toBe(0);
    expect(out.warnings.length).toBe(3);
    expect(out.generationStats.totalSlots).toBe(0);
  });
});

describe("generateSlots — 4. 진로교과 vs 일반교과 분류", () => {
  it("cascadePlan.subjects에 명시된 교과는 career_subject", () => {
    const input = baseInput({
      cascadePlan: buildCascade({
        2: { tier: "development", subjects: ["생명과학II"] },
      }),
      coursePlanByGrade: { 2: ["생명과학II", "국어"] },
    });
    const out = generateSlots(input);
    const careerSlot = out.slots.find(
      (s) => s.grade === 2 && s.subareaKey === "생명과학II",
    );
    const regularSlot = out.slots.find(
      (s) => s.grade === 2 && s.subareaKey === "국어",
    );
    expect(careerSlot?.area).toBe("career_subject");
    expect(regularSlot?.area).toBe("regular_subject");
  });

  it("mainThemeKeywords 매칭으로 fallback career 분류", () => {
    const input = baseInput({
      cascadePlan: buildCascade({
        2: { tier: "development", subjects: [] },
      }),
      coursePlanByGrade: { 2: ["AI개론"] },
      mainThemeKeywords: ["AI", "의료영상"],
    });
    const out = generateSlots(input);
    const slot = out.slots.find((s) => s.subareaKey === "AI개론");
    expect(slot?.area).toBe("career_subject");
  });
});

describe("generateSlots — 5. expectedCount 룰", () => {
  it("career advanced=3, career development=2, regular=1, club=2, haengteuk=1", () => {
    expect(expectedCountFor("career_subject", "advanced")).toBe(3);
    expect(expectedCountFor("career_subject", "development")).toBe(2);
    expect(expectedCountFor("career_subject", "foundational")).toBe(2);
    expect(expectedCountFor("regular_subject", "development")).toBe(1);
    expect(expectedCountFor("club", "development")).toBe(2);
    expect(expectedCountFor("career_activity", "development")).toBe(2);
    expect(expectedCountFor("autonomy_activity", "development")).toBe(1);
    expect(expectedCountFor("haengteuk", "development")).toBe(1);
  });

  it("생성된 슬롯의 expectedCount가 룰과 일치", () => {
    const input = baseInput({
      cascadePlan: buildCascade({ 3: { tier: "advanced", subjects: ["미적분"] } }),
    });
    const out = generateSlots(input);
    const career = out.slots.find((s) => s.area === "career_subject" && s.grade === 3);
    const haengteuk = out.slots.find((s) => s.area === "haengteuk" && s.grade === 3);
    expect(career?.state.expectedCount).toBe(3);
    expect(haengteuk?.state.expectedCount).toBe(1);
  });
});

describe("generateSlots — 6. 결정론적 ID", () => {
  it("같은 (grade, area, subareaKey, tier) → 같은 ID", () => {
    const id1 = makeSlotId(2, "career_subject", "생명과학II", "development");
    const id2 = makeSlotId(2, "career_subject", "생명과학II", "development");
    expect(id1).toBe(id2);
  });

  it("다른 입력 → 다른 ID", () => {
    const a = makeSlotId(2, "career_subject", "생명과학II", "development");
    const b = makeSlotId(3, "career_subject", "생명과학II", "development");
    const c = makeSlotId(2, "regular_subject", "생명과학II", "development");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("두 번 generateSlots → 같은 슬롯 ID 집합", () => {
    const input = baseInput({
      cascadePlan: buildCascade({ 2: { tier: "development", subjects: ["생명과학II"] } }),
    });
    const a = generateSlots(input);
    const b = generateSlots(input);
    const idsA = new Set(a.slots.map((s) => s.id));
    const idsB = new Set(b.slots.map((s) => s.id));
    expect(idsA).toEqual(idsB);
  });
});

describe("generateSlots — 7. priority — 빈 슬롯 + critical → high priority", () => {
  it("빈 career_subject + advanced + milestone + critical 패턴 → priority > 70", () => {
    const input = baseInput({
      cascadePlan: buildCascade({
        3: { tier: "advanced", subjects: ["미적분"] },
      }),
      blueprint: {
        id: "test-blueprint-id",
        tierPlan: null,
        targetConvergences: [
          {
            grade: 3,
            themeLabel: "수학적 한계 분석",
            themeKeywords: ["수학", "한계"],
            targetMembers: [],
            sharedCompetencies: [],
            confidence: 0.9,
            rationale: "test",
            tierAlignment: "advanced",
          },
        ],
        storylineSkeleton: { overarchingTheme: "", yearThemes: {}, narrativeArc: "" },
        competencyGrowthTargets: [],
        milestones: {
          3: {
            grade: 3,
            targetConvergenceCount: 2,
            keyActivities: ["미적분 응용 탐구", "한계 분석 보고서"],
            competencyFocus: ["scientific_inquiry"],
            narrativeGoal: "advanced 결론 도출",
          },
        },
      },
      qualityIssuesByGrade: { 3: ["F4", "F16"] },
      blueprintId: "bp-1",
    });
    const out = generateSlots(input);
    const slot = out.slots.find(
      (s) => s.grade === 3 && s.area === "career_subject" && s.subareaKey === "미적분",
    );
    expect(slot).toBeDefined();
    expect(slot!.state.priority).toBeGreaterThan(70);
    expect(slot!.intent.unfulfilledMilestones.length).toBeGreaterThan(0);
    expect(slot!.intent.qualityIssuesToCover).toEqual(["F4", "F16"]);
    expect(slot!.intent.targetConvergenceIds.length).toBeGreaterThan(0);
  });

  it("computeSlotPriority — 0~100 범위 보장", () => {
    const fakeSlot: Slot = {
      id: "test",
      grade: 1,
      area: "regular_subject",
      subareaKey: "test",
      tier: "foundational",
      intent: {
        contentSummary: "",
        rationale: "",
        unfulfilledMilestones: Array(50).fill({ id: "m", activityText: "활동", narrativeGoal: "", competencyFocus: [] }),
        targetConvergenceIds: [],
        focusHypothesis: null,
        focusKeywords: [],
        weakCompetencies: [],
        qualityIssuesToCover: Array(50).fill("F4"),
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
        generatedAt: "",
        generatorVersion: "v2.0",
      },
    };
    const p = computeSlotPriority(fakeSlot);
    expect(p).toBeLessThanOrEqual(100);
    expect(p).toBeGreaterThanOrEqual(0);
  });
});

describe("generateSlots — 8. midPlan focusKeywords 토큰화", () => {
  it("midPlan focusHypothesis가 intent.focusKeywords로 토큰화됨", () => {
    const input = baseInput({
      cascadePlan: buildCascade({ 2: { tier: "development", subjects: ["생명과학II"] } }),
      midPlanByGrade: {
        2: { focusHypothesis: "AI 기반 의료영상 분류의 한계 분석", keywords: ["CNN"] },
      },
    });
    const out = generateSlots(input);
    const slot = out.slots.find((s) => s.grade === 2 && s.area === "career_subject");
    expect(slot?.intent.focusHypothesis).toContain("의료영상");
    expect(slot?.intent.focusKeywords.length).toBeGreaterThan(0);
    expect(slot?.intent.focusKeywords).toContain("cnn");
  });
});

describe("generateSlots — 9. F16 차단 적용 영역", () => {
  it("regular_subject 슬롯만 excludeKeywords에 mainThemeKeywords 포함", () => {
    const input = baseInput({
      cascadePlan: buildCascade({
        2: { tier: "development", subjects: ["생명과학II"] },
      }),
      coursePlanByGrade: { 2: ["국어"] },
      mainThemeKeywords: ["AI", "의료영상"],
    });
    const out = generateSlots(input);
    const career = out.slots.find((s) => s.area === "career_subject" && s.subareaKey === "생명과학II");
    const regular = out.slots.find((s) => s.area === "regular_subject" && s.subareaKey === "국어");
    expect(career?.constraints.excludeKeywords).toEqual([]);
    expect(regular?.constraints.excludeKeywords).toEqual(expect.arrayContaining(["AI", "의료영상"]));
  });
});
