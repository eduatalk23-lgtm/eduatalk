/**
 * Score 도메인 Public API
 *
 * 외부에서는 이 파일을 통해서만 score 도메인에 접근합니다.
 *
 * IMPORTANT: service와 repository는 서버 전용 코드를 사용하므로
 * 클라이언트 컴포넌트에서 직접 import할 수 없습니다.
 * 서버 컴포넌트에서만 직접 import 필요: import * as service from "@/lib/domains/score/service"
 */

// Types (safe for client)
export * from "./types";

// Validation Schemas (safe for client)
export * from "./validation";

// Server Actions (CRUD 작업용 - 클라이언트 컴포넌트에서 사용)
export {
  // 내신 성적 Actions
  createInternalScore,
  updateInternalScore,
  deleteInternalScore,
  deleteScore,
  createInternalScoresBatch,
  createMockScoresBatch,
  // 모의고사 성적 Actions
  getMockScoresAction,
  getMockScoreByIdAction,
  createMockScoreAction,
  updateMockScoreAction,
  deleteMockScoreAction,
  // 비즈니스 로직 Actions
  getAverageGradeAction,
  getScoreTrendAction,
  // Student Mock Score Actions (FormData-based with redirect)
  addMockScore,
  updateMockScoreFormAction,
  deleteMockScoreFormAction,
} from "./actions";
