// ============================================
// pipeline/slots/types.ts
//
// Step 2.1 (2026-04-27): Slot 격자 데이터 모델.
// blueprint + cascadePlan + tier_plan + midPlan에서 도출되는 추론 entity.
// 영속 X — task_results._slots에만 캐시.
// ============================================

import type { BlueprintPhaseOutput } from "../../blueprint/types";
import type { CascadePlan } from "../../capability/cascade-plan";
import type { MainExplorationTierPlan } from "@/lib/domains/student-record/repository/main-exploration-repository";

// ── 분류 ─────────────────────────────────────

export type SlotArea =
  | "career_subject"
  | "regular_subject"
  | "club"
  | "career_activity"
  | "autonomy_activity"
  | "haengteuk";

export type SlotTier = "foundational" | "development" | "advanced";

export type SlotDifficulty = "basic" | "intermediate" | "advanced";

// ── Slot 구성요소 ─────────────────────────────

/**
 * D-Phase1 (#milestone semantic, 2026-04-29): unfulfilled milestone 객체.
 * 기존 ID 매칭은 학생/blueprint 별 stable id 라 카탈로그 매칭 불가 → semantic
 * matching (embedding cosine) 입력으로 활용. activityText + narrativeGoal 결합
 * 임베딩이 더 정확.
 */
export interface UnfulfilledMilestone {
  /** Stable id (예: g1_milestone_0_생명과학Ⅰ세포...) — 디버그/박제용 */
  id: string;
  /** 활동 텍스트 (예: "생명과학Ⅰ 세포 호흡 및 유전 기초 탐구") — semantic 매칭 본 입력 */
  activityText: string;
  /** 학년 narrative 목표 — embedding 보강 (짧은 activityText 의미 보강용) */
  narrativeGoal: string;
  /** 학년 집중 역량 코드 — weaknessFix 와 별도 차원 */
  competencyFocus: string[];
}

export interface SlotIntent {
  contentSummary: string;
  rationale: string;
  /** D-Phase1: 객체 셋. id-only 후방 호환은 unfulfilledMilestoneIds getter 별도 노출. */
  unfulfilledMilestones: UnfulfilledMilestone[];
  targetConvergenceIds: string[];
  focusHypothesis: string | null;
  focusKeywords: string[];
  weakCompetencies: string[];
  qualityIssuesToCover: string[];
}

export interface SlotConstraints {
  maxDifficulty: SlotDifficulty;
  excludeKeywords: string[];
  mustMatchCareerFields: string[];
  excludeCareerFields: string[];
  tierStrictness: "strict" | "loose";
}

export interface SlotState {
  expectedCount: number;
  currentCount: number;
  fillRatio: number;
  priority: number;
  isFulfilled: boolean;
}

export interface SlotProvenance {
  blueprintId: string | null;
  cascadeNodeRef: { grade: number; tier: SlotTier } | null;
  tierPlanRef: SlotTier | null;
  midPlanRef: { grade: number } | null;
  generatedAt: string;
  generatorVersion: string;
}

export interface Slot {
  id: string;
  grade: 1 | 2 | 3;
  area: SlotArea;
  subareaKey: string;
  tier: SlotTier;
  intent: SlotIntent;
  constraints: SlotConstraints;
  state: SlotState;
  derivedFrom: SlotProvenance;
}

// ── Generator I/O ─────────────────────────────

export interface MidPlanShape {
  focusHypothesis?: string | null;
  keywords?: string[];
}

export interface SlotGeneratorInput {
  studentId: string;
  tenantId: string;
  currentGrade: number | null;
  blueprint: BlueprintPhaseOutput | null;
  blueprintId: string | null;
  cascadePlan: CascadePlan | null;
  tierPlan: MainExplorationTierPlan | null;
  midPlanByGrade: Record<number, MidPlanShape | null | undefined>;
  coursePlanByGrade: Record<number, string[]>;
  weakCompetenciesByGrade: Record<number, string[]>;
  qualityIssuesByGrade: Record<number, string[]>;
  /** 학년별 leveling cap (없으면 "advanced" 기본) */
  maxDifficultyByGrade: Record<number, SlotDifficulty>;
  careerCompatibility: string[];
  mainThemeKeywords: string[];
}

export interface SlotGeneratorOutput {
  slots: Slot[];
  generationStats: {
    totalSlots: number;
    byGrade: Record<number, number>;
    byArea: Record<SlotArea, number>;
    avgExpectedCount: number;
    avgPriority: number;
    highPriorityCount: number; // priority > 70
  };
  warnings: string[];
}
