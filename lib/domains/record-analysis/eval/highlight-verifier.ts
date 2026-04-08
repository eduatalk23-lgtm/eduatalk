/**
 * 하이라이트 원문 검증 엔진
 *
 * A2 목표: LLM이 추출한 highlight 문자열이 실제 원문(sourceText)에서
 * 정확히 인용되었는지 검증한다.
 *
 * 3단계 검증:
 *   1. exactMatch  — sourceText.includes(highlight.trim())
 *   2. fuzzyMatch  — 공백·줄바꿈 정규화 후 includes
 *   3. similarity  — 단어 집합 Jaccard similarity (0~1)
 *
 * 커버리지 계산:
 *   highlight 내 고유 단어들이 sourceText 전체 단어 중 몇 %를 덮는지.
 *
 * 외부 라이브러리 의존 없음 — 순수 TypeScript.
 */

// ─── 공개 타입 ──────────────────────────────────────────────────────────────

export interface HighlightVerificationResult {
  /** 검증 대상 하이라이트 문자열 */
  highlight: string;
  /** 비교 대상 원문 텍스트 */
  sourceText: string;
  /** 정확한 substring 포함 여부 (trim 후 비교) */
  isExactMatch: boolean;
  /** 공백/줄바꿈 정규화 후 포함 여부 */
  isFuzzyMatch: boolean;
  /** 단어 집합 Jaccard similarity (0~1) */
  similarityScore: number;
  /** 원문 전체 단어 대비 하이라이트 단어 커버리지 (0~100, %) */
  coveragePercent: number;
  /** 검증 통과 여부 (fuzzyMatch=true 또는 similarity≥0.7 이면 통과) */
  passed: boolean;
  /** 실패 시 문제 설명 */
  issue?: string;
}

export interface AggregatedVerification {
  /** 검증 통과율 (0~100, %) */
  passRate: number;
  /** exactMatch 비율 (0~100, %) */
  exactMatchRate: number;
  /** fuzzyMatch 비율 (0~100, %) */
  fuzzyMatchRate: number;
  /** 평균 Jaccard similarity */
  avgSimilarity: number;
  /** 평균 커버리지 (%) */
  avgCoverage: number;
  /** 총 검증 건수 */
  total: number;
  /** 통과 건수 */
  passed: number;
  /** 실패 건수 */
  failed: number;
}

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────────────

/**
 * 문자열에서 단어 토큰 집합 추출.
 * 한글/영문/숫자만 남기고 나머지 구두점 제거, 소문자 정규화.
 */
function tokenize(text: string): Set<string> {
  const tokens = text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  return new Set(tokens);
}

/**
 * 공백·줄바꿈을 단일 스페이스로 정규화.
 * 전각 공백(U+3000) 및 NBSP도 처리.
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/[\s\u00A0\u3000]+/g, " ").trim();
}

/**
 * Jaccard similarity: |A ∩ B| / |A ∪ B|
 * 두 단어 집합이 얼마나 겹치는지 0~1 스케일로 반환.
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersectionSize = 0;
  for (const word of a) {
    if (b.has(word)) intersectionSize++;
  }
  const unionSize = a.size + b.size - intersectionSize;
  return intersectionSize / unionSize;
}

/**
 * 하이라이트 단어들이 원문 전체 단어 중 몇 %를 덮는지 계산.
 * (하이라이트 단어 집합 ∩ 원문 단어 집합) / 원문 단어 집합 × 100
 */
function computeCoverage(highlightTokens: Set<string>, sourceTokens: Set<string>): number {
  if (sourceTokens.size === 0) return 0;
  let covered = 0;
  for (const word of highlightTokens) {
    if (sourceTokens.has(word)) covered++;
  }
  return Math.round((covered / sourceTokens.size) * 100);
}

// 통과 기준 상수
const PASS_SIMILARITY_THRESHOLD = 0.7;

// ─── 공개 함수 ──────────────────────────────────────────────────────────────

/**
 * 단일 하이라이트를 원문 대비 검증한다.
 *
 * @param highlight - LLM이 추출한 인용 구절
 * @param sourceText - 원문 세특/창체/행특 텍스트
 */
