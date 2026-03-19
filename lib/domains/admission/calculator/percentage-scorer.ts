// ============================================
// PERCENTAGE 경로 환산
// Phase 8.2b — 등수(%) → PercentageTable lookup → 총점
// ============================================

import type { PercentageTable, PercentageInput } from "./types";

/**
 * 가중택 경로: 학생 등수(%) → PERCENTAGE 테이블 lookup → 대학별 총점.
 *
 * PercentageTable 키: "트랙-퍼센타일*100" (e.g. "문과-675" = 문과 6.75%)
 * 정확 일치 없으면 인접 퍼센타일에서 선형 보간.
 */
export function calculatePercentageScore(
  input: PercentageInput,
  percentageTable: PercentageTable,
): { total: number; percentileUsed: number } {
  const pctKey = Math.round(input.percentile * 100); // 6.75 → 675

  // 1. 정확 일치 시도
  const exactKey = `${input.track}-${pctKey}`;
  const exact = percentageTable.get(exactKey);
  if (exact != null) {
    return { total: exact, percentileUsed: input.percentile };
  }

  // 2. 보간: 인접 키 찾기 (±1 범위)
  // ceil 방향 (보수적 — 더 낮은 점수)
  for (let delta = 1; delta <= 5; delta++) {
    const upperKey = `${input.track}-${pctKey + delta}`;
    const upperVal = percentageTable.get(upperKey);
    if (upperVal != null) {
      return { total: upperVal, percentileUsed: (pctKey + delta) / 100 };
    }
  }

  // floor 방향
  for (let delta = 1; delta <= 5; delta++) {
    const lowerKey = `${input.track}-${pctKey - delta}`;
    const lowerVal = percentageTable.get(lowerKey);
    if (lowerVal != null) {
      return { total: lowerVal, percentileUsed: (pctKey - delta) / 100 };
    }
  }

  // 3. 매칭 실패
  return { total: 0, percentileUsed: 0 };
}
