// ============================================
// pipeline/slots/index.ts
//
// Step 2.1 Public API barrel.
// 외부 소비자는 이 파일에서만 import — 내부 파일 직접 참조 금지.
// ============================================

export { generateSlots } from "./slot-generator";
export { computeSlotPriority } from "./slot-priority";
export { classifySubject, tokenizeForSlot } from "./slot-area-classifier";
export { makeSlotId, slotPlaintextKey } from "./slot-id";
export {
  expectedCountFor,
  F16_OVERLAP_THRESHOLD,
  SLOT_PRIORITY_WEIGHTS,
  CAREER_SUBJECT_FALLBACK_OVERLAP,
  REGULAR_SUBJECT_POLICY,
  SLOT_GENERATOR_VERSION,
} from "./slot-config";

export type {
  Slot,
  SlotArea,
  SlotTier,
  SlotDifficulty,
  SlotIntent,
  SlotConstraints,
  SlotState,
  SlotProvenance,
  SlotGeneratorInput,
  SlotGeneratorOutput,
  MidPlanShape,
} from "./types";