export function verifyHighlight(
  highlight: string,
  sourceText: string,
): HighlightVerificationResult {
  const trimmedHighlight = highlight.trim();
  const trimmedSource = sourceText.trim();

  // 1. Exact match
  const isExactMatch = trimmedSource.includes(trimmedHighlight);

  // 2. Fuzzy match (공백 정규화)
  const normalizedHighlight = normalizeWhitespace(trimmedHighlight);
  const normalizedSource = normalizeWhitespace(trimmedSource);
  const isFuzzyMatch = normalizedSource.includes(normalizedHighlight);

  // 3. Jaccard similarity
  const highlightTokens = tokenize(trimmedHighlight);
  const sourceTokens = tokenize(trimmedSource);
  const similarityScore = jaccardSimilarity(highlightTokens, sourceTokens);

  // 4. Coverage (highlight가 원문 전체를 얼마나 덮는지)
  const coveragePercent = computeCoverage(highlightTokens, sourceTokens);

  // 통과 기준: fuzzyMatch이거나 similarity가 임계값 이상
  const passed = isFuzzyMatch || similarityScore >= PASS_SIMILARITY_THRESHOLD;

  let issue: string | undefined;
  if (!passed) {
    if (!isExactMatch && !isFuzzyMatch) {
      if (similarityScore < 0.3) {
        issue = `원문에서 찾을 수 없는 구절 (similarity=${similarityScore.toFixed(2)}). LLM이 임의로 변형/창작했을 가능성이 높음`;
      } else {
        issue = `원문 직접 인용 아님 (similarity=${similarityScore.toFixed(2)}). 요약/재표현 의심`;
      }
    }
  }

  return {
    highlight: trimmedHighlight,
    sourceText: trimmedSource,
    isExactMatch,
    isFuzzyMatch,
    similarityScore: Math.round(similarityScore * 1000) / 1000,
    coveragePercent,
    passed,
    issue,
  };
}

/**
 * 여러 하이라이트를 동일 원문 대비 일괄 검증한다.
 *
 * @param highlights - LLM이 추출한 인용 구절 목록
 * @param sourceText - 원문 텍스트
 */
export function verifyHighlights(
  highlights: string[],
  sourceText: string,
): HighlightVerificationResult[] {
  return highlights.map((h) => verifyHighlight(h, sourceText));
}

/**
 * 검증 결과 목록을 집계하여 전체 통계를 반환한다.
 *
 * @param results - verifyHighlights()의 반환값
 */
export function aggregateVerification(
  results: HighlightVerificationResult[],
): AggregatedVerification {
  if (results.length === 0) {
    return {
      passRate: 100,
      exactMatchRate: 100,
      fuzzyMatchRate: 100,
      avgSimilarity: 1,
      avgCoverage: 0,
      total: 0,
      passed: 0,
      failed: 0,
    };
  }

  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const exactCount = results.filter((r) => r.isExactMatch).length;
  const fuzzyCount = results.filter((r) => r.isFuzzyMatch).length;
  const sumSimilarity = results.reduce((s, r) => s + r.similarityScore, 0);
  const sumCoverage = results.reduce((s, r) => s + r.coveragePercent, 0);

  return {
    passRate: Math.round((passedCount / total) * 100),
    exactMatchRate: Math.round((exactCount / total) * 100),
    fuzzyMatchRate: Math.round((fuzzyCount / total) * 100),
    avgSimilarity: Math.round((sumSimilarity / total) * 1000) / 1000,
    avgCoverage: Math.round(sumCoverage / total),
    total,
    passed: passedCount,
    failed: total - passedCount,
  };
}

/**
 * HighlightAnalysisResult (LLM 응답 전체)에서 모든 highlight 문자열을 추출한다.
 * 원문 대비 검증 전 편의 헬퍼.
 *
 * @param sections - HighlightAnalysisResult.sections
 */
export function extractAllHighlights(
  sections: Array<{ tags: Array<{ highlight: string }> }>,
): string[] {
  return sections.flatMap((s) => s.tags.map((t) => t.highlight));
}
