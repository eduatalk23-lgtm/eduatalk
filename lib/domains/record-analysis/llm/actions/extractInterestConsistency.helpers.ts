// ============================================
// H2 / L3-B: Interest Consistency 보조 헬퍼 (순수 함수)
// "use server" 파일과 분리 — Next.js 15+ 제약 회피 (use server는 async export만 허용)
// ============================================

import type { InterestConsistencyInput } from "../types";

/**
 * 입력 신호량이 너무 적어 의미 있는 서사를 만들 수 없는 경우 true.
 * - themes 0개 + careerTrajectory 없음 + persistentStrengths/Weaknesses 모두 비었으면 호출 가치 없음.
 */
export function isInterestConsistencyInputInsufficient(input: InterestConsistencyInput): boolean {
  const hasThemes = input.themes.length > 0;
  const hasTrajectory = !!input.careerTrajectory && input.careerTrajectory.byYear.length >= 1;
  const hasCompetency = input.persistentStrengths.length > 0 || input.persistentWeaknesses.length > 0;
  return !hasThemes && !hasTrajectory && !hasCompetency;
}
