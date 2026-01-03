/**
 * Analysis Domain
 *
 * Risk Index 분석 및 학습 패턴 분석 기능 제공
 *
 * Phase 4: 학습 패턴 예측 및 조기 경고
 * - 4.1: 성과 예측 모델
 * - 4.2: 조기 경고 시스템
 * - 4.3: 적응형 리스케줄링
 */

// ============================================================================
// Types
// ============================================================================

export type {
  ScoreRow,
  ProgressRow,
  PlanRow,
  ContentRow,
  SubjectRiskAnalysis,
} from "./types";

// ============================================================================
// Utils
// ============================================================================

export {
  fetchAllScores,
  fetchProgressMap,
  fetchPlansForSubject,
  calculateRiskIndex,
  calculateAllRiskIndices,
  saveRiskAnalysis,
} from "./utils";

// ============================================================================
// Actions
// ============================================================================

export { recalculateRiskIndex } from "./actions";
export {
  getStudentScoreProfile,
  type ScoreTrend,
  type SubjectScoreInfo,
  type StudentScoreProfile,
} from "./actions";

// ============================================================================
// Learning Pattern Analysis Service
// ============================================================================

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

// ============================================================================
// Phase 4.1: Prediction Service (성과 예측 모델)
// ============================================================================

export {
  PredictionService,
  predictWeeklyPerformance,
  predictBurnoutRisk,
  predictSubjectStruggle,
  runAllPredictions,
} from "./services/predictionService";

export type {
  PredictionType,
  TrendDirection,
  ContributingFactor,
  RecommendedIntervention,
  PredictionFeatures,
  PredictionResult,
  WeeklyPerformancePrediction,
  SubjectStrugglePrediction,
  BurnoutRiskPrediction,
} from "./services/predictionService";

// ============================================================================
// Phase 4.2: Early Warning Service (조기 경고 시스템)
// ============================================================================

export {
  EarlyWarningService,
  detectWarnings,
  getUnresolvedWarnings,
  acknowledgeWarning,
  resolveWarning,
  getWarningStats,
  WARNING_TYPE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
} from "./services/earlyWarningService";

export type {
  WarningType,
  WarningSeverity,
  WarningActionType,
  WarningContextData,
  RecommendedAction,
  EarlyWarning,
  WarningTriggerCondition,
  WarningCheckData,
  DetectionResult,
} from "./services/earlyWarningService";

// ============================================================================
// Phase 4.3: Adaptive Rescheduling Service (적응형 리스케줄링)
// ============================================================================

export {
  AdaptiveReschedulingService,
  analyzeAndRecommendReschedule,
  autoRescheduleIncomplete,
  applyRescheduleRecommendation,
  RESCHEDULE_REASON_LABELS,
  IMPACT_LABELS,
  DAY_NAMES,
  DAY_NAMES_EN,
} from "./services/adaptiveReschedulingService";

export type {
  RescheduleReasonType,
  RescheduleRecommendation,
  RescheduleAnalysis,
  AutoRescheduleResult,
} from "./services/adaptiveReschedulingService";
