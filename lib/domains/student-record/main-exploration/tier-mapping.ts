// ============================================
// 메인 탐구 tier ↔ 가이드 difficulty 매핑 — Phase α Step 2.7
//
// 2겹 활동 격자 중 1겹(주제 클러스터 깊이) 에서 서로 다른 레이블이 쓰임:
//   main_exploration_tier : foundational / development / advanced
//   guide.difficulty_level: basic       / intermediate / advanced
//
// 의미는 동일한 3단계 깊이. 이 모듈이 양방향 변환 SSOT.
// G6 (3↔5 매핑 leveling_to_difficulty) 과는 별개 — 이건 tier ↔ difficulty 단순 alias.
// ============================================

import type { MainExplorationTier } from "../repository/main-exploration-repository";

export type GuideDifficulty = "basic" | "intermediate" | "advanced";

const DIFFICULTY_TO_TIER: Record<GuideDifficulty, MainExplorationTier> = {
  basic: "foundational",
  intermediate: "development",
  advanced: "advanced",
};

const TIER_TO_DIFFICULTY: Record<MainExplorationTier, GuideDifficulty> = {
  foundational: "basic",
  development: "intermediate",
  advanced: "advanced",
};

export function difficultyToTier(
  d: GuideDifficulty | string | null | undefined,
): MainExplorationTier | null {
  if (d === "basic" || d === "intermediate" || d === "advanced") {
    return DIFFICULTY_TO_TIER[d];
  }
  return null;
}

export function tierToDifficulty(tier: MainExplorationTier): GuideDifficulty {
  return TIER_TO_DIFFICULTY[tier];
}
