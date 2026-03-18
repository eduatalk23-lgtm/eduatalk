// ============================================
// 생기부 도메인 Public API
//
// 클라이언트에서 안전하게 import 가능한 것만 export.
// repository, service는 서버 전용 — 직접 import하지 말 것.
// ============================================

// 타입 (client-safe)
export type {
  // DB 파생 타입
  RecordSetek, RecordSetekInsert, RecordSetekUpdate,
  RecordPersonalSetek, RecordPersonalSetekInsert,
  RecordChangche, RecordChangcheInsert,
  RecordHaengteuk, RecordHaengteukInsert,
  RecordReading, RecordReadingInsert,
  RecordAttendance, RecordAttendanceInsert,
  RecordApplication, RecordApplicationInsert,
  RecordAward, RecordAwardInsert,
  RecordVolunteer, RecordVolunteerInsert,
  RecordDisciplinary, RecordDisciplinaryInsert,
  Storyline, StorylineInsert,
  StorylineLink, StorylineLinkInsert,
  RoadmapItem, RoadmapItemInsert,
  ReadingLink, ReadingLinkInsert,
  InterviewQuestion, InterviewQuestionInsert,
  MinScoreTarget, MinScoreTargetInsert,
  MinScoreSimulation, MinScoreSimulationInsert,
  SchoolProfile, SchoolProfileInsert,
  SchoolOfferedSubject, SchoolOfferedSubjectInsert,
  SubjectPair,
  // 상수 타입
  RecordStatus, ChangcheActivityType, ApplicationRound, ApplicationResult,
  CompetencyArea, CompetencyItemCode, CompetencyGrade,
  StorylineStrength, RecordType, RoadmapArea, SchoolCategory,
  InterviewQuestionType,
  // Phase 5: 진단 타입
  CompetencyScore, CompetencyScoreInsert,
  ActivityTag, ActivityTagInsert,
  Diagnosis, DiagnosisInsert, DiagnosisUpdate,
  Strategy, StrategyInsert, StrategyUpdate,
  TagEvaluation, StrategyTargetArea, StrategyPriority, StrategyStatus,
  CompetencyScope, DiagnosisSource, ActivityTagStatus, DiagnosisStatus,
  // 서비스 타입
  InterviewConflict, MinScoreSimulationResult, MinScoreCriteria,
  NormalizedGrade, NeisValidationResult,
  RecordTabData, StrategyTabData, StorylineTabData,
  DiagnosisTabData, CourseAdequacyResult,
  StudentRecordActionResult,
} from "./types";

// 상수 (client-safe)
export {
  CHAR_LIMITS, getCharLimit,
  COMPETENCY_ITEMS, COMPETENCY_RUBRIC_QUESTIONS,
  COMPETENCY_GRADE_RUBRICS, GRADE_CONVERSION_TABLE,
  MAJOR_RECOMMENDED_COURSES,
  GRADE_9_TO_5_MAP, GRADE_5_TO_9_MAP,
  COMPETENCY_AREA_LABELS, CHANGCHE_TYPE_LABELS,
  APPLICATION_ROUND_LABELS, SCHOOL_CATEGORY_LABELS,
} from "./constants";

// 검증 (client-safe — 클라이언트 바이트 카운터에서 사용)
export {
  countNeisBytes,
  detectNeisInvalidChars,
  validateNeisContent,
  normalizeLineBreaks,
} from "./validation";

// 순수 계산 엔진 (client-safe)
export {
  determineGradeSystem,
  grade9To5, grade5To9, grade5To9Range,
  normalizeGrade,
} from "./grade-normalizer";

export {
  simulateMinScore,
  analyzeSubjectImpact,
} from "./min-score-simulator";

export {
  checkInterviewConflicts,
} from "./interview-conflict-checker";

export {
  calculateCourseAdequacy,
} from "./course-adequacy";
