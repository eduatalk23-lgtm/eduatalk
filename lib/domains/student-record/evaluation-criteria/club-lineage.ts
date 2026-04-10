/**
 * 동아리 12계열 분류 + 연속성 검증 (Phase 2 Wave 1.4 / Decision #5)
 *
 * 컨설턴트 평가 프레임워크:
 *   - 동아리 = 진로 (가중치 0.14, 중요도 "상")
 *   - 2년 이상 지속이 이상적
 *   - 12계열 분류 기반 연속성 판정
 *   - 1→2학년 전환: 문·이과 변경 가능 (진로선택과목 수요조사 타이밍)
 *   - 2→3학년 전환: 같은 계열만 변경 가능 (엄격)
 *
 * 본 상수는 다음에 사용된다:
 *   1. classifyClubByName(name) — 동아리명에서 계열 추론
 *   2. computeClubContinuityScore(history, candidate) — 0.5~1.0 점수 산정
 *   3. runGuideMatching의 club_deep_dive 추천 시 ranking 가중치 (Decision #5 옵션 D)
 *
 * 하이브리드 스키마 (Q5-1 (c)):
 *   - 기존 8개 career_fields는 그대로 유지 (광역 매칭용)
 *   - 12계열은 연속성 체크 전용 별도 축
 *   - CAREER_FIELD_TO_LINEAGE_12로 lossy 매핑 제공
 */

// ============================================================
// 1. 12계열 정의
// ============================================================

/**
 * 12계열 코드.
 * 문과 4 + 이과 6 + 기타 2 = 12.
 */
export type Lineage12 =
  // 문과 4
  | "humanities" // 인문 (철학·역사·문학·언어학)
  | "languages" // 어문 (외국어·통번역)
  | "social_science" // 사회과학 (사회학·심리학·정치·언론)
  | "commerce" // 상경 (경영·경제·회계·무역)
  // 이과 6
  | "natural_science" // 자연과학 (수학·물리·화학·천문)
  | "engineering" // 공학 (기계·전자·컴퓨터·건축·토목)
  | "medical" // 의약학 (의대·한의·치의·약학)
  | "health" // 보건 (간호·물리치료·임상병리)
  | "life_science" // 생활과학 (식품·영양·의류·아동가족)
  | "agriculture" // 농림수산 (농업·축산·임학·수산)
  // 기타 2
  | "arts_sports" // 예체능
  | "education"; // 교육 (사범·교육학)

/** 큰 계열 분류 (1→2학년 전환 규칙용) */
export type Track = "humanities" | "science" | "other";

export interface Lineage12Definition {
  code: Lineage12;
  /** UI/프롬프트 표시용 한글명 */
  label: string;
  /** 큰 계열 (track) — 1→2학년 전환 규칙 적용 시 사용 */
  track: Track;
  /** 동아리 이름 keyword 매칭용 단어 목록 (소문자/한글 혼용) */
  keywords: string[];
}

