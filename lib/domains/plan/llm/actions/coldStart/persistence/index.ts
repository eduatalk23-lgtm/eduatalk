/**
 * 콜드 스타트 추천 결과 영속화 (DB 저장) 모듈
 *
 * 추천 파이프라인에서 생성된 콘텐츠를 master_books / master_lectures 테이블에
 * 저장하여 데이터 축적 및 재활용을 가능하게 합니다.
 *
 * @example
 * ```typescript
 * import {
 *   saveRecommendationsToMasterContent,
 * } from "@/lib/domains/plan/llm/actions/coldStart/persistence";
 *
 * // 파이프라인 실행 후 결과 저장
 * const saveResult = await saveRecommendationsToMasterContent(
 *   recommendations,
 *   {
 *     tenantId: null,       // 공유 카탈로그
 *     subjectCategory: '수학',
 *     subject: '미적분',
 *     difficultyLevel: '개념',
 *   }
 * );
 *
 * console.log(`새로 저장: ${saveResult.savedItems.filter(i => i.isNew).length}개`);
 * console.log(`중복 스킵: ${saveResult.skippedDuplicates}개`);
 * ```
 */

// ============================================================================
// 타입 내보내기
// ============================================================================

export type {
  SaveRecommendationOptions,
  SavedContentItem,
  SaveRecommendationsResult,
  DuplicateCheckResult,
  ColdStartBookInsert,
  ColdStartLectureInsert,
  ChapterAnalysisData,
  // 강사 관련 타입
  ColdStartInstructorInsert,
  SavedInstructorItem,
  SaveInstructorsResult,
} from "./types";

// ============================================================================
// 메인 저장 함수
// ============================================================================

export { saveRecommendationsToMasterContent } from "./saveRecommendations";

// ============================================================================
// 매퍼 함수 (고급 사용자용)
// ============================================================================

export { mapToBookInsert, mapToLectureInsert } from "./mappers";

// ============================================================================
// 중복 검사 함수 (고급 사용자용)
// ============================================================================

export { checkBookDuplicate, checkLectureDuplicate } from "./duplicateCheck";

// ============================================================================
// 맞춤 추천 조회 함수
// ============================================================================

export {
  getPersonalizedRecommendations,
  getTopRatedContent,
  getContentForStudentType,
  getRecommendationMetadataById,
  getRecommendationReasons,
  // 어드민 교재 추천 관리
  getBookRecommendations,
  getBookRecommendationById,
  searchBookRecommendations,
  getAvailablePublishersForRecommendations,
  // 어드민 강의 추천 관리
  getLectureRecommendations,
  getLectureRecommendationById,
  searchLectureRecommendations,
  getAvailablePlatformsForRecommendations,
} from "./recommendationQueries";

export type {
  PersonalizedRecommendationOptions,
  RecommendedBook,
  RecommendedLecture,
  PersonalizedRecommendationResult,
  // 어드민 교재 추천 관리
  BookRecommendationQueryOptions,
  BookRecommendationDetail,
  BookRecommendationResult,
  // 어드민 강의 추천 관리
  LectureRecommendationQueryOptions,
  LectureRecommendationDetail,
  LectureRecommendationResult,
} from "./recommendationQueries";

// ============================================================================
// 강사 저장 함수
// ============================================================================

export { saveInstructorsAndLinkLectures } from "./instructorPersistence";

// ============================================================================
// 강사 조회/추천 함수
// ============================================================================

export {
  getInstructors,
  getInstructorById,
  getInstructorWithLectures,
  getInstructorsByPlatform,
  getTopRatedInstructors,
  getInstructorsForStudentType,
  getInstructorsByStyle,
  searchInstructors,
  getInstructorRecommendationReasons,
  getAvailablePlatforms,
  getInstructorCountBySubject,
} from "./instructorQueries";

export type {
  InstructorQueryOptions,
  InstructorResult,
  InstructorMetadata,
  InstructorWithLectures,
  InstructorRecommendationResult,
} from "./instructorQueries";
