// ============================================
// 생기부 도메인 타입 — Re-export 허브
// 기존 import 경로 100% 호환을 위해 모든 타입을 재내보냄
// 실제 정의는 types/ 하위 파일에 위치
// ============================================

// DB 테이블 파생 타입 + 확장 인터페이스 + toDbJson
export type { ContentSeparationFields, DiagnosisExtFields } from "./types/db-models";
export {
  toDbJson,
} from "./types/db-models";
export type {
  RecordSetek, RecordSetekInsert, RecordSetekUpdate,
  RecordPersonalSetek, RecordPersonalSetekInsert, RecordPersonalSetekUpdate,
  RecordChangche, RecordChangcheInsert, RecordChangcheUpdate,
  RecordHaengteuk, RecordHaengteukInsert, RecordHaengteukUpdate,
  RecordReading, RecordReadingInsert, RecordReadingUpdate,
  SubjectPair,
  RecordAttendance, RecordAttendanceInsert, RecordAttendanceUpdate,
  RecordApplication, RecordApplicationInsert, RecordApplicationUpdate,
  RecordAward, RecordAwardInsert,
  RecordVolunteer, RecordVolunteerInsert,
  RecordDisciplinary, RecordDisciplinaryInsert,
  Storyline, StorylineInsert, StorylineUpdate,
  StorylineLink, StorylineLinkInsert,
  RoadmapItem, RoadmapItemInsert, RoadmapItemUpdate,
  ReadingLink, ReadingLinkInsert,
  InterviewQuestion, InterviewQuestionInsert, InterviewQuestionUpdate,
  MinScoreTarget, MinScoreTargetInsert, MinScoreTargetUpdate,
  MinScoreSimulation, MinScoreSimulationInsert,
  SchoolProfile, SchoolProfileInsert, SchoolProfileUpdate,
  SchoolOfferedSubject, SchoolOfferedSubjectInsert,
  CompetencyScore, CompetencyScoreInsert, CompetencyScoreUpdate,
  ActivityTag, ActivityTagInsert,
  Diagnosis, DiagnosisInsert, DiagnosisUpdate,
  Strategy, StrategyInsert, StrategyUpdate,
} from "./types/db-models";

// 상수 유니온 타입
export type {
  RecordStatus, ChangcheActivityType, ApplicationRound, ApplicationResult,
  CompetencyArea, CompetencyItemCode, CompetencyGrade,
  StorylineStrength, RecordType, RoadmapArea, RoadmapItemStatus,
  SchoolCategory, InterviewQuestionType, TagEvaluation,
  StrategyTargetArea, StrategyPriority, StrategyStatus,
  CompetencyScope, DiagnosisSource, ActivityTagStatus, DiagnosisStatus, TagContext,
  ActivitySummaryStatus,
} from "./types/enums";

// 서비스/UI 인터페이스 타입
export type {
  RubricScoreEntry,
  InterviewConflict, MinScoreSimulationResult, MinScoreCriteria,
  NormalizedGrade, NeisValidationResult,
  RecordTabData, StrategyTabData, StorylineTabData, DiagnosisTabData,
  CourseAdequacyResult,
  ActivitySummarySection,
  SetekGuideItem, SetekGuideRow, SetekGuideInsert,
  ChangcheGuideItem, ChangcheGuideRow,
  HaengteukGuideItem, HaengteukGuideRow,
  ProgressCounts, StudentRecordOverview,
  StudentRecordActionResult,
} from "./types/service-types";
