// ============================================
// pipeline/slots/slot-priority.ts
//
// Step 2.1: Slot 우선순위 0~100 산출.
// 비어있는 슬롯 + critical 보강 슬롯 + 진로교과 + advanced tier 가중.
// 가중치는 SLOT_PRIORITY_WEIGHTS에서 한 곳 관리.
// ============================================

import { SLOT_PRIORITY_WEIGHTS } from "./slot-config";
import type { Slot } from "./types";

const BASE_PRIORITY = 50;
const MAX_PRIORITY = 100;

export function computeSlotPriority(slot: Slot): number {
  let p = BASE_PRIORITY;

  const w = SLOT_PRIORITY_WEIGHTS;

  // 1. 비어있을수록 우선
  const fillRatio = Math.max(0, Math.min(1, slot.state.fillRatio));
  p += (1 - fillRatio) * w.emptyMultiplier;
  if (slot.state.currentCount === 0) p += w.zeroFillBonus;

  // 2. 미해결 milestone 보강 슬롯
  p += slot.intent.unfulfilledMilestoneIds.length * w.perUnfulfilledMilestone;

  // 3. critical quality issue 보강 슬롯
  p += slot.intent.qualityIssuesToCover.length * w.perQualityIssue;

  // 4. 진로교과 우선 (학종 본질)
  if (slot.area === "career_subject") p += w.careerSubjectBonus;

  // 5. advanced tier 우선 (학년 후순위 대응)
  if (slot.tier === "advanced") p += w.advancedTierBonus;

  return Math.min(MAX_PRIORITY, Math.round(p));
}