export const LINEAGE_12_DEFINITIONS: Record<Lineage12, Lineage12Definition> = {
  humanities: {
    code: "humanities",
    label: "인문",
    track: "humanities",
    keywords: [
      "철학", "역사", "사학", "고전", "문학", "독서", "인문", "신학", "윤리",
      "비평", "고대", "중세", "한문", "국문",
    ],
  },
  languages: {
    code: "languages",
    label: "어문",
    track: "humanities",
    keywords: [
      "영어", "english", "일본어", "중국어", "독일어", "프랑스어", "스페인어",
      "통역", "번역", "어학", "다국어", "외국어", "언어학",
    ],
  },
  social_science: {
    code: "social_science",
    label: "사회과학",
    track: "humanities",
    keywords: [
      "사회", "정치", "외교", "법", "법학", "심리", "심리학", "신문", "방송",
      "언론", "미디어", "광고", "사회학", "인류학", "지리",
    ],
  },
  commerce: {
    code: "commerce",
    label: "상경",
    track: "humanities",
    keywords: [
      "경영", "경제", "회계", "마케팅", "금융", "주식", "투자", "창업", "기업가",
      "무역", "상경", "경제학", "비즈니스", "스타트업",
    ],
  },
  natural_science: {
    code: "natural_science",
    label: "자연과학",
    track: "science",
    keywords: [
      "수학", "수학경시", "수리", "물리", "화학", "천문", "지구과학", "통계",
      "과학탐구", "실험", "융합과학", "수과탐", "과탐",
    ],
  },
  engineering: {
    code: "engineering",
    label: "공학",
    track: "science",
    keywords: [
      "공학", "기계", "전자", "전기", "컴퓨터", "프로그래밍", "코딩", "로봇",
      "robotics", "ai", "인공지능", "메이커", "발명", "건축", "토목", "환경공학",
      "항공", "우주", "자동차", "드론", "iot", "임베디드", "vlsi", "반도체",
    ],
  },
  medical: {
    code: "medical",
    label: "의약학",
    track: "science",
    keywords: [
      "의학", "의대", "한의", "치의", "약학", "약대", "수의", "수의학",
      "신약", "임상", "병리",
    ],
  },
  health: {
    code: "health",
    label: "보건",
    track: "science",
    keywords: [
      "간호", "보건", "물리치료", "재활", "임상병리", "방사선", "응급구조",
      "치위생", "공중보건",
    ],
  },
  life_science: {
    code: "life_science",
    label: "생활과학",
    track: "science",
    keywords: [
      "식품", "영양", "조리", "베이킹", "의류", "패션", "아동", "가족",
      "주거", "소비자",
    ],
  },
  agriculture: {
    code: "agriculture",
    label: "농림수산",
    track: "science",
    keywords: [
      "농업", "원예", "축산", "임학", "수산", "해양", "농생명",
    ],
  },
  arts_sports: {
    code: "arts_sports",
    label: "예체능",
    track: "other",
    keywords: [
      "미술", "디자인", "음악", "합창", "오케스트라", "밴드", "연극", "뮤지컬",
      "영화", "사진", "체육", "축구", "농구", "배구", "야구", "탁구", "배드민턴",
      "댄스", "무용", "필라테스", "헬스",
    ],
  },
  education: {
    code: "education",
    label: "교육",
    track: "other",
    keywords: [
      "교육", "사범", "교사", "튜터링", "멘토링", "교육봉사",
    ],
  },
};

// ============================================================
// 2. 8 career_fields → 12계열 매핑 (lossy)
// ============================================================

/**
 * 기존 `exploration_guide_career_fields` 8개 → 12계열 lossy 매핑.
 * 1개 career_field가 여러 lineage에 대응할 수 있음 (예: "사회계열" → 사회과학 + 상경).
 *
 * 가이드 추천 후보의 career_field로부터 가능한 12계열을 추론할 때 사용.
 */
export const CAREER_FIELD_TO_LINEAGE_12: Record<string, Lineage12[]> = {
  공학계열: ["engineering"],
  자연계열: ["natural_science"],
  의약계열: ["medical", "health"],
  사회계열: ["social_science", "commerce"],
  인문계열: ["humanities", "languages"],
  교육계열: ["education"],
  예체능계열: ["arts_sports"],
  전계열: [
    // 전 계열 — 12계열 모두 후보. 빈 배열 대신 명시적 전체 나열.
    "humanities", "languages", "social_science", "commerce",
    "natural_science", "engineering", "medical", "health",
    "life_science", "agriculture", "arts_sports", "education",
  ],
};

// ============================================================
// 3. 동아리 이름 → 12계열 추론
// ============================================================

/**
 * 동아리 이름으로부터 12계열을 추론한다.
 * - 모든 lineage의 keywords와 부분 문자열 매칭 (case-insensitive, 한글은 그대로).
 * - 가장 많은 매치를 가진 lineage 1개 반환.
 * - 매치 0건이면 null (중립 — 연속성 점수 1.0 적용 권장).
 *
 * 주의:
 * - 정확도는 keyword 사전 풍부도에 의존. 미매칭 동아리는 확장 대상.
 * - 같은 점수일 때는 LINEAGE_12_DEFINITIONS 정의 순서 우선 (안정 정렬).
 */
