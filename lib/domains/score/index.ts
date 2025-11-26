/**
 * Score 도메인 Public API
 */

// 타입 내보내기
export type {
  StudentScore,
  SchoolScore,
  MockScore,
  MockExamType,
  GetSchoolScoresFilter,
  GetMockScoresFilter,
  CreateSchoolScoreInput,
  UpdateSchoolScoreInput,
  CreateMockScoreInput,
  UpdateMockScoreInput,
  ScoreActionResult,
} from "./types";

// 검증 스키마 내보내기
export {
  gradeSchema,
  semesterSchema,
  gradeScoreSchema,
  rawScoreSchema,
  percentileSchema,
  examTypeSchema,
  createSchoolScoreSchema,
  updateSchoolScoreSchema,
  createMockScoreSchema,
  updateMockScoreSchema,
} from "./validation";

export type {
  CreateSchoolScoreFormData,
  UpdateSchoolScoreFormData,
  CreateMockScoreFormData,
  UpdateMockScoreFormData,
} from "./validation";

// 데이터 조회 함수 내보내기 (서버 컴포넌트에서 직접 사용)
export {
  getSchoolScores,
  getMockScores,
  getSchoolScoreById,
  getMockScoreById,
  createSchoolScore,
  updateSchoolScore,
  deleteSchoolScore,
  createMockScore,
  updateMockScore,
  deleteMockScore,
} from "./queries";

// Server Actions 내보내기 (클라이언트 컴포넌트에서 사용)
export {
  // 조회 Actions
  getSchoolScoresAction,
  getMockScoresAction,
  getSchoolScoreByIdAction,
  getMockScoreByIdAction,
  // 내신 성적 Actions
  addSchoolScoreAction,
  updateSchoolScoreAction,
  deleteSchoolScoreAction,
  // 모의고사 성적 Actions
  addMockScoreAction,
  updateMockScoreAction,
  deleteMockScoreAction,
} from "./actions";

