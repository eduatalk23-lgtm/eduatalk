/**
 * Analysis Domain
 *
 * Risk Index 분석 관련 기능 제공
 */

// Types
export type {
  ScoreRow,
  ProgressRow,
  PlanRow,
  ContentRow,
  SubjectRiskAnalysis,
} from "./types";

// Utils
export {
  fetchAllScores,
  fetchProgressMap,
  fetchPlansForSubject,
  calculateRiskIndex,
  calculateAllRiskIndices,
  saveRiskAnalysis,
} from "./utils";

// Actions
export { recalculateRiskIndex } from "./actions";
export {
  getStudentScoreProfile,
  type ScoreTrend,
  type SubjectScoreInfo,
  type StudentScoreProfile,
} from "./actions";

// Learning Pattern Analysis Service
export {
  calculatePreferredStudyTimes,
  analyzeStrongWeakDays,
  findFrequentlyIncompleteSubjects,
  analyzeLearningPatterns,
  saveLearningPatterns,
  getTimeSlotLabel,
  getDayLabel,
} from "./services/learningPatternService";

export type {
  StudyTimeSlot,
  StudyTimeAnalysis,
  DayAnalysis,
  SubjectCompletionAnalysis,
  LearningPatternResult,
} from "./services/learningPatternService";
