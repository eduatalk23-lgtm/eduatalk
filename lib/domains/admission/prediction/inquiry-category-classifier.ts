/**
 * Phase δ v0 — 규칙 기반 탐구 카테고리 분류기 (순수 함수)
 *
 * themeKeywords + careerField → Record<InquiryCategory, number>
 *
 * 출력 점수는 0~1 범위이며 카테고리 합계 정규화는 수행하지 않는다.
 * computeMainInquiryAlignment 의 categoryScores 입력과 직접 호환.
 *
 * LLM 분류기 교체 전 placeholder. 10 카테고리 × ~25개 키워드 사전 + careerField
 * 패턴 매핑으로 구현한다. fixture 평가 후 LLM 교체 판단.
 *
 * 순수 함수 — DB/async 없음.
 */

import type { InquiryCategory } from "../repository/main-inquiry-weights-repository";

// ─── 공개 타입 ──────────────────────────────────────────────────────────────

export interface InquiryCategoryClassifierInput {
  /** 메인 탐구 테마 키워드 배열 (일반적으로 3~8개) */
  themeKeywords: string[];
  /** 학생 진로 분야 자유 텍스트 (e.g. "의학", "소프트웨어 개발", null 허용) */
  careerField: string | null;
}

export interface InquiryCategoryClassifierResult {
  /** 각 카테고리에 대한 0~1 점수 맵 (normalize 안 함) */
  scores: Record<InquiryCategory, number>;
  /**
   * 매칭 근거 (각 카테고리가 왜 점수를 받았는지 디버깅용).
   * careerField 매칭 1건 + themeKeyword 매칭 0건 이상.
   */
  reasons: Array<{
    category: InquiryCategory;
    source: "career_primary" | "career_secondary" | "theme_keyword";
    matched: string;
    delta: number;
  }>;
}

// ─── 상수 ────────────────────────────────────────────────────────────────

const ALL_CATEGORIES: InquiryCategory[] = [
  "natural_science",
  "life_medical",
  "engineering",
  "it_software",
  "social_science",
  "humanities",
  "law_policy",
  "business_economy",
  "education",
  "arts_sports",
];

/**
 * 카테고리별 키워드 사전.
 *
 * 매칭 정책: themeKeyword 가 사전 단어를 substring 으로 포함하거나 그 반대.
 * 2글자 미만 keyword 는 noise 방지를 위해 스킵.
 *
 * 키워드는 각 카테고리 20~30개 — 한국 고등학교 탐구 어휘 기준.
 */
