// ============================================
// Tier Plan Similarity (Phase 4b, 2026-04-19)
// 두 main_exploration.tier_plan 의 jaccard 유사도 계산.
// Synthesis → main_exploration 피드백 루프의 수렴 가드.
//
// 수렴 판정: overall >= 0.8 → 신규 tier_plan 제안과 현 plan 이 충분히 유사 →
//   재부트스트랩 불필요 (체인 종료).
// 미수렴: < 0.8 → 의미 있는 차이 → 신규 main_exploration row 생성 후
//   bootstrap 재실행 (parent_version_id 체인).
// ============================================

import type { MainExplorationTierPlan } from "@/lib/domains/student-record/repository/main-exploration-repository";

/** Phase 4b 기본 수렴 임계치. 측정 후 조정 가능. */
export const DEFAULT_TIER_PLAN_CONVERGENCE_THRESHOLD = 0.8;

export interface TierPlanSimilarityScore {
  /** 3 tier 평균 jaccard (0~1, 1=동일). */
  overall: number;
  /** tier별 jaccard. 양쪽 모두 빈 tier 는 1.0 으로 간주. */
  byTier: {
    foundational: number;
    development: number;
    advanced: number;
  };
  /** overall >= threshold 면 true (수렴). */
  converged: boolean;
  /** 사용된 임계치 (기본 0.8). */
  threshold: number;
}

const TIERS = ["foundational", "development", "advanced"] as const;
type TierKey = typeof TIERS[number];

/**
 * 토큰화 — 한국어 공백 분할 + 영문 소문자화 + 길이 ≥ 2.
 * 짧은 조사/조어는 의도적으로 포함 (theme 자체가 짧기 때문).
 */
function tokenize(input: string | null | undefined): string[] {
  if (!input) return [];
  return input
    .split(/[\s\u3000.,;:!?()\[\]{}'"，。；：！？（）【】「」『』]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2);
}

function collectTierTokens(
  tier: { theme?: string; key_questions?: string[]; suggested_activities?: string[] } | undefined,
): Set<string> {
  const tokens = new Set<string>();
  if (!tier) return tokens;
  for (const t of tokenize(tier.theme)) tokens.add(t);
  for (const q of tier.key_questions ?? []) {
    for (const t of tokenize(q)) tokens.add(t);
  }
  for (const a of tier.suggested_activities ?? []) {
    for (const t of tokenize(a)) tokens.add(t);
  }
  return tokens;
}

function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1; // 둘 다 비어있으면 차이 없음 = 수렴 취급
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * tier_plan 비교 — tier별 jaccard 의 산술 평균을 overall 로 사용.
 * 한 쪽 plan 이 null/undefined 이면 overall=0 (완전 미수렴) 반환.
 */
export function compareTierPlans(
  current: MainExplorationTierPlan | null | undefined,
  proposed: MainExplorationTierPlan | null | undefined,
  options?: { threshold?: number },
): TierPlanSimilarityScore {
  const threshold = options?.threshold ?? DEFAULT_TIER_PLAN_CONVERGENCE_THRESHOLD;

  if (!current || !proposed) {
    return {
      overall: 0,
      byTier: { foundational: 0, development: 0, advanced: 0 },
      converged: false,
      threshold,
    };
  }

  const byTier = {} as TierPlanSimilarityScore["byTier"];
  let sum = 0;
  for (const tier of TIERS) {
    const score = jaccardSets(
      collectTierTokens(current[tier]),
      collectTierTokens(proposed[tier]),
    );
    byTier[tier as TierKey] = score;
    sum += score;
  }
  const overall = sum / TIERS.length;

  return {
    overall,
    byTier,
    converged: overall >= threshold,
    threshold,
  };
}
