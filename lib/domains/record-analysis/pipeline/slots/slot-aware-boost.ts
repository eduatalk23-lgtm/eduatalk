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
 * Sprint 2-A 다양성 가드 (2026-04-30):
 * shadow runner 의 cross-slot 페널티(MAX/SOFT/HARD)와 동일 계수.
 * boost 받은 가이드가 여러 슬롯의 Top-1 을 점유하지 못하도록 main ranking 에도 적용.
 */
export const MAX_PER_GUIDE_TOP1 = 2;
export const SOFT_PENALTY_PER_USE = 5;
export const HARD_PENALTY_FACTOR = 0.5;

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

/**
 * shadow 의 슬롯별 Top-1(candidates[0]) 가이드 사용 횟수 집계.
 * 같은 가이드가 여러 슬롯의 Top-1 으로 잡힌 경우를 식별 → 다양성 페널티 입력.
 */
export function extractTop1CountByGuide(
  topKPerSlot: ReadonlyArray<{
    readonly candidates: ReadonlyArray<{
      readonly guideId: string;
    }>;
  }>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const slot of topKPerSlot) {
    const top1 = slot.candidates[0];
    if (!top1) continue;
    out.set(top1.guideId, (out.get(top1.guideId) ?? 0) + 1);
  }
  return out;
}

/**
 * 다양성 페널티 적용 — bestSlotScore 를 top1Count 에 따라 감산.
 * top1Count >= MAX(2) → hard penalty (×0.5)
 * 그 외 → soft penalty (-5 × top1Count)
 *
 * 한 슬롯 Top-1 점유는 정상이므로 top1Count=1 일 때도 -5 적용해
 * 두 슬롯 이상 점유 시 boost 감소가 누적되도록 한다 (shadow runner 와 동일 동작).
 */
export function applyDiversityPenalty(bestSlotScore: number, top1Count: number): number {
  if (top1Count >= MAX_PER_GUIDE_TOP1) {
    return bestSlotScore * HARD_PENALTY_FACTOR;
  }
  return Math.max(0, bestSlotScore - top1Count * SOFT_PENALTY_PER_USE);
}
