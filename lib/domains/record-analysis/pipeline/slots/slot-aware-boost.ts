// ============================================
// pipeline/slots/slot-aware-boost.ts
//
// Sprint 1 Wiring (2026-04-30) — Shadow → Production multiplier 합성기.
// 5 보너스(slot-aware-score) 합산을 main ranking 의 finalScore 에 곱해질
// multiplier(1.0~1+MAX) 로 변환.
//
// ENV flag ENABLE_SLOT_AWARE_RANKING=true 일 때만 phase-s2-guide-match 가
// finalScore 에 적용. flag off 시 박제만 수행.
// ============================================

/** tierFit(15) + subjectFit(12) + milestoneFill(18) + focusFit(10) + weaknessFix(12) */
export const SLOT_BOOST_BONUS_SUM = 67;

/** multiplier 최대 boost — 1+MAX 가 상한 (예: 0.5 → 1.5x) */
export const SLOT_BOOST_MAX = 0.5;

/**
 * best-slot totalScore → finalScore multiplier.
 *
 * 가이드는 여러 슬롯에서 채점되므로 그 중 max 점수를 합성 입력으로 사용.
 * 입력이 음수거나 SUM 초과여도 [0, SUM] 으로 clamp 후 정규화.
 */
export function computeSlotBoost(bestSlotScore: number): number {
  const clamped = Math.max(0, Math.min(SLOT_BOOST_BONUS_SUM, bestSlotScore));
  return 1 + (clamped / SLOT_BOOST_BONUS_SUM) * SLOT_BOOST_MAX;
}

/** shadow runner 출력에서 guide id → max(totalScore) map 추출. */
export function extractBestSlotScoreByGuide(
  topKPerSlot: ReadonlyArray<{
    readonly candidates: ReadonlyArray<{
      readonly guideId: string;
      readonly breakdown: { readonly totalScore: number };
    }>;
  }>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const slot of topKPerSlot) {
    for (const c of slot.candidates) {
      const prev = out.get(c.guideId) ?? 0;
      if (c.breakdown.totalScore > prev) out.set(c.guideId, c.breakdown.totalScore);
    }
  }
  return out;
}
