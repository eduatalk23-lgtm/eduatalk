// ============================================================
// 진로 분류 체계 통합 상수 (Phase C)
//
// 정본: department_classification 191건 (KEDI 3-Tier)
// 핵심: MAJOR_RECOMMENDED_COURSES 22개 키를 Tier 2로 편입
//
// Tier 1: KEDI 7대계열 (대분류) — students.desired_career_field
// Tier 2: MAJOR_RECOMMENDED_COURSES 22개 키 — students.target_major
// Tier 3: department_classification.id — students.target_sub_classification_id
// ============================================================

// ------------------------------------
// 1. Tier 1: KEDI 7대계열
// ------------------------------------

export const CAREER_TIER1 = [
  { code: "HUM", label: "인문계열" },
  { code: "SOC", label: "사회계열" },
  { code: "EDU", label: "교육계열" },
  { code: "ENG", label: "공학계열" },
  { code: "NAT", label: "자연계열" },
  { code: "MED", label: "의약계열" },
  { code: "ART", label: "예체능계열" },
] as const;

export type CareerTier1Code = (typeof CAREER_TIER1)[number]["code"];

export const CAREER_TIER1_CODES: CareerTier1Code[] = CAREER_TIER1.map((t) => t.code);

// ------------------------------------
// 2. Tier 1 → Tier 2 (MAJOR_RECOMMENDED_COURSES 키) 매핑
// ------------------------------------

export const TIER1_TO_MAJORS: Record<CareerTier1Code, readonly string[]> = {
  HUM: ["국어", "외국어", "사학·철학"],
  SOC: ["법·행정", "경영·경제", "심리", "사회복지", "언론·홍보", "정치·외교", "사회"],
  EDU: ["교육"],
  ENG: ["컴퓨터·정보", "전기·전자", "기계·자동차·로봇", "화학·신소재·에너지", "건축·사회시스템"],
  NAT: ["수리·통계", "물리·천문", "생명·바이오", "생활과학", "농림"],
  MED: ["의학·약학", "보건"],
  ART: [], // 예체능은 교과 추천 없음
};

/** 전체 22개 Tier 2 키 목록 */
export const ALL_MAJOR_KEYS: string[] = Object.values(TIER1_TO_MAJORS).flat();

// ------------------------------------
// 3. Tier 2 → Tier 1 역매핑
// ------------------------------------

export const MAJOR_TO_TIER1: Record<string, CareerTier1Code> = Object.fromEntries(
  Object.entries(TIER1_TO_MAJORS).flatMap(([tier1, majors]) =>
    majors.map((major) => [major, tier1 as CareerTier1Code]),
  ),
) as Record<string, CareerTier1Code>;

// ------------------------------------
// 4. KEDI 중분류(mid_name) → MAJOR_RECOMMENDED_COURSES 키 매핑
//    기존 bypass-major/constants.ts의 CLASSIFICATION_TO_CAREER_FIELD를 이관
// ------------------------------------

export const KEDI_MID_TO_MAJOR: Record<string, string | null> = {
  "경영ㆍ경제": "경영·경제",
  "법학": "법·행정",
  "사회과학": "사회",
  "언어ㆍ문학": "외국어",
  "인문학": "사학·철학",
  "교육": "교육",
  "간호": "보건",
  "보건": "보건",
  "생활과학": "생활과학",
  "수학ㆍ물리ㆍ천문ㆍ지구": "물리·천문",
  "화학ㆍ생명과학ㆍ환경": "생명·바이오",
  "농림ㆍ수산": "농림",
  "약학": "의학·약학",
  "의료": "의학·약학",
  "의료예과": "의학·약학",
  "건설": "건축·사회시스템",
  "기계": "기계·자동차·로봇",
  "교통ㆍ수송": "기계·자동차·로봇",
  "재료": "화학·신소재·에너지",
  "화공ㆍ고분자ㆍ에너지": "화학·신소재·에너지",
  "전기ㆍ전자ㆍ컴퓨터": "컴퓨터·정보",
  "산업ㆍ안전": "기계·자동차·로봇",
  // 예체능 — 추천교과 매핑 없음
  "무용ㆍ체육": null,
  "미술": null,
  "음악": null,
  "연극ㆍ영화": null,
  "응용예술": null,
};

// ------------------------------------
// 5. Tier 2 → KEDI 중분류 역매핑 (소분류 드롭다운용)
// ------------------------------------

/** Tier 2 (전공방향 키) → KEDI 중분류 mid_name 목록 (1:N) */
export const MAJOR_TO_KEDI_MIDS: Record<string, string[]> = Object.fromEntries(
  ALL_MAJOR_KEYS.map((major) => [
    major,
    Object.entries(KEDI_MID_TO_MAJOR)
      .filter(([, val]) => val === major)
      .map(([midName]) => midName),
  ]),
) as Record<string, string[]>;

// ------------------------------------
// 6. 유틸리티
// ------------------------------------

/** Tier1 코드인지 검증 */
export function isCareerTier1Code(value: unknown): value is CareerTier1Code {
  return typeof value === "string" && CAREER_TIER1_CODES.includes(value as CareerTier1Code);
}

/** Tier1 코드 → 한글 라벨 */
export function getCareerTier1Label(code: CareerTier1Code): string {
  return CAREER_TIER1.find((t) => t.code === code)?.label ?? code;
}

/** Tier1 코드 → 해당 Tier2(전공방향) 목록 */
export function getMajorsForTier1(code: CareerTier1Code): readonly string[] {
  return TIER1_TO_MAJORS[code] ?? [];
}

/** KEDI 중분류 → 전공방향 키 변환 */
export function resolveKediMidToMajor(midName: string | null): string | null {
  if (!midName) return null;
  return KEDI_MID_TO_MAJOR[midName] ?? null;
}
