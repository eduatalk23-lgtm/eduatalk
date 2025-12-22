/**
 * Score Domain Actions
 *
 * Server Actions for score management.
 */

// Internal Score Actions
export {
  createInternalScore,
  updateInternalScore,
  deleteInternalScore,
  deleteScore,
  createInternalScoresBatch,
} from "./core";

// Mock Score Actions
export {
  getMockScoresAction,
  getMockScoreByIdAction,
  createMockScoreAction,
  updateMockScoreAction,
  deleteMockScoreAction,
  createMockScoresBatch,
} from "./core";

// Business Logic Actions
export {
  getAverageGradeAction,
  getScoreTrendAction,
} from "./core";

// Student Mock Score Actions (FormData-based with redirect)
export {
  addMockScore,
  updateMockScoreFormAction,
  deleteMockScoreFormAction,
} from "./student";
