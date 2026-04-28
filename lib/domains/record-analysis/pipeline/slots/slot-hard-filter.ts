// ============================================
// pipeline/slots/slot-hard-filter.ts
//
// 권고3 / Step 2.3 (2026-04-28): hard filter — 점수와 무관하게 pair 를 무조건 제외.
//
// slot-aware-score 의 scoreGuideForSlot 은 1차 필터(strict tier 의 difficulty cap) 만
// 처리한다. 본 모듈은 그 외 hard rule 을 통합해 "이 가이드가 이 슬롯에 들어갈 수
// 있는가" 의 boolean 판정을 내린다. score 와 분리한 이유는 Convex Optimization 의
// hard/soft constraint 분리 원칙 — feasibility 와 optimality 를 섞지 않는다.
//
// 적용 규칙 6종:
//  H1. 난이도 cap — slot.constraints.maxDifficulty (strict 시) 또는 student cap 초과 차단
//  H2. F16 진로 도배 차단 — 비진로 슬롯에서 가이드의 mainTheme 키워드가 임계 이상이면 차단
//  H3. excludeKeywords — 슬롯이 명시적으로 제외한 키워드를 가이드가 가지면 차단
//  H4. excludeCareerFields — 슬롯이 명시적으로 제외한 진로분야와 가이드 진로분야가 겹치면 차단
//  H5. mustMatchCareerFields — 슬롯이 명시적으로 요구한 진로분야 중 하나라도 가이드에 없으면 차단
//  H6. tier strictness — strict 인 슬롯에서 가이드 tier 가 슬롯 tier 와 정확히 다른 그룹이면 차단
//
// graceful relaxation: optional `relaxLevel` 파라미터로 어느 규칙까지 무시할지 조절.
// 기본 0(전부 적용). 1(H6 완화) → 2(H6+H4 완화) → 3(H6+H4+H3 완화). H1/H2/H5 는 절대 완화 X.
// ============================================

import type { Slot, SlotDifficulty } from "./types";
import type { ScoreableGuide, ScoreableStudent } from "./slot-aware-score";

export type HardFilterRule =
  | "difficulty_cap"
  | "career_overuse"
  | "exclude_keyword"
  | "exclude_career"
  | "missing_required_career"
  | "tier_strict_mismatch";

export interface HardFilterResult {
  passes: boolean;
  /** 첫 번째로 위배된 규칙 — passes=false 일 때만 채워짐 */
  rejectedBy: HardFilterRule | null;
  reason: string | null;
}

export interface HardFilterOptions {
  /** F16 mainTheme 키워드 임계 (default 3) — 비진로 슬롯에서 mainTheme 키워드 매칭 ≥ 임계면 차단 */
  f16Threshold?: number;
  /** 0=전부 / 1=H6 / 2=H6+H4 / 3=H6+H4+H3 완화 */
  relaxLevel?: 0 | 1 | 2 | 3;
  /** 학생/학년 mainTheme 키워드 — H2 판정용 */
  mainThemeKeywords?: string[];
}

function difficultyOrder(d: SlotDifficulty): number {
  return d === "basic" ? 0 : d === "intermediate" ? 1 : 2;
}

export function applyHardFilter(
  guide: ScoreableGuide,
  slot: Slot,
  student: ScoreableStudent,
  options: HardFilterOptions = {},
): HardFilterResult {
  const { f16Threshold = 3, relaxLevel = 0, mainThemeKeywords = [] } = options;

  // H1. 난이도 cap — 절대 완화 X
  const cap =
    slot.constraints.maxDifficulty ??
    student.maxDifficultyByGrade[slot.grade] ??
    "advanced";
  if (
    guide.difficultyLevel &&
    difficultyOrder(guide.difficultyLevel) > difficultyOrder(cap)
  ) {
    return {
      passes: false,
      rejectedBy: "difficulty_cap",
      reason: `guide=${guide.difficultyLevel} > cap=${cap}`,
    };
  }

  // H2. F16 — 비진로 슬롯에서 mainTheme 키워드 과잉 차단. 절대 완화 X
  if (
    slot.area === "regular_subject" &&
    mainThemeKeywords.length > 0 &&
    guide.keywords.length > 0
  ) {
    const mtSet = new Set(mainThemeKeywords.map((k) => k.toLowerCase()));
    const matchCount = guide.keywords.filter((k) =>
      mtSet.has(k.toLowerCase()),
    ).length;
    if (matchCount >= f16Threshold) {
      return {
        passes: false,
        rejectedBy: "career_overuse",
        reason: `non-career slot + mainTheme matches=${matchCount} >= ${f16Threshold} (F16)`,
      };
    }
  }

  // H5. mustMatchCareerFields — 절대 완화 X
  if (slot.constraints.mustMatchCareerFields.length > 0) {
    const guideCareerSet = new Set(guide.careerFields);
    const missing = slot.constraints.mustMatchCareerFields.filter(
      (cf) => !guideCareerSet.has(cf),
    );
    if (missing.length > 0) {
      return {
        passes: false,
        rejectedBy: "missing_required_career",
        reason: `guide missing required career fields: ${missing.join(",")}`,
      };
    }
  }

  // H3. excludeKeywords — relaxLevel ≥ 3 시 완화
  if (relaxLevel < 3 && slot.constraints.excludeKeywords.length > 0 && guide.keywords.length > 0) {
    const exSet = new Set(slot.constraints.excludeKeywords.map((k) => k.toLowerCase()));
    const hit = guide.keywords.find((k) => exSet.has(k.toLowerCase()));
    if (hit) {
      return {
        passes: false,
        rejectedBy: "exclude_keyword",
        reason: `guide keyword "${hit}" in slot excludeKeywords`,
      };
    }
  }

  // H4. excludeCareerFields — relaxLevel ≥ 2 시 완화
  if (relaxLevel < 2 && slot.constraints.excludeCareerFields.length > 0 && guide.careerFields.length > 0) {
    const exCfSet = new Set(slot.constraints.excludeCareerFields);
    const hit = guide.careerFields.find((cf) => exCfSet.has(cf));
    if (hit) {
      return {
        passes: false,
        rejectedBy: "exclude_career",
        reason: `guide career "${hit}" in slot excludeCareerFields`,
      };
    }
  }

  // H6. tier strict mismatch — relaxLevel ≥ 1 시 완화
  if (
    relaxLevel < 1 &&
    slot.constraints.tierStrictness === "strict" &&
    guide.difficultyLevel
  ) {
    const expected: SlotDifficulty =
      slot.tier === "foundational"
        ? "basic"
        : slot.tier === "development"
          ? "intermediate"
          : "advanced";
    if (guide.difficultyLevel !== expected) {
      return {
        passes: false,
        rejectedBy: "tier_strict_mismatch",
        reason: `strict slot.tier=${slot.tier} expects ${expected} but guide=${guide.difficultyLevel}`,
      };
    }
  }

  return { passes: true, rejectedBy: null, reason: null };
}
