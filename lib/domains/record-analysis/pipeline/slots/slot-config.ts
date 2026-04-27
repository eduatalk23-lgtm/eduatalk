// ============================================
// pipeline/slots/slot-config.ts
//
// Step 2.1 (2026-04-27): Slot Generator 튜닝 가능한 기본값.
// 모든 의사결정값은 이 파일 한 곳에서 관리 — 측정 후 조정 시 여기만 수정.
// ============================================

import type { SlotArea, SlotTier } from "./types";

/**
 * 슬롯별 expectedCount 룰.
 * 컨설팅 도메인 가이드:
 *  - 진로교과 advanced: 3 (자기 결론·한계 분석·재탐구 3종 권장)
 *  - 진로교과 development: 2 (심화 + 응용)
 *  - 진로교과 foundational: 2 (개념 + 동기 부여)
 *  - 일반교과: 1 (교과 역량 중심, 진로 연결 과잉 금지 — F16 회피)
 *  - 동아리·진로창체: 2 (지속성 + 깊이)
 *  - 자율창체·행특: 1
 */
export function expectedCountFor(area: SlotArea, tier: SlotTier): number {
  if (area === "career_subject") {
    if (tier === "advanced") return 3;
    return 2;
  }
  if (area === "regular_subject") return 1;
  if (area === "club" || area === "career_activity") return 2;
  return 1; // autonomy_activity, haengteuk
}

/**
 * F16 (진로 도배) 회피 임계값.
 * 비진로(regular_subject) 슬롯에 들어가는 가이드 제목에서
 * mainThemeKeywords와 매칭되는 토큰 수가 이 값 이상이면 차단.
 *
 * 보수적 시작값 = 3. 너무 엄격하면 낮추고, 너무 느슨하면 올림.
 */
export const F16_OVERLAP_THRESHOLD = 3;

/**
 * Slot Priority 가중치 (computeSlotPriority 결과는 0~100).
 * 베이스 50에서 가산 → 100 cap.
 */
export const SLOT_PRIORITY_WEIGHTS = {
  /** 비어있을수록 가산. (1 - fillRatio) × emptyMultiplier */
  emptyMultiplier: 30,
  /** currentCount === 0 추가 보너스 */
  zeroFillBonus: 10,
  /** unfulfilled milestone 1개당 */
  perUnfulfilledMilestone: 5,
  /** critical quality issue (F4·F16·M1 등) 1개당 */
  perQualityIssue: 3,
  /** career_subject 영역 보너스 */
  careerSubjectBonus: 10,
  /** advanced tier 보너스 */
  advancedTierBonus: 5,
} as const;

/**
 * 진로교과 분류 키워드 매칭 임계값.
 * cascadePlan.subjects에 명시된 교과는 우선 진로로 인정.
 * 명시되지 않은 교과는 mainThemeKeywords와 N개 이상 매칭 시 진로로 분류.
 */
export const CAREER_SUBJECT_FALLBACK_OVERLAP = 1;

/**
 * 일반교과 슬롯 도출 정책.
 * - "course_plan_only": 학생 수강계획에 명시된 교과만 (보수적, 권장)
 * - "cascade_plan_union": cascadePlan.subjects ∪ coursePlan
 * - "all_planned": 둘 중 하나라도 있으면 (가장 풍부)
 */
export const REGULAR_SUBJECT_POLICY: "course_plan_only" | "cascade_plan_union" | "all_planned" =
  "cascade_plan_union";

/**
 * Generator version — provenance 추적용.
 * 룰 변경 시 v2.0 → v2.1 등으로 bump.
 */
export const SLOT_GENERATOR_VERSION = "v2.0" as const;
