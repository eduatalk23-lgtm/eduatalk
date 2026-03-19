// ============================================
// 수시 6장 최적 배분 엔진 — 순수 함수
// Phase 8.5b
// ============================================

import type {
  AllocationCandidate,
  AllocationConfig,
  AllocationRecommendation,
  AllocationTier,
} from "./types";
import { DEFAULT_ALLOCATION_CONFIG, LEVEL_TO_TIER } from "./types";
import type { PlacementLevel } from "../placement/types";

const ONE_DAY_MS = 86_400_000;

// ─── 조합 제너레이터 ─────────────────────────────

/**
 * C(n, k) 조합 제너레이터.
 * n ≤ 15 → 최대 C(15,6) = 5,005.
 */
export function* generateCombinations<T>(arr: T[], k: number): Generator<T[]> {
  if (k > arr.length || k <= 0) return;
  if (k === arr.length) {
    yield [...arr];
    return;
  }

  const indices = Array.from({ length: k }, (_, i) => i);

  yield indices.map((i) => arr[i]);

  while (true) {
    let i = k - 1;
    while (i >= 0 && indices[i] === arr.length - k + i) {
      i--;
    }
    if (i < 0) break;

    indices[i]++;
    for (let j = i + 1; j < k; j++) {
      indices[j] = indices[j - 1] + 1;
    }

    yield indices.map((idx) => arr[idx]);
  }
}

// ─── 면접 겹침 체크 ─────────────────────────────

function checkInterviewConflictsForSlots(
  slots: AllocationCandidate[],
): { university1: string; university2: string; date: string }[] {
  const withDates = slots.filter(
    (s): s is AllocationCandidate & { interviewDate: string } =>
      s.interviewDate != null,
  );

  const conflicts: { university1: string; university2: string; date: string }[] = [];

  for (let i = 0; i < withDates.length; i++) {
    for (let j = i + 1; j < withDates.length; j++) {
      const a = withDates[i];
      const b = withDates[j];
      const dateA = new Date(a.interviewDate).getTime();
      const dateB = new Date(b.interviewDate).getTime();
      const diff = Math.abs(dateA - dateB);

      if (diff <= ONE_DAY_MS) {
        conflicts.push({
          university1: a.universityName,
          university2: b.universityName,
          date: dateA <= dateB ? a.interviewDate : b.interviewDate,
        });
      }
    }
  }

  return conflicts;
}

// ─── 점수 계산 ──────────────────────────────────

function getTier(level: PlacementLevel): AllocationTier {
  return LEVEL_TO_TIER[level];
}

function groupByTier(
  slots: AllocationCandidate[],
): Record<AllocationTier, AllocationCandidate[]> {
  const result: Record<AllocationTier, AllocationCandidate[]> = {
    reach: [],
    target: [],
    safety: [],
  };
  for (const s of slots) {
    result[getTier(s.placementLevel)].push(s);
  }
  return result;
}

function groupByRound(
  slots: AllocationCandidate[],
): Record<string, AllocationCandidate[]> {
  const result: Record<string, AllocationCandidate[]> = {};
  for (const s of slots) {
    if (!result[s.round]) result[s.round] = [];
    result[s.round].push(s);
  }
  return result;
}

function groupByLevel(
  slots: AllocationCandidate[],
): Record<PlacementLevel, AllocationCandidate[]> {
  const result: Record<PlacementLevel, AllocationCandidate[]> = {
    safe: [],
    possible: [],
    bold: [],
    unstable: [],
    danger: [],
  };
  for (const s of slots) {
    result[s.placementLevel].push(s);
  }
  return result;
}

/**
 * 조합 점수 계산 (0-100):
 * - 티어 균형 40점: reach/target/safety 범위 내 배분
 * - 안정 확보 25점: safety ≥ 1
 * - 전형 다양성 20점: 전형 종류 수
 * - 겹침 없음 15점: 면접 겹침 없으면 만점
 */
export function scoreCombination(
  slots: AllocationCandidate[],
  config: AllocationConfig = DEFAULT_ALLOCATION_CONFIG,
): number {
  const byTier = groupByTier(slots);

  // 1. 티어 균형 (40점)
  let tierScore = 40;
  const tiers: AllocationTier[] = ["reach", "target", "safety"];
  for (const tier of tiers) {
    const count = byTier[tier].length;
    const { min, max } = config[tier];
    if (count < min) tierScore -= (min - count) * 15;
    if (count > max) tierScore -= (count - max) * 10;
  }
  tierScore = Math.max(0, tierScore);

  // 2. 안정 확보 (25점)
  const safetyScore = byTier.safety.length >= config.safety.min ? 25 : 0;

  // 3. 전형 다양성 (20점)
  const uniqueRounds = new Set(slots.map((s) => s.round)).size;
  const diversityScore = Math.min(20, uniqueRounds * 5 * (1 + config.diversityBonus));

  // 4. 면접 겹침 없음 (15점)
  const conflicts = checkInterviewConflictsForSlots(slots);
  const conflictScore = conflicts.length === 0 ? 15 : Math.max(0, 15 - conflicts.length * 8);

  return Math.round(
    Math.min(100, tierScore + safetyScore + diversityScore + conflictScore),
  );
}

