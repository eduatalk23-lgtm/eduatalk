// ============================================
// pipeline/slots/slot-generator.ts
//
// Step 2.1 (2026-04-27): Slot 격자 도출 메인 함수.
// blueprint + cascadePlan + tier_plan + midPlan + analysisContext에서 슬롯 추론.
//
// Step 2.1 범위: 도출만. 매칭 알고리즘 변경 없음 (Shadow run).
// 출력은 task_results._slots에 캐시되며, Step 2.2부터 매칭이 소비.
// ============================================

import { classifySubject, tokenizeForSlot } from "./slot-area-classifier";
import {
  expectedCountFor,
  REGULAR_SUBJECT_POLICY,
  SLOT_GENERATOR_VERSION,
} from "./slot-config";
import { makeSlotId } from "./slot-id";
import { computeSlotPriority } from "./slot-priority";
import type {
  MidPlanShape,
  Slot,
  SlotArea,
  SlotConstraints,
  SlotGeneratorInput,
  SlotGeneratorOutput,
  SlotIntent,
  SlotProvenance,
  SlotState,
  SlotTier,
} from "./types";

const GRADES = [1, 2, 3] as const;
type GradeLiteral = (typeof GRADES)[number];

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function resolveRegularSubjects(
  cascadeSubjects: string[],
  coursePlanned: string[],
): string[] {
  switch (REGULAR_SUBJECT_POLICY) {
    case "course_plan_only":
      return uniq(coursePlanned);
    case "all_planned":
    case "cascade_plan_union":
    default:
      return uniq([...cascadeSubjects, ...coursePlanned]);
  }
}

function buildIntent(args: {
  cascadeContentSummary: string;
  cascadeRationale: string;
  unfulfilledMilestoneIds: string[];
  targetConvergenceIds: string[];
  midPlan: MidPlanShape | null | undefined;
  weakCompetencies: string[];
  qualityIssues: string[];
}): SlotIntent {
  const focusHypothesis = args.midPlan?.focusHypothesis ?? null;
  const focusKeywords: string[] = [];
  if (focusHypothesis) focusKeywords.push(...tokenizeForSlot(focusHypothesis));
  if (args.midPlan?.keywords) {
    for (const kw of args.midPlan.keywords) {
      focusKeywords.push(...tokenizeForSlot(kw));
    }
  }
  // #3 Scope A (2026-04-29): midPlan 미시드(prospective 학생) fallback —
  // cascadeNode 의 contentSummary + rationale 에서 토큰 추출. midPlan 보유 시에는
  // 위 키워드가 우선 (push 순서) 하므로 영향 없음.
  if (focusKeywords.length === 0) {
    if (args.cascadeContentSummary) focusKeywords.push(...tokenizeForSlot(args.cascadeContentSummary));
    if (args.cascadeRationale) focusKeywords.push(...tokenizeForSlot(args.cascadeRationale));
  }
  return {
    contentSummary: args.cascadeContentSummary,
    rationale: args.cascadeRationale,
    unfulfilledMilestoneIds: args.unfulfilledMilestoneIds,
    targetConvergenceIds: args.targetConvergenceIds,
    focusHypothesis,
    focusKeywords: uniq(focusKeywords),
    weakCompetencies: args.weakCompetencies,
    qualityIssuesToCover: args.qualityIssues,
  };
}

function buildConstraints(args: {
  area: SlotArea;
  maxDifficulty: SlotConstraints["maxDifficulty"];
  careerCompatibility: string[];
  mainThemeKeywords: string[];
}): SlotConstraints {
  // F16 차단: 비진로 슬롯에만 mainTheme 키워드 차단 적용
  const excludeKeywords = args.area === "regular_subject" ? args.mainThemeKeywords : [];
  // tier 엄격성: 진로교과는 strict, 그 외는 loose
  const tierStrictness: SlotConstraints["tierStrictness"] =
    args.area === "career_subject" ? "strict" : "loose";

  return {
    maxDifficulty: args.maxDifficulty,
    excludeKeywords: uniq(excludeKeywords),
    mustMatchCareerFields: uniq(args.careerCompatibility),
    excludeCareerFields: [],
    tierStrictness,
  };
}

