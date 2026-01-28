/**
 * Task 2: 검색 쿼리 생성
 *
 * 이 파일은 검증된 입력값을 받아서 웹 검색에 사용할 검색어를 만듭니다.
 *
 * 📥 INPUT:  검증된 입력값 (Task 1의 결과)
 * 📤 OUTPUT: 검색 쿼리 문자열 + AI 맥락 정보
 *
 * 변환 규칙:
 * 1. 교과 + 과목 + 난이도 + 콘텐츠 타입을 조합
 * 2. 콘텐츠 타입에 따라 "교재 추천 목차" 또는 "인강 추천 강의 목록" 추가
 * 3. AI가 구조 정보를 찾도록 키워드 추가
 */

import {
  type ValidatedColdStartInput,
  type SearchQuery,
  type ContentType,
  type DifficultyLevel,
} from "./types";

/**
 * 검증된 입력값을 웹 검색 쿼리로 변환합니다.
 *
 * @param input - 검증된 입력값 (Task 1의 결과)
 * @returns 검색 쿼리 객체 (query: 검색어, context: AI 맥락)
 *
 * @example
 * // 교재 검색
 * const query = buildSearchQuery({
 *   subjectCategory: "수학",
 *   subject: "미적분",
 *   difficulty: "개념",
 *   contentType: "book"
 * });
 * // { query: "고등학교 수학 미적분 개념 교재 추천 목차", context: "미적분 개념서" }
 *
 * @example
 * // 강의 검색
 * const query = buildSearchQuery({
 *   subjectCategory: "영어",
 *   subject: null,
 *   difficulty: "심화",
 *   contentType: "lecture"
 * });
 * // { query: "고등학교 영어 심화 인강 추천 강의 목록", context: "영어 심화강의" }
 */
export function buildSearchQuery(input: ValidatedColdStartInput): SearchQuery {
  // ────────────────────────────────────────────────────────────────────
  // 1단계: 검색어 조각들 수집
  // ────────────────────────────────────────────────────────────────────

  const queryParts: string[] = [];

  // 기본 prefix: 고등학교 학습 콘텐츠임을 명시
  queryParts.push("고등학교");

  // 교과 추가 (필수)
  queryParts.push(input.subjectCategory);

  // 과목 추가 (있으면)
  if (input.subject) {
    queryParts.push(input.subject);
  }

  // 난이도 추가 (있으면)
  if (input.difficulty) {
    queryParts.push(input.difficulty);
  }

  // 콘텐츠 타입에 따른 suffix 추가
  const typeSuffix = getContentTypeSuffix(input.contentType);
  queryParts.push(typeSuffix);

  // ────────────────────────────────────────────────────────────────────
  // 2단계: AI 맥락 정보 생성
  // ────────────────────────────────────────────────────────────────────

  const context = buildContext(input);

  // ────────────────────────────────────────────────────────────────────
  // 3단계: 최종 쿼리 반환
  // ────────────────────────────────────────────────────────────────────

  return {
    query: queryParts.join(" "),
    context,
  };
}

/**
 * 콘텐츠 타입에 따른 검색어 suffix를 반환합니다.
 *
 * - book: "교재 추천 목차" - 목차 정보를 얻기 위함
 * - lecture: "인강 추천 강의 목록" - 강의 구성을 얻기 위함
 * - null (타입 미지정): "학습자료 추천" - 일반 검색
 */
function getContentTypeSuffix(contentType: ContentType | null): string {
  switch (contentType) {
    case "book":
      return "교재 추천 목차";
    case "lecture":
      return "인강 추천 강의 목록 (회차 구성, 총 강의 수, 평균 강의시간 포함)";
    default:
      return "학습자료 추천";
  }
}

/**
 * AI에게 전달할 맥락 정보를 생성합니다.
 *
 * 맥락 정보는 AI가 어떤 종류의 콘텐츠를 찾아야 하는지 이해하도록 돕습니다.
 *
 * @example
 * // "미적분 개념서"
 * // "영어 심화강의"
 * // "국어 기본 학습자료"
 */
function buildContext(input: ValidatedColdStartInput): string {
  const contextParts: string[] = [];

  // 과목 또는 교과 추가
  if (input.subject) {
    contextParts.push(input.subject);
  } else {
    contextParts.push(input.subjectCategory);
  }

  // 난이도 + 콘텐츠 타입 조합
  const typeLabel = getContextTypeLabel(input.difficulty, input.contentType);
  contextParts.push(typeLabel);

  return contextParts.join(" ");
}

/**
 * 난이도와 콘텐츠 타입을 조합하여 맥락 레이블을 생성합니다.
 *
 * @example
 * // 개념 + book = "개념서"
 * // 심화 + lecture = "심화강의"
 * // 기본 + null = "기본 학습자료"
 */
function getContextTypeLabel(
  difficulty: DifficultyLevel | null,
  contentType: ContentType | null
): string {
  // 콘텐츠 타입별 접미사
  const typeSuffix = contentType === "book" ? "서" : contentType === "lecture" ? "강의" : "학습자료";

  // 난이도가 있으면 조합
  if (difficulty) {
    // "개념서", "개념강의", "개념 학습자료"
    if (contentType === null) {
      return `${difficulty} ${typeSuffix}`;
    }
    return `${difficulty}${typeSuffix}`;
  }

  // 난이도가 없으면 타입만
  return typeSuffix;
}

// ============================================================================
// 고급 쿼리 빌더 (향후 확장용)
// ============================================================================

/**
 * 고급 검색 쿼리 옵션
 */
export interface AdvancedQueryOptions {
  /** 학년 (1, 2, 3) */
  grade?: number;

  /** 추가 키워드 */
  additionalKeywords?: string;

  /** 특정 출판사/플랫폼 선호 */
  preferredPublisher?: string;

  /** 검색 결과 개수 힌트 */
  resultCountHint?: number;
}

/**
 * 고급 옵션을 포함한 검색 쿼리를 생성합니다.
 *
 * 향후 더 정교한 검색이 필요할 때 사용할 수 있습니다.
 *
 * @param input - 검증된 입력값
 * @param options - 고급 옵션
 * @returns 검색 쿼리 객체
 */
export function buildAdvancedSearchQuery(
  input: ValidatedColdStartInput,
  options: AdvancedQueryOptions = {}
): SearchQuery {
  const queryParts: string[] = [];

  // 학년이 있으면 추가
  if (options.grade) {
    queryParts.push(`고${options.grade}`);
  } else {
    queryParts.push("고등학교");
  }

  // 기본 쿼리 부분
  queryParts.push(input.subjectCategory);

  if (input.subject) {
    queryParts.push(input.subject);
  }

  if (input.difficulty) {
    queryParts.push(input.difficulty);
  }

  // 콘텐츠 타입 suffix
  const typeSuffix = getContentTypeSuffix(input.contentType);
  queryParts.push(typeSuffix);

  // 추가 키워드
  if (options.additionalKeywords) {
    queryParts.push(options.additionalKeywords);
  }

  // 선호 출판사/플랫폼
  if (options.preferredPublisher) {
    queryParts.push(options.preferredPublisher);
  }

  // 맥락 생성
  const context = buildContext(input);

  return {
    query: queryParts.join(" "),
    context,
  };
}