// ─── 경고 생성 ──────────────────────────────────

function generateWarnings(
  slots: AllocationCandidate[],
  config: AllocationConfig,
): string[] {
  const warnings: string[] = [];
  const byTier = groupByTier(slots);

  if (byTier.safety.length === 0) {
    warnings.push("안정 지원이 없습니다. 최소 1개의 안정 지원을 권장합니다.");
  }

  if (byTier.reach.length > config.reach.max) {
    warnings.push(`소신 지원이 ${byTier.reach.length}개로 과다합니다.`);
  }

  const uniqueRounds = new Set(slots.map((s) => s.round)).size;
  if (uniqueRounds === 1) {
    warnings.push("모든 지원이 동일 전형입니다. 전형 다양화를 권장합니다.");
  }

  const conflicts = checkInterviewConflictsForSlots(slots);
  if (conflicts.length > 0) {
    for (const c of conflicts) {
      warnings.push(`면접 겹침: ${c.university1} / ${c.university2} (${c.date})`);
    }
  }

  return warnings;
}

// ─── 메인 시뮬레이션 ────────────────────────────

/**
 * 수시 6장 최적 배분 시뮬레이션.
 *
 * @param candidates 후보 목록
 * @param config 배분 설정
 * @param topN 상위 N개 추천 반환
 * @returns 추천 목록 (점수 내림차순)
 */
export function simulateAllocation(
  candidates: AllocationCandidate[],
  config: AllocationConfig = DEFAULT_ALLOCATION_CONFIG,
  topN: number = 5,
): AllocationRecommendation[] {
  const maxSlots = config.maxSlots;

  // 후보가 maxSlots 이하면 유일한 조합
  if (candidates.length <= maxSlots) {
    const slots = [...candidates];
    const rec = buildRecommendation(slots, config);
    return [rec];
  }

  const recommendations: AllocationRecommendation[] = [];

  if (candidates.length <= 15) {
    // 완전 탐색: C(n, k)
    for (const combo of generateCombinations(candidates, maxSlots)) {
      recommendations.push(buildRecommendation(combo, config));
    }
  } else {
    // 대규모: 티어별 제약 조합
    const byTier = groupByTier(candidates);
    const tierCombos = generateConstrainedCombinations(byTier, config);
    for (const combo of tierCombos) {
      recommendations.push(buildRecommendation(combo, config));
    }
  }

  // 점수 내림차순 정렬 → topN
  recommendations.sort((a, b) => b.score - a.score);
  return recommendations.slice(0, topN);
}

function buildRecommendation(
  slots: AllocationCandidate[],
  config: AllocationConfig,
): AllocationRecommendation {
  return {
    slots,
    byTier: groupByTier(slots),
    byRound: groupByRound(slots),
    byLevel: groupByLevel(slots),
    score: scoreCombination(slots, config),
    warnings: generateWarnings(slots, config),
    interviewConflicts: checkInterviewConflictsForSlots(slots),
  };
}

/**
 * 티어별 제약 조합 생성 (n > 15 대규모 후보 대응).
 * 각 티어의 min~max 범위 내에서 조합 생성.
 */
function* generateConstrainedCombinations(
  byTier: Record<AllocationTier, AllocationCandidate[]>,
  config: AllocationConfig,
): Generator<AllocationCandidate[]> {
  const tiers: AllocationTier[] = ["reach", "target", "safety"];
  const maxSlots = config.maxSlots;

  // 각 티어별 가능한 슬롯 수 범위
  const ranges = tiers.map((tier) => {
    const available = byTier[tier].length;
    return {
      tier,
      min: Math.min(config[tier].min, available),
      max: Math.min(config[tier].max, available),
    };
  });

  // 슬롯 수 조합 (합 = maxSlots)
  for (let r = ranges[0].min; r <= ranges[0].max; r++) {
    for (let t = ranges[1].min; t <= ranges[1].max; t++) {
      const s = maxSlots - r - t;
      if (s < ranges[2].min || s > ranges[2].max) continue;

      // 각 티어에서 해당 수만큼 선택
      for (const reachCombo of generateCombinations(byTier.reach, r)) {
        for (const targetCombo of generateCombinations(byTier.target, t)) {
          for (const safetyCombo of generateCombinations(byTier.safety, s)) {
            yield [...reachCombo, ...targetCombo, ...safetyCombo];
          }
        }
      }
    }
  }
}
