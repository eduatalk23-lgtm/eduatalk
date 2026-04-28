// ============================================
// pipeline/slots/slot-aware-score.ts
//
// P2-1 (2026-04-28): Step 2.2 — Slot-aware Score 시그니처 스캐폴드.
// shadow run 으로 박제된 슬롯 격자(Step 2.1) 를 매칭 알고리즘이 직접 소비하도록
// score 함수를 (guide, slot, student) 시그니처로 도입한다.
//
// 본 파일은 타입/시그니처/Provenance 스키마/단위 테스트용 하네스만 제공.
// 실제 매칭 적용은 phase-s2-guide-ranking.ts 와 호출자에서 후속 PR 진행.
//
// 5개 신규 보너스:
//  1. tierFit       — 가이드 difficulty ↔ 슬롯 tier 정합 (cascade tier 기반)
//  2. subjectFit    — 가이드 subject ↔ 슬롯 subareaKey 정합 (regular/career_subject)
//  3. milestoneFill — 슬롯의 unfulfilledMilestoneIds 와 가이드 milestone 매칭
//  4. focusFit      — 슬롯 focusKeywords 와 가이드 keywords 교집합
//  5. weaknessFix   — 슬롯 weakCompetencies 와 가이드 competency_focus 교집합
//
// W3C PROV-O 정렬: 각 보너스의 입력/근거를 Provenance breakdown 으로 노출.
// ============================================

import type { Slot, SlotDifficulty } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// 도메인 미니멀 타입 — 본 모듈은 매칭 호출부와 디커플 (테스트 용이성)
// ─────────────────────────────────────────────────────────────────────────

export interface ScoreableGuide {
  id: string;
  subjectId: string | null;
  subjectName: string | null;
  difficultyLevel: SlotDifficulty | null;
  keywords: string[];
  competencyFocus: string[];
  /** 가이드가 다루는 milestone IDs — blueprint milestones 와 매칭 */
  milestoneIds: string[];
  /** 가이드 작성 시 지정된 진로 분야 (career field) */
  careerFields: string[];
}