const CATEGORY_KEYWORD_DICT: Record<InquiryCategory, readonly string[]> = {
  natural_science: [
    "물리", "화학", "생물학", "지구과학", "천문", "수학", "통계", "실험",
    "법칙", "원리", "입자", "원자", "분자", "우주", "파동", "에너지",
    "반응", "촉매", "열역학", "양자", "유기화학", "무기화학", "세포",
    "유전", "진화", "생태", "기상", "지질", "광학", "전자기",
  ],
  life_medical: [
    "의학", "의료", "약학", "간호", "보건", "질병", "약물", "병원",
    "임상", "진단", "치료", "수술", "유전체", "면역", "신경과학",
    "뇌과학", "바이러스", "박테리아", "미생물", "해부", "생리학", "병리",
    "재활", "치의학", "한의학", "수의학", "영양학", "공중보건", "역학",
  ],
  engineering: [
    "공학", "기계공학", "전기공학", "전자공학", "건축", "토목", "환경공학",
    "화학공학", "재료공학", "신소재", "항공우주", "조선", "자동차",
    "로봇", "제어", "회로", "반도체", "디스플레이", "에너지공학",
    "원자력", "나노", "메카트로닉스", "플라즈마",
  ],
  it_software: [
    "컴퓨터", "프로그래밍", "소프트웨어", "인공지능", "머신러닝", "딥러닝",
    "알고리즘", "데이터", "빅데이터", "클라우드", "사이버보안", "네트워크",
    "웹개발", "앱개발", "코딩", "파이썬", "자바스크립트", "IoT",
    "사물인터넷", "블록체인", "메타버스", "정보보안", "HCI", "UX",
  ],
  social_science: [
    "사회학", "심리학", "사회복지", "행정학", "사회문제", "인구",
    "가족", "청소년", "노인", "장애", "여성학", "문화인류학",
    "지리학", "도시공학", "공동체", "소수자", "사회심리", "발달심리",
    "상담심리", "범죄학", "미디어", "저널리즘",
  ],
  humanities: [
    "인문학", "문학", "역사학", "철학", "언어학", "국어국문", "영어영문",
    "독문", "불문", "중문", "일문", "고전", "근현대사", "세계사",
    "미학", "윤리학", "종교학", "사상사", "동양사상", "서양철학",
    "문헌학", "비교문학",
  ],
  law_policy: [
    "법학", "헌법", "민법", "형법", "행정법", "정치학", "외교학",
    "국제관계", "공공정책", "정책학", "입법", "판례", "인권",
    "국제법", "국제기구", "UN", "NGO", "공공행정", "지방자치",
    "안보", "북한학",
  ],
  business_economy: [
    "경영학", "경제학", "회계", "재무", "마케팅", "무역", "금융",
    "주식", "은행", "기업가정신", "창업", "스타트업", "경영전략",
    "인사관리", "공급망", "물류", "부동산", "보험", "핀테크",
    "거시경제", "미시경제", "행동경제",
  ],
  education: [
    "교육학", "초등교육", "중등교육", "유아교육", "특수교육", "교수법",
    "교육과정", "학습이론", "교사", "교원", "교직", "교육평가",
    "진로상담", "교육심리", "교육공학", "평생교육", "다문화교육",
  ],
  arts_sports: [
    "미술", "음악", "무용", "연극", "영화", "디자인", "공예", "사진",
    "작곡", "연주", "공연예술", "체육", "스포츠과학", "운동생리",
    "무술", "경기분석", "스포츠심리", "피트니스", "애니메이션",
    "시각디자인", "산업디자인",
  ],
};

/**
 * careerField 자유 텍스트 → 주 카테고리 + 선택적 보조 카테고리.
 *
 * 한 careerField 가 여러 패턴에 매칭되면 모두 반영 (e.g. "의료 AI" → life_medical + it_software).
 */
const CAREER_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  primary: InquiryCategory;
  secondary?: InquiryCategory;
}> = [
  {
    pattern: /의학|의사|의료|간호|약학|한의|치의|수의|보건|제약|바이오|유전체/,
    primary: "life_medical",
    secondary: "natural_science",
  },
  {
    pattern: /컴퓨터|소프트웨어|프로그래머|개발자|AI|인공지능|데이터|보안|머신러닝|딥러닝|IT/i,
    primary: "it_software",
    secondary: "engineering",
  },
  {
    pattern: /공학|공대|기계|전기|전자|건축|토목|화공|재료|항공|조선|자동차|로봇|반도체/,
    primary: "engineering",
    secondary: "natural_science",
  },
  {
    pattern: /자연과학|물리학|화학|천문|지구과학|순수수학|통계학/,
    primary: "natural_science",
  },
  {
    pattern: /심리|사회복지|복지|사회학|행정|사회문제|도시|지리/,
    primary: "social_science",
  },
  {
    pattern: /인문|문학|역사|철학|언어|어문|고전/,
    primary: "humanities",
  },
  {
    pattern: /법조|법학|변호사|검사|판사|정치|외교|공공|국제관계|NGO|국제기구/,
    primary: "law_policy",
    secondary: "social_science",
  },
  {
    pattern: /경영|경제|회계|재무|마케팅|금융|무역|기업|창업|스타트업|경영전략/,
    primary: "business_economy",
    secondary: "social_science",
  },
  {
    pattern: /교육|교사|교수|선생|초등|중등|유아|교직/,
    primary: "education",
    secondary: "humanities",
  },
  {
    pattern: /예술|미술|음악|디자인|체육|스포츠|운동|무용|연극|영화/,
    primary: "arts_sports",
  },
];

