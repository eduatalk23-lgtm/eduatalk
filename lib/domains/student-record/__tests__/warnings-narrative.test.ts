import { describe, it, expect } from "vitest";
import { computeWarnings, type WarningCheckInput } from "../warnings/engine";
import type { NarrativeArcRow } from "../warnings/checkers-narrative";
import type { ContentQualityRow } from "../warnings/engine";

// ============================================
// Phase 2 Step 5 — Layer 3 narrative_arc 기반 F10/M1 체커 테스트
// ============================================

function makeArc(overrides: Partial<NarrativeArcRow> = {}): NarrativeArcRow {
  return {
    record_type: "setek",
    record_id: "r1",
    grade: 2,
    growth_narrative_present: true,
    teacher_observation_present: true,
    stages_present_count: 5,
    ...overrides,
  };
}

function makeInput(overrides: Partial<WarningCheckInput> = {}): WarningCheckInput {
  return {
    recordsByGrade: new Map(),
    storylineData: null,
    diagnosisData: null,
    strategyData: null,
    currentGrade: 3,
    ...overrides,
  };
}

describe("checkNarrativeArc (Layer 3 기반 F10/M1)", () => {
  it("성장 서사 누락 ≥3건 시 F10 발행", () => {
    const arcs: NarrativeArcRow[] = [
      makeArc({ record_id: "1", growth_narrative_present: false }),
      makeArc({ record_id: "2", growth_narrative_present: false }),
      makeArc({ record_id: "3", growth_narrative_present: false }),
      makeArc({ record_id: "4", growth_narrative_present: true }),
    ];
    const warnings = computeWarnings(makeInput({ narrativeArcs: arcs }));
    const f10 = warnings.find((w) => w.ruleId === "setek_no_growth_curve");
    expect(f10).toBeDefined();
    expect(f10!.message).toContain("3건");
    expect(f10!.message).toContain("4건 중");
  });

  it("교사 관찰 누락 ≥3건 시 M1 발행", () => {
    const arcs: NarrativeArcRow[] = [
      makeArc({ record_id: "1", teacher_observation_present: false }),
      makeArc({ record_id: "2", teacher_observation_present: false }),
      makeArc({ record_id: "3", teacher_observation_present: false }),
    ];
    const warnings = computeWarnings(makeInput({ narrativeArcs: arcs }));
    const m1 = warnings.find((w) => w.ruleId === "setek_teacher_unobservable");
    expect(m1).toBeDefined();
    expect(m1!.message).toContain("3건");
  });

  it("누락 <3건은 경고 없음 (임계값 미만)", () => {
    const arcs: NarrativeArcRow[] = [
      makeArc({ record_id: "1", growth_narrative_present: false }),
      makeArc({ record_id: "2", growth_narrative_present: false }),
    ];
    const warnings = computeWarnings(makeInput({ narrativeArcs: arcs }));
    expect(warnings.find((w) => w.ruleId === "setek_no_growth_curve")).toBeUndefined();
  });

  it("changche/haengteuk은 카운트에서 제외 (setek + personal_setek만)", () => {
    const arcs: NarrativeArcRow[] = [
      makeArc({ record_type: "changche", record_id: "1", growth_narrative_present: false }),
      makeArc({ record_type: "haengteuk", record_id: "2", growth_narrative_present: false }),
      makeArc({ record_type: "setek", record_id: "3", growth_narrative_present: false }),
      makeArc({ record_type: "setek", record_id: "4", growth_narrative_present: false }),
    ];
    const warnings = computeWarnings(makeInput({ narrativeArcs: arcs }));
    // setek 2건만 누락 → 임계값 3 미만
    expect(warnings.find((w) => w.ruleId === "setek_no_growth_curve")).toBeUndefined();
  });

  it("personal_setek도 카운트에 포함", () => {
    const arcs: NarrativeArcRow[] = [
      makeArc({ record_type: "setek", record_id: "1", growth_narrative_present: false }),
      makeArc({ record_type: "personal_setek", record_id: "2", growth_narrative_present: false }),
      makeArc({ record_type: "personal_setek", record_id: "3", growth_narrative_present: false }),
    ];
    const warnings = computeWarnings(makeInput({ narrativeArcs: arcs }));
    expect(warnings.find((w) => w.ruleId === "setek_no_growth_curve")).toBeDefined();
  });

  it("성장/교사 모두 누락 시 F10+M1 둘 다 발행", () => {
    const arcs: NarrativeArcRow[] = [
      makeArc({ record_id: "1", growth_narrative_present: false, teacher_observation_present: false }),
      makeArc({ record_id: "2", growth_narrative_present: false, teacher_observation_present: false }),
      makeArc({ record_id: "3", growth_narrative_present: false, teacher_observation_present: false }),
    ];
    const warnings = computeWarnings(makeInput({ narrativeArcs: arcs }));
    expect(warnings.find((w) => w.ruleId === "setek_no_growth_curve")).toBeDefined();
    expect(warnings.find((w) => w.ruleId === "setek_teacher_unobservable")).toBeDefined();
  });
});