export interface ScoreableStudent {
  studentId: string;
  /** 학년별 leveling cap */
  maxDifficultyByGrade: Record<number, SlotDifficulty>;
  /** 학생의 진로 분야 호환 리스트 */
  careerCompatibility: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// Provenance — 보너스별 입력/판정 근거
// ─────────────────────────────────────────────────────────────────────────

export interface BonusProvenance {
  name: BonusName;
  /** 0~1 정규화된 보너스 값 (가중치 적용 전) */
  rawValue: number;
  /** 가중치(예: tierFit=15) 적용 후 */
  weighted: number;
  /** 판정 근거 (디버그/PR 코멘트용 자유 텍스트) */
  rationale: string;
}

export type BonusName =
  | "tierFit"
  | "subjectFit"
  | "milestoneFill"
  | "focusFit"
  | "weaknessFix";

export interface ScoreBreakdown {
  /** 슬롯/가이드 페어의 총점 */
  totalScore: number;
  /** 각 보너스별 기록 — 합산은 weighted 의 합 */
  bonuses: BonusProvenance[];
  /** hard filter 통과 여부 (난이도 cap, F16 차단 등) — false 면 pair 제외 */
  passesConstraints: boolean;
  /** 제외 사유 (passesConstraints=false 시 채움) */
  filterRejectReason: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// 가중치 — slot-config.ts 와 정합. 후속 PR 에서 외부 설정으로 이전 가능.
// ─────────────────────────────────────────────────────────────────────────

export const SLOT_AWARE_BONUS_WEIGHTS = {
  tierFit: 15,
  subjectFit: 12,
  milestoneFill: 18,
  focusFit: 10,
  weaknessFix: 12,
} as const satisfies Record<BonusName, number>;

// ─────────────────────────────────────────────────────────────────────────
// 메인 시그니처 — Step 2.2 의 단일 진실 진입점
// ─────────────────────────────────────────────────────────────────────────

/**
 * 가이드-슬롯-학생 트리플의 적합도 점수 + Provenance breakdown.
 *
 * 본 함수는 순수 함수 — DB/LLM 의존 없음. 매칭 알고리즘이 후보 가이드 N건 × 슬롯 M개를
 * 곱한 NxM 그리드에서 호출되므로 hot path. 외부 부수효과 금지.
 *
 * 후속 PR (Step 2.3) 에서 hard filter (leveling cap·F16·tier strict) 를 강화하고
 * Step 2.4 에서 MMR 다양성을 추가한다. 본 시그니처는 그 변경에 안정적이어야 한다.
 */
export function scoreGuideForSlot(
  guide: ScoreableGuide,
  slot: Slot,
  student: ScoreableStudent,
): ScoreBreakdown {
  const bonuses: BonusProvenance[] = [];

  // Hard filter — 난이도 cap (slot.constraints.maxDifficulty 또는 student maxDifficultyByGrade)
  const cap =
    slot.constraints.maxDifficulty ??
    student.maxDifficultyByGrade[slot.grade] ??
    "advanced";
  if (
    guide.difficultyLevel &&
    difficultyOrder(guide.difficultyLevel) > difficultyOrder(cap) &&
    slot.constraints.tierStrictness === "strict"
  ) {
    return {
      totalScore: 0,
      bonuses: [],
      passesConstraints: false,
      filterRejectReason: `difficulty cap exceeded: guide=${guide.difficultyLevel} cap=${cap}`,
    };
  }

  // 1. tierFit
  bonuses.push(computeTierFit(guide, slot));
  // 2. subjectFit
  bonuses.push(computeSubjectFit(guide, slot));
  // 3. milestoneFill
  bonuses.push(computeMilestoneFill(guide, slot));
  // 4. focusFit
  bonuses.push(computeFocusFit(guide, slot));
  // 5. weaknessFix
  bonuses.push(computeWeaknessFix(guide, slot));

  const totalScore = bonuses.reduce((sum, b) => sum + b.weighted, 0);

  return {
    totalScore,
    bonuses,
    passesConstraints: true,
    filterRejectReason: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 보너스 구현 — 각 함수는 0~1 rawValue 를 산출. weighted 는 가중치 곱.
// ─────────────────────────────────────────────────────────────────────────

function difficultyOrder(d: SlotDifficulty): number {
  return d === "basic" ? 0 : d === "intermediate" ? 1 : 2;
}

function computeTierFit(guide: ScoreableGuide, slot: Slot): BonusProvenance {
  // 슬롯 tier 와 가이드 difficulty 의 정합:
  //  foundational ↔ basic / development ↔ intermediate / advanced ↔ advanced
  const expected: SlotDifficulty =
    slot.tier === "foundational"
      ? "basic"
      : slot.tier === "development"
        ? "intermediate"
        : "advanced";
  const actual = guide.difficultyLevel ?? "intermediate";
  const distance = Math.abs(difficultyOrder(actual) - difficultyOrder(expected));
  const raw = distance === 0 ? 1 : distance === 1 ? 0.5 : 0;
  return {
    name: "tierFit",
    rawValue: raw,
    weighted: raw * SLOT_AWARE_BONUS_WEIGHTS.tierFit,
    rationale: `slot.tier=${slot.tier} expected=${expected} guide=${actual} dist=${distance}`,
  };
}

function computeSubjectFit(guide: ScoreableGuide, slot: Slot): BonusProvenance {
  // career_subject / regular_subject 슬롯에서만 의미 있음 — 그 외 area 는 0.5 중립.
  if (slot.area !== "career_subject" && slot.area !== "regular_subject") {
    return {
      name: "subjectFit",
      rawValue: 0.5,
      weighted: 0.5 * SLOT_AWARE_BONUS_WEIGHTS.subjectFit,
      rationale: `slot.area=${slot.area} — subjectFit neutral`,
    };
  }
  // subareaKey 는 학년별 subject_id 또는 카테고리. 정합 시 1, 미스매치 0.
  const matched =
    !!guide.subjectId && slot.subareaKey === guide.subjectId;
  const raw = matched ? 1 : 0;
  return {
    name: "subjectFit",
    rawValue: raw,
    weighted: raw * SLOT_AWARE_BONUS_WEIGHTS.subjectFit,
    rationale: `slot.subareaKey=${slot.subareaKey} guide.subjectId=${guide.subjectId ?? "null"} matched=${matched}`,
  };
}

function computeMilestoneFill(guide: ScoreableGuide, slot: Slot): BonusProvenance {
  if (slot.intent.unfulfilledMilestoneIds.length === 0 || guide.milestoneIds.length === 0) {
    return {
      name: "milestoneFill",
      rawValue: 0,
      weighted: 0,
      rationale: "no unfulfilled milestones or guide.milestoneIds empty",
    };
  }
  const overlap = guide.milestoneIds.filter((id) =>
    slot.intent.unfulfilledMilestoneIds.includes(id),
  );
  const raw = overlap.length / slot.intent.unfulfilledMilestoneIds.length;
  return {
    name: "milestoneFill",
    rawValue: raw,
    weighted: raw * SLOT_AWARE_BONUS_WEIGHTS.milestoneFill,
    rationale: `overlap=${overlap.length}/${slot.intent.unfulfilledMilestoneIds.length} ids=${overlap.join(",")}`,
  };
}

function computeFocusFit(guide: ScoreableGuide, slot: Slot): BonusProvenance {
  if (slot.intent.focusKeywords.length === 0 || guide.keywords.length === 0) {
    return {
      name: "focusFit",
      rawValue: 0,
      weighted: 0,
      rationale: "focusKeywords or guide.keywords empty",
    };
  }
  const overlap = guide.keywords.filter((k) =>
    slot.intent.focusKeywords.some((fk) => fk.toLowerCase() === k.toLowerCase()),
  );
  const raw = Math.min(1, overlap.length / 3); // 3개 매칭 시 만점
  return {
    name: "focusFit",
    rawValue: raw,
    weighted: raw * SLOT_AWARE_BONUS_WEIGHTS.focusFit,
    rationale: `overlap=${overlap.length} keywords=${overlap.join(",")}`,
  };
}

function computeWeaknessFix(guide: ScoreableGuide, slot: Slot): BonusProvenance {
  if (slot.intent.weakCompetencies.length === 0 || guide.competencyFocus.length === 0) {
    return {
      name: "weaknessFix",
      rawValue: 0,
      weighted: 0,
      rationale: "weakCompetencies or guide.competencyFocus empty",
    };
  }
  const overlap = guide.competencyFocus.filter((c) =>
    slot.intent.weakCompetencies.includes(c),
  );
  const raw = Math.min(1, overlap.length / 2); // 2개 매칭 시 만점
  return {
    name: "weaknessFix",
    rawValue: raw,
    weighted: raw * SLOT_AWARE_BONUS_WEIGHTS.weaknessFix,
    rationale: `overlap=${overlap.length} comps=${overlap.join(",")}`,
  };
}