/** careerField 매칭 시 가산 점수 (주 카테고리) */
const CAREER_PRIMARY_DELTA = 0.6;
/** careerField 매칭 시 가산 점수 (보조 카테고리) */
const CAREER_SECONDARY_DELTA = 0.3;
/** themeKeyword 매칭 시 가산 점수 (카테고리당 keyword 1개 기준) */
const KEYWORD_DELTA = 0.3;

// ─── 공개 함수 ──────────────────────────────────────────────────────────────

/**
 * 메인 탐구 키워드/진로 → 10 카테고리 점수 맵.
 *
 * 스코어링:
 *   1. careerField 패턴 매칭 → 주 카테고리 +0.6, 보조 카테고리 +0.3
 *   2. 각 themeKeyword 가 카테고리 사전에 매칭되면 해당 카테고리 +0.3
 *      (같은 카테고리 내 1개 keyword 당 1회만 가산 — 동일 keyword 여러 단어 매칭 방지)
 *   3. 카테고리별 최종 score = min(1.0, 합계)
 */
export function classifyInquiryCategories(
  input: InquiryCategoryClassifierInput,
): InquiryCategoryClassifierResult {
  const scores = emptyScores();
  const reasons: InquiryCategoryClassifierResult["reasons"] = [];

  // ── 1. careerField 매핑 ──────────────────────────────────────
  const career = input.careerField?.trim() ?? "";
  if (career.length > 0) {
    for (const { pattern, primary, secondary } of CAREER_PATTERNS) {
      if (pattern.test(career)) {
        applyDelta(scores, primary, CAREER_PRIMARY_DELTA);
        reasons.push({
          category: primary,
          source: "career_primary",
          matched: career,
          delta: CAREER_PRIMARY_DELTA,
        });
        if (secondary) {
          applyDelta(scores, secondary, CAREER_SECONDARY_DELTA);
          reasons.push({
            category: secondary,
            source: "career_secondary",
            matched: career,
            delta: CAREER_SECONDARY_DELTA,
          });
        }
      }
    }
  }

  // ── 2. themeKeywords 매핑 ────────────────────────────────────
  for (const raw of input.themeKeywords) {
    const keyword = raw?.trim() ?? "";
    if (keyword.length < 2) continue;

    for (const cat of ALL_CATEGORIES) {
      const dict = CATEGORY_KEYWORD_DICT[cat];
      const matchedDictWord = dict.find((word) => matchesBidirectional(keyword, word));
      if (matchedDictWord) {
        applyDelta(scores, cat, KEYWORD_DELTA);
        reasons.push({
          category: cat,
          source: "theme_keyword",
          matched: `${keyword} ~ ${matchedDictWord}`,
          delta: KEYWORD_DELTA,
        });
      }
    }
  }

  return { scores, reasons };
}

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────────────

function emptyScores(): Record<InquiryCategory, number> {
  return ALL_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = 0;
      return acc;
    },
    {} as Record<InquiryCategory, number>,
  );
}

function applyDelta(
  scores: Record<InquiryCategory, number>,
  cat: InquiryCategory,
  delta: number,
): void {
  scores[cat] = Math.min(1.0, Math.round((scores[cat] + delta) * 1000) / 1000);
}

/**
 * 양방향 substring 매칭.
 * "신경과학" vs "뇌과학" 같은 유사어는 못 잡지만 (LLM v1 의 역할),
 * "유전체학" vs "유전체" 같은 부분 매칭은 잡는다.
 */
function matchesBidirectional(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 2 && b.includes(a)) return true;
  if (b.length >= 2 && a.includes(b)) return true;
  return false;
}