describe("narrative_arc fallback — 기존 issues[] 기반 F10/M1 스킵", () => {
  const qualityWithF10M1: ContentQualityRow[] = [
    {
      record_type: "setek",
      record_id: "r1",
      overall_score: 70,
      issues: ["F10_성장부재", "M1_교사관찰불가"],
      feedback: null,
    },
  ];

  it("narrativeArcs 미제공 시 issues[]의 F10/M1 그대로 발행 (fallback)", () => {
    const warnings = computeWarnings(
      makeInput({ qualityScores: qualityWithF10M1 }),
    );
    expect(warnings.find((w) => w.ruleId === "setek_no_growth_curve")).toBeDefined();
    expect(warnings.find((w) => w.ruleId === "setek_teacher_unobservable")).toBeDefined();
  });

  it("narrativeArcs 제공 시 issues[]의 F10/M1은 스킵 (중복 방지)", () => {
    const arcs: NarrativeArcRow[] = [
      makeArc({ record_id: "a1" }), // 전부 present=true → narrative 체커 경고 없음
      makeArc({ record_id: "a2" }),
    ];
    const warnings = computeWarnings(
      makeInput({
        qualityScores: qualityWithF10M1,
        narrativeArcs: arcs,
      }),
    );
    // issues[]에 F10/M1이 있어도 narrative_arc 신호가 있으므로 스킵
    expect(warnings.find((w) => w.ruleId === "setek_no_growth_curve")).toBeUndefined();
    expect(warnings.find((w) => w.ruleId === "setek_teacher_unobservable")).toBeUndefined();
  });

  it("narrativeArcs 제공 + narrative 체커 발행 조건 충족 시 narrative 경로로만 발행", () => {
    const arcs: NarrativeArcRow[] = [
      makeArc({ record_id: "a1", growth_narrative_present: false }),
      makeArc({ record_id: "a2", growth_narrative_present: false }),
      makeArc({ record_id: "a3", growth_narrative_present: false }),
    ];
    const warnings = computeWarnings(
      makeInput({
        qualityScores: qualityWithF10M1,
        narrativeArcs: arcs,
      }),
    );
    const f10 = warnings.filter((w) => w.ruleId === "setek_no_growth_curve");
    expect(f10.length).toBe(1); // issues 경로 스킵, narrative 경로만
    expect(f10[0].message).toContain("3건"); // narrative 경로 메시지
  });

  it("narrativeArcs가 setek/personal_setek 없이 changche만 포함 시 fallback 작동", () => {
    const arcs: NarrativeArcRow[] = [
      makeArc({ record_type: "changche", record_id: "c1" }),
    ];
    const warnings = computeWarnings(
      makeInput({
        qualityScores: qualityWithF10M1,
        narrativeArcs: arcs,
      }),
    );
    // setek/personal_setek narrative 신호 없음 → issues[] fallback 작동
    expect(warnings.find((w) => w.ruleId === "setek_no_growth_curve")).toBeDefined();
  });
});