function buildState(args: { area: SlotArea; tier: SlotTier }): SlotState {
  const expectedCount = expectedCountFor(args.area, args.tier);
  return {
    expectedCount,
    currentCount: 0,
    fillRatio: 0,
    priority: 50, // computeSlotPriority가 나중에 덮어씀
    isFulfilled: false,
  };
}

function buildProvenance(args: {
  blueprintId: string | null;
  grade: number;
  tier: SlotTier;
  hasMidPlan: boolean;
  hasTierPlan: boolean;
}): SlotProvenance {
  return {
    blueprintId: args.blueprintId,
    cascadeNodeRef: { grade: args.grade, tier: args.tier },
    tierPlanRef: args.hasTierPlan ? args.tier : null,
    midPlanRef: args.hasMidPlan ? { grade: args.grade } : null,
    generatedAt: new Date().toISOString(),
    generatorVersion: SLOT_GENERATOR_VERSION,
  };
}

function buildSlot(args: {
  grade: GradeLiteral;
  area: SlotArea;
  subareaKey: string;
  tier: SlotTier;
  intent: SlotIntent;
  constraints: SlotConstraints;
  provenance: SlotProvenance;
}): Slot {
  const id = makeSlotId(args.grade, args.area, args.subareaKey, args.tier);
  const state = buildState({ area: args.area, tier: args.tier });
  const slot: Slot = {
    id,
    grade: args.grade,
    area: args.area,
    subareaKey: args.subareaKey,
    tier: args.tier,
    intent: args.intent,
    constraints: args.constraints,
    state,
    derivedFrom: args.provenance,
  };
  slot.state.priority = computeSlotPriority(slot);
  return slot;
}

function getCascadeNode(input: SlotGeneratorInput, grade: number) {
  const map = input.cascadePlan?.byGrade;
  if (!map) return null;
  return map[String(grade)] ?? map[grade as unknown as string] ?? null;
}

function collectUnfulfilledMilestoneIds(
  blueprint: SlotGeneratorInput["blueprint"],
  grade: number,
): string[] {
  if (!blueprint?.milestones) return [];
  const m = blueprint.milestones[grade];
  if (!m) return [];
  // BlueprintMilestone에는 fulfilled 플래그 없음 — keyActivities를 stable id로 사용.
  // Step 2.1: keyActivities 전체를 unfulfilled 후보로 노출 (Step 2.2에서 매칭 결과 대조 후 filter).
  return (m.keyActivities ?? []).map((act, idx) => `g${grade}_milestone_${idx}_${act.slice(0, 24)}`);
}

function collectTargetConvergenceIds(
  blueprint: SlotGeneratorInput["blueprint"],
  grade: number,
): string[] {
  if (!blueprint?.targetConvergences) return [];
  return blueprint.targetConvergences
    .filter((c) => c.grade === grade)
    .map((c, idx) => `g${grade}_conv_${idx}_${c.themeLabel.slice(0, 24)}`);
}

