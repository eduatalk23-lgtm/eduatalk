/**
 * 목표 학교권 분류 — 설계 모드 레벨링 입력
 * university-tiers.ts(대학명→티어)와 별개로, 학생의 "목표 수준"을 4단계로 분류
 */

export type SchoolTier = "sky_plus" | "in_seoul" | "regional" | "general";

export const SCHOOL_TIER_LABELS: Record<SchoolTier, string> = {
  sky_plus: "SKY+ (상위권)",
  in_seoul: "인서울",
  regional: "지방거점",
  general: "일반",
};

export const SCHOOL_TIER_OPTIONS: { value: SchoolTier; label: string }[] = [
  { value: "sky_plus", label: SCHOOL_TIER_LABELS.sky_plus },
  { value: "in_seoul", label: SCHOOL_TIER_LABELS.in_seoul },
  { value: "regional", label: SCHOOL_TIER_LABELS.regional },
  { value: "general", label: SCHOOL_TIER_LABELS.general },
];

export const SCHOOL_TIER_ORDER: SchoolTier[] = [
  "sky_plus", "in_seoul", "regional", "general",
];

export function isSchoolTier(value: unknown): value is SchoolTier {
  return (
    value === "sky_plus" ||
    value === "in_seoul" ||
    value === "regional" ||
    value === "general"
  );
}
