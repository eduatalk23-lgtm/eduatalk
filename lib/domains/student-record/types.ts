// ============================================
// 생기부 도메인 타입
// DB 테이블 파생 타입 + 서비스 레이어 입력/출력 타입
// ============================================

import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";

// ============================================
// 1. 기록 (Record) — Phase 1a
// ============================================

export type RecordSetek = Tables<"student_record_seteks">;
export type RecordSetekInsert = TablesInsert<"student_record_seteks">;
export type RecordSetekUpdate = TablesUpdate<"student_record_seteks">;

export type RecordPersonalSetek = Tables<"student_record_personal_seteks">;
export type RecordPersonalSetekInsert = TablesInsert<"student_record_personal_seteks">;
export type RecordPersonalSetekUpdate = TablesUpdate<"student_record_personal_seteks">;

export type RecordChangche = Tables<"student_record_changche">;
export type RecordChangcheInsert = TablesInsert<"student_record_changche">;
export type RecordChangcheUpdate = TablesUpdate<"student_record_changche">;

export type RecordHaengteuk = Tables<"student_record_haengteuk">;
export type RecordHaengteukInsert = TablesInsert<"student_record_haengteuk">;
export type RecordHaengteukUpdate = TablesUpdate<"student_record_haengteuk">;

export type RecordReading = Tables<"student_record_reading">;
export type RecordReadingInsert = TablesInsert<"student_record_reading">;
export type RecordReadingUpdate = TablesUpdate<"student_record_reading">;

export type SubjectPair = Tables<"student_record_subject_pairs">;

// ============================================
// 2. 보조 기록 (Supplementary) — Phase 1b
// ============================================

export type RecordAttendance = Tables<"student_record_attendance">;
export type RecordAttendanceInsert = TablesInsert<"student_record_attendance">;
export type RecordAttendanceUpdate = TablesUpdate<"student_record_attendance">;

export type RecordApplication = Tables<"student_record_applications">;
export type RecordApplicationInsert = TablesInsert<"student_record_applications">;
export type RecordApplicationUpdate = TablesUpdate<"student_record_applications">;

export type RecordAward = Tables<"student_record_awards">;
export type RecordAwardInsert = TablesInsert<"student_record_awards">;

export type RecordVolunteer = Tables<"student_record_volunteer">;
export type RecordVolunteerInsert = TablesInsert<"student_record_volunteer">;

export type RecordDisciplinary = Tables<"student_record_disciplinary">;
export type RecordDisciplinaryInsert = TablesInsert<"student_record_disciplinary">;

// ============================================
// 3. 확장 기능 — Phase 1c
// ============================================

export type Storyline = Tables<"student_record_storylines">;
export type StorylineInsert = TablesInsert<"student_record_storylines">;
export type StorylineUpdate = TablesUpdate<"student_record_storylines">;

export type StorylineLink = Tables<"student_record_storyline_links">;
export type StorylineLinkInsert = TablesInsert<"student_record_storyline_links">;

export type RoadmapItem = Tables<"student_record_roadmap_items">;
export type RoadmapItemInsert = TablesInsert<"student_record_roadmap_items">;
export type RoadmapItemUpdate = TablesUpdate<"student_record_roadmap_items">;

export type ReadingLink = Tables<"student_record_reading_links">;
export type ReadingLinkInsert = TablesInsert<"student_record_reading_links">;

export type InterviewQuestion = Tables<"student_record_interview_questions">;
export type InterviewQuestionInsert = TablesInsert<"student_record_interview_questions">;
export type InterviewQuestionUpdate = TablesUpdate<"student_record_interview_questions">;

export type MinScoreTarget = Tables<"student_record_min_score_targets">;
export type MinScoreTargetInsert = TablesInsert<"student_record_min_score_targets">;
export type MinScoreTargetUpdate = TablesUpdate<"student_record_min_score_targets">;

export type MinScoreSimulation = Tables<"student_record_min_score_simulations">;
export type MinScoreSimulationInsert = TablesInsert<"student_record_min_score_simulations">;

export type SchoolProfile = Tables<"school_profiles">;
export type SchoolProfileInsert = TablesInsert<"school_profiles">;
export type SchoolProfileUpdate = TablesUpdate<"school_profiles">;

export type SchoolOfferedSubject = Tables<"school_offered_subjects">;
export type SchoolOfferedSubjectInsert = TablesInsert<"school_offered_subjects">;

// ============================================
// 3b. 진단 기능 — Phase 5
// ============================================

export type CompetencyScore = Tables<"student_record_competency_scores">;
export type CompetencyScoreInsert = TablesInsert<"student_record_competency_scores">;
export type CompetencyScoreUpdate = TablesUpdate<"student_record_competency_scores">;

export type ActivityTag = Tables<"student_record_activity_tags">;
export type ActivityTagInsert = TablesInsert<"student_record_activity_tags">;

export type Diagnosis = Tables<"student_record_diagnosis">;
export type DiagnosisInsert = TablesInsert<"student_record_diagnosis">;
export type DiagnosisUpdate = TablesUpdate<"student_record_diagnosis">;

export type Strategy = Tables<"student_record_strategies">;
export type StrategyInsert = TablesInsert<"student_record_strategies">;
export type StrategyUpdate = TablesUpdate<"student_record_strategies">;

// ============================================
// 4. 상수 타입
// ============================================

export type RecordStatus = "draft" | "review" | "final";

export type ChangcheActivityType = "autonomy" | "club" | "career";

export type ApplicationRound =
  | "early_comprehensive" | "early_subject" | "early_essay"
  | "early_practical" | "early_special" | "early_other"
  | "regular_ga" | "regular_na" | "regular_da"
  | "additional" | "special_quota";

