// ============================================
// 가중택 조합 MAX
// Phase 8.2 — COMPUTE row 61 로직 (63개 대학만)
// ============================================

import type { ParsedWeightedPattern, ResolvedScores } from "./types";
import { expandPoolToScores } from "./subject-selector";

/**
 * 가중택 점수 계산.
 * COMPUTE row 61: 과목 풀에서 N개를 선택하여 가중 합산, 모든 순열 중 MAX.
 *
 * 예: "국수영탐(2)中가중택4" + weights=[30,30,20,20]
 * → 4개 과목의 모든 순열(4!=24)에 가중치를 적용, MAX 합산.
 *
 * 풀 크기 최대 6, pick 최대 5 → 최대 C(6,5)×5! = 720 순열. 실제로 충분히 빠름.
 */
export function calculateWeightedScore(
  pattern: ParsedWeightedPattern | null,
  resolved: ResolvedScores,
  weights?: number[],
): { total: number } {
  if (!pattern) return { total: 0 };

  const poolScores = expandPoolToScores(pattern.pool, resolved).filter((s) => s > 0);

  if (poolScores.length === 0 || !weights || weights.length === 0) {
    return { total: 0 };
  }

  const pickCount = Math.min(pattern.pickCount, poolScores.length, weights.length);

  // 모든 순열을 탐색하여 가중 합산 최대값
  let maxTotal = 0;

  function permute(selected: number[], remaining: number[]) {
    if (selected.length === pickCount) {
      let total = 0;
      for (let i = 0; i < selected.length; i++) {
        total += selected[i] * (weights![i] / 100); // weights는 % 단위 가정
      }
      maxTotal = Math.max(maxTotal, total);
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      const next = [...remaining];
      next.splice(i, 1);
      permute([...selected, remaining[i]], next);
    }
  }

  permute([], poolScores);
  return { total: maxTotal };
}