export function generateSlots(input: SlotGeneratorInput): SlotGeneratorOutput {
  const slots: Slot[] = [];
  const warnings: string[] = [];

  const hasTierPlan = input.tierPlan !== null;

  for (const grade of GRADES) {
    const cascadeNode = getCascadeNode(input, grade);
    if (!cascadeNode) {
      warnings.push(`G${grade}: cascadeNode 없음 — 슬롯 도출 skip`);
      continue;
    }

    const tier = cascadeNode.tier as SlotTier;
    const cascadeSubjects = cascadeNode.subjects ?? [];
    const coursePlanned = input.coursePlanByGrade[grade] ?? [];
    const midPlan = input.midPlanByGrade[grade] ?? null;
    const weak = input.weakCompetenciesByGrade[grade] ?? [];
    const issues = input.qualityIssuesByGrade[grade] ?? [];
    const maxDifficulty = input.maxDifficultyByGrade[grade] ?? "advanced";

    const unfulfilledIds = collectUnfulfilledMilestoneIds(input.blueprint, grade);
    const convergenceIds = collectTargetConvergenceIds(input.blueprint, grade);

    const intentBase = buildIntent({
      cascadeContentSummary: cascadeNode.contentSummary ?? "",
      cascadeRationale: cascadeNode.rationale ?? "",
      unfulfilledMilestoneIds: unfulfilledIds,
      targetConvergenceIds: convergenceIds,
      midPlan,
      weakCompetencies: weak,
      qualityIssues: issues,
    });

    const provenanceBase = buildProvenance({
      blueprintId: input.blueprintId,
      grade,
      tier,
      hasMidPlan: midPlan !== null,
      hasTierPlan,
    });

    // ── 교과 슬롯 ──
    const allSubjects = uniq([...cascadeSubjects, ...resolveRegularSubjects(cascadeSubjects, coursePlanned)]);
    if (allSubjects.length === 0) {
      warnings.push(`G${grade}: cascadeSubjects + coursePlan 모두 비어있음`);
    }

    for (const subject of allSubjects) {
      if (!subject || subject.trim().length === 0) continue;
      const area: SlotArea = classifySubject({
        subject,
        cascadeSubjects,
        mainThemeKeywords: input.mainThemeKeywords,
      });
      const constraints = buildConstraints({
        area,
        maxDifficulty,
        careerCompatibility: input.careerCompatibility,
        mainThemeKeywords: input.mainThemeKeywords,
      });
      slots.push(
        buildSlot({
          grade,
          area,
          subareaKey: subject.trim(),
          tier,
          intent: intentBase,
          constraints,
          provenance: provenanceBase,
        }),
      );
    }

    // ── 창체 3종 + 행특 1종 (학년마다 고정) ──
    const fixedAreas: Array<{ area: SlotArea; key: string }> = [
      { area: "club", key: "club" },
      { area: "career_activity", key: "career" },
      { area: "autonomy_activity", key: "autonomy" },
      { area: "haengteuk", key: "haengteuk" },
    ];
    for (const fa of fixedAreas) {
      const constraints = buildConstraints({
        area: fa.area,
        maxDifficulty,
        careerCompatibility: input.careerCompatibility,
        mainThemeKeywords: input.mainThemeKeywords,
      });
      slots.push(
        buildSlot({
          grade,
          area: fa.area,
          subareaKey: fa.key,
          tier,
          intent: intentBase,
          constraints,
          provenance: provenanceBase,
        }),
      );
    }
  }

  return {
    slots,
    generationStats: computeStats(slots),
    warnings,
  };
}

function computeStats(slots: Slot[]): SlotGeneratorOutput["generationStats"] {
  const byGrade: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  const byArea: Record<SlotArea, number> = {
    career_subject: 0,
    regular_subject: 0,
    club: 0,
    career_activity: 0,
    autonomy_activity: 0,
    haengteuk: 0,
  };
  let sumExpected = 0;
  let sumPriority = 0;
  let highPriority = 0;
  for (const s of slots) {
    byGrade[s.grade] = (byGrade[s.grade] ?? 0) + 1;
    byArea[s.area] = (byArea[s.area] ?? 0) + 1;
    sumExpected += s.state.expectedCount;
    sumPriority += s.state.priority;
    if (s.state.priority > 70) highPriority++;
  }
  const total = slots.length;
  return {
    totalSlots: total,
    byGrade,
    byArea,
    avgExpectedCount: total === 0 ? 0 : Math.round((sumExpected / total) * 100) / 100,
    avgPriority: total === 0 ? 0 : Math.round((sumPriority / total) * 100) / 100,
    highPriorityCount: highPriority,
  };
}