export function classifyClubByName(name: string): Lineage12 | null {
  if (!name || name.trim().length === 0) return null;
  const normalized = name.toLowerCase().trim();

  let best: { code: Lineage12; score: number } | null = null;
  for (const def of Object.values(LINEAGE_12_DEFINITIONS)) {
    let score = 0;
    for (const kw of def.keywords) {
      if (normalized.includes(kw.toLowerCase())) {
        // 한글 키워드는 정확 매칭 가중치, 영문 keyword도 동일
        score += kw.length >= 3 ? 2 : 1;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { code: def.code, score };
    }
  }
  return best?.code ?? null;
}

// ============================================================
// 4. 연속성 점수 산정
// ============================================================

export interface ClubHistoryEntry {
  /** 학년 (1, 2, 3) */
  grade: number;
  /** 동아리명 (분류용) */
  name: string;
  /** 분류된 lineage (사전 계산 시 사용, 없으면 classifyClubByName 호출) */
  lineage?: Lineage12 | null;
}

/**
 * 학생의 동아리 히스토리와 추천 후보 가이드 lineage를 비교해
 * 연속성 점수 0.5~1.0 반환.
 *
 * 규칙:
 *   - 히스토리 비어있음 (전학생/1학년) → 1.0 (중립, penalty 없음)
 *   - 후보 lineage = null (분류 실패) → 1.0 (penalty 없음)
 *   - 히스토리에 같은 lineage가 있음 → 1.0 (완벽 연속)
 *   - 같은 track(문/이과)에 속함 → 0.85
 *   - 다른 track:
 *     - 학생이 1학년 또는 1→2학년 전환 시점이면 → 0.85 (전환 허용)
 *     - 2→3학년 전환 시점(targetGrade=3)이면 → 0.5 (엄격, 큰 페널티)
 *
 * @param history 학년별 동아리 내역 (오래된 순)
 * @param candidateLineage 추천 가이드의 lineage
 * @param targetGrade 가이드가 배정될 학년 (1/2/3) — 전환 규칙 분기에 사용
 */
export function computeClubContinuityScore(
  history: ClubHistoryEntry[],
  candidateLineage: Lineage12 | null,
  targetGrade: number,
): number {
  // 분류 실패 또는 히스토리 없음 → 중립
  if (!candidateLineage) return 1.0;
  if (history.length === 0) return 1.0;

  // 정렬: 학년 오름차순
  const sorted = [...history].sort((a, b) => a.grade - b.grade);

  // 후보 lineage의 track
  const candidateTrack = LINEAGE_12_DEFINITIONS[candidateLineage].track;

  // 히스토리의 lineage 집합 (분류 실패 항목은 제외)
  const historyLineages = new Set<Lineage12>();
  const historyTracks = new Set<Track>();
  for (const entry of sorted) {
    const lineage = entry.lineage ?? classifyClubByName(entry.name);
    if (lineage) {
      historyLineages.add(lineage);
      historyTracks.add(LINEAGE_12_DEFINITIONS[lineage].track);
    }
  }

  // 히스토리 분류가 전부 실패 → 중립
  if (historyLineages.size === 0) return 1.0;

  // 1) 같은 lineage가 히스토리에 있으면 완벽 연속 → 1.0
  if (historyLineages.has(candidateLineage)) return 1.0;

  // 2) 같은 track에 속함 → 0.85 (자연스러운 인접 변경)
  if (historyTracks.has(candidateTrack)) return 0.85;

  // 3) 다른 track으로 전환 — 학년 규칙 적용
  // 2→3학년 전환 (targetGrade=3)은 엄격
  if (targetGrade >= 3) return 0.5;

  // 1→2학년 전환은 허용 (진로선택과목 수요조사 타이밍)
  return 0.85;
}

/**
 * 컨설턴트/디버깅용 — 점수의 사람이 읽을 수 있는 라벨.
 */
export function describeContinuityScore(score: number): {
  label: "perfect" | "good" | "warning";
  message: string;
} {
  if (score >= 0.95) return { label: "perfect", message: "계열 연속 — 같은 lineage" };
  if (score >= 0.8) return { label: "good", message: "같은 track 내 인접 변경" };
  return { label: "warning", message: "계열 불연속 — 2→3학년 전환 규칙 위반" };
}
