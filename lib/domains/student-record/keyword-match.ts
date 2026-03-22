// ============================================
// G3-6: 가이드 키워드 반영률 계산
// 세특 방향 가이드 키워드 vs 실제 세특 텍스트 매칭
// ============================================

// ============================================
// 1. 타입
// ============================================

export interface KeywordMatchResult {
  keyword: string;
  matched: boolean;
}

export interface SubjectReflectionRate {
  subjectName: string;
  totalKeywords: number;
  matchedKeywords: number;
  /** 0~100 */
  rate: number;
  details: KeywordMatchResult[];
}

// ============================================
// 2. 정규화
// ============================================

/** 매칭용 텍스트 정규화: 공백 축소, 특수문자 제거, 소문자 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[·\-_/\\()（）「」『』\[\]<>.,;:!?'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================
// 3. 단일 키워드 매칭
// ============================================

/** 키워드가 텍스트에 포함되는지 확인 (부분매칭 + 복합어 분리) */
export function matchKeywordInText(keyword: string, text: string): boolean {
  const nText = normalize(text);
  const nKeyword = normalize(keyword);

  // 2글자 미만 키워드는 너무 광범위 → skip
  if (nKeyword.length < 2) return false;

  // 전체 키워드 매칭
  if (nText.includes(nKeyword)) return true;

  // 복합 키워드 분리 매칭 (띄어쓰기 기준 2단어 이상이면 개별 단어 중 하나라도 매칭)
  const words = nKeyword.split(" ").filter((w) => w.length >= 2);
  if (words.length >= 2) {
    return words.some((word) => nText.includes(word));
  }

  return false;
}

// ============================================
// 4. 과목별 반영률 계산
// ============================================

export function calculateReflectionRate(
  subjectName: string,
  keywords: string[],
  setekText: string,
): SubjectReflectionRate {
  if (keywords.length === 0) {
    return { subjectName, totalKeywords: 0, matchedKeywords: 0, rate: 0, details: [] };
  }

  const details: KeywordMatchResult[] = keywords.map((keyword) => ({
    keyword,
    matched: setekText.length > 0 ? matchKeywordInText(keyword, setekText) : false,
  }));

  const matchedKeywords = details.filter((d) => d.matched).length;
  const rate = Math.round((matchedKeywords / keywords.length) * 100);

  return { subjectName, totalKeywords: keywords.length, matchedKeywords, rate, details };
}

// ============================================
// 5. 전체 반영률 요약
// ============================================

export interface ReflectionSummary {
  subjects: SubjectReflectionRate[];
  totalKeywords: number;
  totalMatched: number;
  averageRate: number;
}

export function calculateReflectionSummary(
  guideItems: { subjectName: string; keywords: string[] }[],
  /** 과목명 → 세특 텍스트 (1+2학기 합산) */
  setekTextMap: Map<string, string>,
): ReflectionSummary {
  const subjects = guideItems.map((item) => {
    const text = setekTextMap.get(item.subjectName) ?? "";
    return calculateReflectionRate(item.subjectName, item.keywords, text);
  });

  const totalKeywords = subjects.reduce((sum, s) => sum + s.totalKeywords, 0);
  const totalMatched = subjects.reduce((sum, s) => sum + s.matchedKeywords, 0);
  const averageRate = totalKeywords > 0
    ? Math.round((totalMatched / totalKeywords) * 100)
    : 0;

  return { subjects, totalKeywords, totalMatched, averageRate };
}
