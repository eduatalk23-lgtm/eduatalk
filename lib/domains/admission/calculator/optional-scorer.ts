// ============================================
// 선택 과목 LARGE(top-N)
// Phase 8.2 — COMPUTE row 60 로직
// ============================================

import type { ParsedOptionalPattern, ResolvedScores, SubjectBreakdown } from "./types";
import { expandPoolToScores } from "./subject-selector";

/**
 * 선택 과목 점수 계산.
 * COMPUTE row 60: 풀에서 top-N 점수를 선택하여 합산.
 * Excel의 LARGE 함수와 동일.
 */
export function calculateOptionalScore(
  pattern: ParsedOptionalPattern | null,
  resolved: ResolvedScores,
): { total: number; breakdown: SubjectBreakdown[] } {
  if (!pattern) return { total: 0, breakdown: [] };

  const poolScores = expandPoolToScores(pattern.pool, resolved);

  // 내림차순 정렬 후 top-N 합산 (LARGE)
  poolScores.sort((a, b) => b - a);
  const selected = poolScores.slice(0, pattern.pickCount);

  const total = selected.reduce((sum, s) => sum + s, 0);
  const breakdown: SubjectBreakdown[] = selected.map((score, i) => ({
    subject: `선택${i + 1}`,
    rawScore: 0,
    convertedScore: score,
  }));

  return { total, breakdown };
}
