/**
 * Score 도메인 Public API
 *
 * 외부에서는 이 파일을 통해서만 score 도메인에 접근합니다.
 */

// Types
export * from "./types";

// Validation Schemas
export * from "./validation";

// Service (비즈니스 로직)
export * as service from "./service";

// Server Actions
export {
  // 내신 성적 Actions
  getSchoolScoresAction,
  getSchoolScoreByIdAction,
  createSchoolScoreAction,
  updateSchoolScoreAction,
  deleteSchoolScoreAction,
  // 모의고사 성적 Actions
  getMockScoresAction,
  getMockScoreByIdAction,
  createMockScoreAction,
  updateMockScoreAction,
  deleteMockScoreAction,
  // 비즈니스 로직 Actions
  getAverageGradeAction,
  getScoreTrendAction,
} from "./actions";

// Repository는 외부에 노출하지 않음 (service를 통해 접근)
