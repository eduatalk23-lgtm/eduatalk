// ============================================
// pipeline/slots/slot-id.ts
//
// Step 2.1: Slot 결정론적 ID. djb2 hash + 평문 prefix.
// 같은 (grade, area, subareaKey, tier) → 같은 ID.
// 디버깅을 위해 평문 prefix(`g2_career_subject:생명과학II_dev`)를 함께 보존.
// ============================================

import type { SlotArea, SlotTier } from "./types";

const TIER_SHORT: Record<SlotTier, string> = {
  foundational: "fnd",
  development: "dev",
  advanced: "adv",
};

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

export function slotPlaintextKey(
  grade: number,
  area: SlotArea,
  subareaKey: string,
  tier: SlotTier,
): string {
  return `g${grade}_${area}:${subareaKey}_${TIER_SHORT[tier]}`;
}

export function makeSlotId(
  grade: number,
  area: SlotArea,
  subareaKey: string,
  tier: SlotTier,
): string {
  const key = slotPlaintextKey(grade, area, subareaKey, tier);
  return `${key}#${djb2(key)}`;
}
