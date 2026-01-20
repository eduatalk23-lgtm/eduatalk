/**
 * 콜드 스타트 추천 시스템
 *
 * 학생 데이터가 없는 상태에서도 교과/과목/난이도를 선택하면
 * 웹 검색을 통해 적절한 학습 콘텐츠를 추천합니다.
 *
 * 📦 사용 방법:
 *
 * ```typescript
 * import {
 *   validateColdStartInput,
 *   buildSearchQuery,
 * } from "@/lib/domains/plan/llm/actions/coldStart";
 *
 * // 1. 입력 검증
 * const inputResult = validateColdStartInput({
 *   subjectCategory: "수학",
 *   subject: "미적분",
 *   difficulty: "개념",
 *   contentType: "book"
 * });
 *
 * if (!inputResult.success) {
 *   console.error(inputResult.error);
 *   return;
 * }
 *
 * // 2. 쿼리 생성
 * const query = buildSearchQuery(inputResult.validatedInput);
 * console.log(query.query);  // "고등학교 수학 미적분 개념 교재 추천 목차"
 * ```
 */

// ============================================================================
// 타입 내보내기
// ============================================================================

export type {
  // 공통 타입
  SubjectCategory,
  DifficultyLevel,
  ContentType,

  // Task 1: 입력 검증
  ColdStartRawInput,
  ValidateInputResult,
  ValidatedColdStartInput,

  // Task 2: 쿼리 생성
  SearchQuery,

  // Task 3: 웹 검색
  ExecuteSearchResult,

  // Task 4: 결과 파싱
  ChapterInfo,
  ParsedContentItem,
  ParseResultsResult,

  // Task 5: 결과 정렬
  UserPreferences,
  RecommendationItem,
  RankResultsResult,

  // 파이프라인
  ColdStartPipelineResult,
  PersistenceStats,
} from "./types";

// 상수 내보내기
export {
  SUPPORTED_SUBJECT_CATEGORIES,
  SUBJECTS_BY_CATEGORY,
  DIFFICULTY_LEVELS,
  CONTENT_TYPES,
} from "./types";

// ============================================================================
// Task 1: 입력 검증
// ============================================================================

export {
  // 동기 버전 (하드코딩 기반, 하위 호환성)
  validateColdStartInput,
  getSupportedSubjectCategories,
  getSubjectsForCategory,
  getSupportedDifficultyLevels,
  getSupportedContentTypes,
  // 비동기 버전 (DB 기반, 권장)
  validateColdStartInputAsync,
  getSupportedSubjectCategoriesAsync,
  getSubjectsForCategoryAsync,
} from "./validateInput";

// ============================================================================
// 교과/과목 데이터 서비스 (DB 기반)
// ============================================================================

export {
  getSubjectDataFromDB,
  getSubjectsForCategory as getSubjectsForCategoryFromDB,
  isValidSubjectCategory as isValidSubjectCategoryFromDB,
  isValidSubject as isValidSubjectFromDB,
  getSubjectCategoriesForUI,
  getSubjectsForUI,
  resetSubjectDataCache,
  getSupportedSubjectCategoriesSync,
  getSubjectsByCategorySync,
  type SubjectDataResult,
} from "./subjectDataService";

// ============================================================================
// Task 2: 쿼리 생성
// ============================================================================

export {
  buildSearchQuery,
  buildAdvancedSearchQuery,
  type AdvancedQueryOptions,
} from "./buildQuery";

// ============================================================================
// Task 3: 웹 검색 실행
// ============================================================================

export {
  executeWebSearch,
  getMockSearchResult,
} from "./executeSearch";

// ============================================================================
// Task 4: 결과 파싱
// ============================================================================

export {
  parseSearchResults,
  isValidForPlanCreation,
  filterValidItems,
} from "./parseResults";

// ============================================================================
// Task 5: 결과 정렬/필터링
// ============================================================================

export { rankAndFilterResults } from "./rankResults";

// ============================================================================
// 파이프라인 통합
// ============================================================================

export {
  runColdStartPipeline,
  type ColdStartPipelineOptions,
} from "./pipeline";

// ============================================================================
// DB 영속화 (추천 결과 저장)
// ============================================================================

export {
  // 메인 저장 함수
  saveRecommendationsToMasterContent,
  // 타입
  type SaveRecommendationOptions,
  type SavedContentItem,
  type SaveRecommendationsResult,
  type DuplicateCheckResult,
  // 고급 사용자용
  mapToBookInsert,
  mapToLectureInsert,
  checkBookDuplicate,
  checkLectureDuplicate,
} from "./persistence";