export type ApplicationResult = "pending" | "accepted" | "waitlisted" | "rejected" | "registered";

export type CompetencyArea = "academic" | "career" | "community";

export type CompetencyItemCode =
  | "academic_achievement" | "academic_attitude" | "academic_inquiry"
  | "career_course_effort" | "career_course_achievement" | "career_exploration"
  | "community_collaboration" | "community_caring"
  | "community_integrity" | "community_leadership";

export type CompetencyGrade = "A+" | "A-" | "B+" | "B" | "B-" | "C";

export type StorylineStrength = "strong" | "moderate" | "weak";

export type RecordType = "setek" | "personal_setek" | "changche" | "haengteuk" | "reading";

export type RoadmapArea =
  | "autonomy" | "club" | "career"
  | "setek" | "personal_setek"
  | "reading" | "course_selection"
  | "competition" | "external"
  | "volunteer" | "general";

export type SchoolCategory =
  | "general" | "autonomous_private" | "autonomous_public"
  | "science" | "foreign_lang" | "international"
  | "art" | "sports" | "meister" | "specialized" | "other";

export type InterviewQuestionType = "factual" | "reasoning" | "application" | "value" | "controversial";

export type TagEvaluation = "positive" | "negative" | "needs_review";

export type StrategyTargetArea =
  | "autonomy" | "club" | "career"
  | "setek" | "personal_setek" | "reading"
  | "haengteuk" | "score" | "general";

export type StrategyPriority = "critical" | "high" | "medium" | "low";

export type StrategyStatus = "planned" | "in_progress" | "done";

export type CompetencyScope = "yearly" | "cumulative";

export type DiagnosisSource = "ai" | "manual";

export type ActivityTagStatus = "suggested" | "confirmed";

export type DiagnosisStatus = "draft" | "confirmed";

// ============================================
// 5. 서비스 레이어 타입
// ============================================

/** 면접일 겹침 정보 */
export interface InterviewConflict {
  applicationId1: string;
  applicationId2: string;
  university1: string;
  university2: string;
  conflictDate: string;
  severity: "critical" | "warning";
}

/** 수능최저 시뮬레이션 결과 */
export interface MinScoreSimulationResult {
  targetId: string;
  universityName: string;
  department: string;
  isMet: boolean;
  actualGrades: Record<string, number>;
  gradeSum: number | null;
  gap: number;
  bottleneckSubjects: string[];
  whatIf: Record<string, { isMet: boolean; newSum: number }>;
}

/** 수능최저 조건 (criteria JSONB 구조) */
export interface MinScoreCriteria {
  type: "grade_sum" | "single_grade" | "none";
  subjects: string[];
  count: number;
  maxSum: number;
  additional: {
    subject: string;
    maxGrade?: number;
    required?: string[];
  }[];
}

/** 등급 정규화 결과 */
export interface NormalizedGrade {
  original: string;
  gradeSystem: 5 | 9;
  normalizedTo9: number | null;
  normalizedTo5: string | null;
  percentileRange: [number, number];
  displayLabel: string;
}

/** NEIS 바이트 검증 결과 */
export interface NeisValidationResult {
  chars: number;
  bytes: number;
  charLimit: number;
  byteLimit: number;
  isOverChar: boolean;
  isOverByte: boolean;
  /** NEIS 기준 초과 여부 (= isOverByte). 바이트가 실제 제한 기준. */
  isOver: boolean;
  invalidChars: { char: string; position: number }[];
}

/** 탭별 lazy loading 데이터 타입 */
export interface RecordTabData {
  seteks: RecordSetek[];
  personalSeteks: RecordPersonalSetek[];
  changche: RecordChangche[];
  haengteuk: RecordHaengteuk | null;
  readings: RecordReading[];
  schoolAttendance: RecordAttendance | null;
}

export interface StrategyTabData {
  applications: RecordApplication[];
  minScoreTargets: MinScoreTarget[];
  minScoreSimulations: MinScoreSimulation[];
  interviewConflicts: InterviewConflict[];
}

export interface StorylineTabData {
  storylines: Storyline[];
  roadmapItems: RoadmapItem[];
}

/** 진단 탭 데이터 (Phase 6) */
export interface DiagnosisTabData {
  competencyScores: CompetencyScore[];
  activityTags: ActivityTag[];
  diagnosis: Diagnosis | null;
  strategies: Strategy[];
  courseAdequacy: CourseAdequacyResult | null;
  /** 학생 이수 과목명 (교과이수적합도 클라이언트 재계산용) */
  takenSubjects: string[];
  /** 학교 개설 과목명 (null이면 필터링 안 함) */
  offeredSubjects: string[] | null;
  /** 학생 목표 전공 계열 */
  targetMajor: string | null;
}

/** 교과 이수 적합도 결과 */
export interface CourseAdequacyResult {
  /** 적합도 점수 (0~100) */
  score: number;
  /** 전공 계열명 */
  majorCategory: string;
  /** 추천 과목 총 수 */
  totalRecommended: number;
  /** 이수 가능한 추천 과목 수 (학교 개설된 것만) */
  totalAvailable: number;
  /** 이수한 추천 과목 */
  taken: string[];
  /** 미이수 추천 과목 (이수 가능하나 안 한 것) */
  notTaken: string[];
  /** 학교 미개설 과목 (학생 탓 아님) */
  notOffered: string[];
  /** 일반선택 이수율 */
  generalRate: number;
  /** 진로선택 이수율 */
  careerRate: number;
}

/** Server Action 응답 */
export interface StudentRecordActionResult {
  success: boolean;
  error?: string;
  id?: string;
}
