/**
 * 공통 데이터 로더 모듈
 *
 * recommendContent.ts와 enhancedRecommendContent.ts에서 공유하는
 * 데이터 로드 함수들을 제공합니다.
 *
 * @module loaders
 */

export type { SupabaseClient } from "./types";
export { loadStudentProfile, loadScoreInfo } from "./studentLoader";
export { loadLearningPattern } from "./patternLoader";
export { loadOwnedContents, loadCandidateContents } from "./contentLoader";
