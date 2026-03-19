// ============================================
// 필수 과목 합산
// Phase 8.2 — COMPUTE row 59 로직
// ============================================

import type { ParsedMandatoryPattern, ResolvedScores, SubjectBreakdown } from "./types";
import { resolveSlotScore } from "./subject-selector";
import { slotLabel } from "./constants";

/**
 * 필수 과목 합산.
 * COMPUTE row 59: 필수 패턴에 포함된 과목만 합산.
 */
export function calculateMandatoryScore(
  pattern: ParsedMandatoryPattern,
  resolved: ResolvedScores,
): { total: number; breakdown: SubjectBreakdown[] } {
  let total = 0;
  const breakdown: SubjectBreakdown[] = [];

  for (const slot of pattern.subjects) {
    const score = resolveSlotScore(slot, resolved);
    total += score;
    if (score > 0) {
      breakdown.push({
        subject: slotLabel(slot),
        rawScore: 0, // 상세 raw는 상위에서 추적
        convertedScore: score,
      });
    }
  }

  return { total, breakdown };
}
