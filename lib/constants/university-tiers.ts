// ============================================
// 대학 티어 분류 — 우회학과 필터/그룹용
// ============================================

export type UniversityTier = "sky" | "top_seoul" | "seoul" | "regional_top" | "other";

export const UNIVERSITY_TIER_LABELS: Record<UniversityTier, string> = {
  sky: "SKY",
  top_seoul: "인서울 상위",
  seoul: "인서울",
  regional_top: "지방거점",
  other: "기타",
};

export const UNIVERSITY_TIER_ORDER: UniversityTier[] = [
  "sky", "top_seoul", "seoul", "regional_top", "other",
];

const SKY = new Set([
  "서울대학교", "연세대학교", "고려대학교",
]);

const TOP_SEOUL = new Set([
  "성균관대학교", "서강대학교", "한양대학교", "중앙대학교",
  "경희대학교", "한국외국어대학교", "서울시립대학교",
  "이화여자대학교", "건국대학교",
]);

const SEOUL = new Set([
  "동국대학교", "숭실대학교", "홍익대학교", "국민대학교",
  "숙명여자대학교", "세종대학교", "단국대학교", "광운대학교",
  "상명대학교", "서울과학기술대학교", "한성대학교", "삼육대학교",
  "덕성여자대학교", "성신여자대학교", "서경대학교",
  "한국항공대학교", "명지대학교", "가톨릭대학교",
]);

const REGIONAL_TOP = new Set([
  "부산대학교", "경북대학교", "전남대학교", "충남대학교", "충북대학교",
  "전북대학교", "강원대학교", "제주대학교", "인하대학교", "아주대학교",
  "KAIST", "POSTECH", "UNIST", "GIST", "DGIST",
  "한국과학기술원", "포항공과대학교", "울산과학기술원",
  "광주과학기술원", "대구경북과학기술원",
]);

export function getUniversityTier(universityName: string): UniversityTier {
  if (SKY.has(universityName)) return "sky";
  if (TOP_SEOUL.has(universityName)) return "top_seoul";
  if (SEOUL.has(universityName)) return "seoul";
  if (REGIONAL_TOP.has(universityName)) return "regional_top";
  return "other";
}
