// ============================================
// 생기부 도메인 타입
// DB 테이블 파생 타입 + 서비스 레이어 입력/출력 타입
// ============================================

import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";

// ============================================
// 1. 기록 (Record) — Phase 1a
// ============================================

// Phase 2.5b: content 4분할 확장 필드 (마이그레이션 적용 후 supabase gen types 재생성 시 제거)
interface ContentSeparationFields {
  ai_draft_content?: string | null;
  ai_draft_at?: string | null;
  /** fire-and-forget AI 초안 생성 상태: null=미생성, 'generating'=생성중, 'done'=완료, 'failed'=실패 */
  ai_draft_status?: "generating" | "done" | "failed" | null;
  confirmed_content?: string | null;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
  imported_content?: string | null;
  imported_at?: string | null;
  imported_content_bytes?: number | null;
}

export type RecordSetek = Tables<"student_record_seteks"> & ContentSeparationFields;
export type RecordSetekInsert = TablesInsert<"student_record_seteks"> & ContentSeparationFields;
export type RecordSetekUpdate = TablesUpdate<"student_record_seteks"> & ContentSeparationFields;

export type RecordPersonalSetek = Tables<"student_record_personal_seteks"> & ContentSeparationFields;
export type RecordPersonalSetekInsert = TablesInsert<"student_record_personal_seteks"> & ContentSeparationFields;
export type RecordPersonalSetekUpdate = TablesUpdate<"student_record_personal_seteks"> & ContentSeparationFields;

export type RecordChangche = Tables<"student_record_changche"> & ContentSeparationFields;
export type RecordChangcheInsert = TablesInsert<"student_record_changche"> & ContentSeparationFields;
export type RecordChangcheUpdate = TablesUpdate<"student_record_changche"> & ContentSeparationFields;

export type RecordHaengteuk = Tables<"student_record_haengteuk"> & ContentSeparationFields;
export type RecordHaengteukInsert = TablesInsert<"student_record_haengteuk"> & ContentSeparationFields;
export type RecordHaengteukUpdate = TablesUpdate<"student_record_haengteuk"> & ContentSeparationFields;

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

/** LLM rubricScores → DB Json 타입 변환 (구조적 호환이지만 TS Json 재귀 타입 추론 불가하여 단일 캐스트) */
export function toDbJson(value: unknown): import("@/lib/supabase/database.types").Json {
  return value as import("@/lib/supabase/database.types").Json;
}

export type ActivityTag = Tables<"student_record_activity_tags">;
export type ActivityTagInsert = TablesInsert<"student_record_activity_tags">;

/** ai_generating: fire-and-forget 진단 생성 상태 추적 (마이그레이션 적용 후 gen types 재생성 시 제거) */
interface DiagnosisExtFields {
  ai_generating?: boolean | null;
}
export type Diagnosis = Tables<"student_record_diagnosis"> & DiagnosisExtFields;
export type DiagnosisInsert = TablesInsert<"student_record_diagnosis"> & DiagnosisExtFields;
export type DiagnosisUpdate = TablesUpdate<"student_record_diagnosis"> & DiagnosisExtFields;

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

/** 개별 루브릭 질문 평가 (competency_scores.rubric_scores JSONB) */
export interface RubricScoreEntry {
  /** COMPETENCY_RUBRIC_QUESTIONS[item] 배열 내 0-based 인덱스 */
  questionIndex: number;
  /** 개별 루브릭 등급 */
  grade: CompetencyGrade;
  /** 한 문장 근거 */
  reasoning: string;
}

export type StorylineStrength = "strong" | "moderate" | "weak";

export type RecordType = "setek" | "personal_setek" | "changche" | "haengteuk" | "reading";

export type RoadmapArea =
  | "autonomy" | "club" | "career"
  | "setek" | "personal_setek"
  | "reading" | "course_selection"
  | "competition" | "external"
  | "volunteer" | "general";

export type RoadmapItemStatus = "planning" | "confirmed" | "in_progress" | "completed";

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

/** 진단 탭 데이터 (Phase 6 — AI vs 컨설턴트 비교) */
export interface DiagnosisTabData {
  competencyScores: {
    ai: CompetencyScore[];
    consultant: CompetencyScore[];
  };
  activityTags: ActivityTag[];
  aiDiagnosis: Diagnosis | null;
  consultantDiagnosis: Diagnosis | null;
  strategies: Strategy[];
  courseAdequacy: CourseAdequacyResult | null;
  takenSubjects: string[];
  offeredSubjects: string[] | null;
  targetMajor: string | null;
  targetSubClassificationId: number | null;
  targetSubClassificationName: string | null;
  /** 콘텐츠 품질 점수 (경고 엔진용, optional) */
  qualityScores?: Array<{
    record_type: "setek" | "changche" | "haengteuk" | "personal_setek";
    record_id: string;
    overall_score: number;
    issues: string[];
    feedback: string | null;
  }>;
  /** 4축 합격 진단 프로필 (파이프라인 synthesis 완료 시 존재) */
  fourAxisDiagnosis?: import("@/lib/domains/admission/prediction/profile-diagnosis").FourAxisDiagnosis | null;
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
  /** 융합선택 이수율 (2022 교육과정만 해당, 없으면 null) */
  fusionRate: number | null;
}

// ============================================
// Phase 9.2: 활동 요약서
// ============================================

export type ActivitySummaryStatus = "draft" | "confirmed" | "published";

export interface ActivitySummarySection {
  sectionType:
    | "intro"
    | "subject_setek"
    | "personal_setek"
    | "changche"
    | "haengteuk"
    | "reading"
    | "growth";
  title: string;
  content: string;
  relatedSubjects?: string[];
}

// ============================================
// Phase 9.3: 세특 방향 가이드 (컨설턴트 내부용)
// ============================================

export interface SetekGuideItem {
  subjectName: string;
  keywords: string[];
  competencyFocus: string[];
  direction: string;
  cautions: string;
  teacherPoints: string[];
}

/** Phase 2.5c: DB 영속화된 과목별 세특 방향 가이드 (마이그레이션 적용 후 Tables<> 전환) */
export interface SetekGuideRow {
  id: string;
  tenant_id: string;
  student_id: string;
  school_year: number;
  subject_id: string;
  source: "ai" | "manual";
  status: "draft" | "confirmed";
  direction: string;
  keywords: string[];
  competency_focus: string[];
  cautions: string | null;
  teacher_points: string[];
  overall_direction: string | null;
  model_tier: string | null;
  prompt_version: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type SetekGuideInsert = Omit<SetekGuideRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

/** Server Action 응답 */
export interface StudentRecordActionResult {
  success: boolean;
  error?: string;
  id?: string;
}

// ============================================
// 창체 방향 가이드 (컨설턴트 내부용)
// ============================================

export interface ChangcheGuideItem {
  /** 활동 유형 코드: autonomy | club | career */
  activityType: string;
  /** 활동 유형 레이블: 자율 | 동아리 | 진로 */
  activityLabel: string;
  keywords: string[];
  competencyFocus: string[];
  direction: string;
  cautions: string;
  teacherPoints: string[];
}

/** DB 영속화된 활동유형별 창체 방향 가이드 */
export interface ChangcheGuideRow {
  id: string;
  tenant_id: string;
  student_id: string;
  school_year: number;
  activity_type: string;
  source: "ai" | "manual";
  status: "draft" | "confirmed";
  direction: string;
  keywords: string[];
  competency_focus: string[];
  cautions: string | null;
  teacher_points: string[];
  overall_direction: string | null;
  model_tier: string | null;
  prompt_version: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 행특 방향 가이드 (컨설턴트 내부용)
// ============================================

export interface HaengteukGuideItem {
  keywords: string[];
  competencyFocus: string[];
  direction: string;
  cautions: string;
  teacherPoints: string[];
  evaluationItems?: Array<{ item: string; score: string; reasoning: string }>;
}

/** DB 영속화된 행특 방향 가이드 */
export interface HaengteukGuideRow {
  id: string;
  tenant_id: string;
  student_id: string;
  school_year: number;
  source: "ai" | "manual";
  status: "draft" | "confirmed";
  direction: string;
  keywords: string[];
  competency_focus: string[];
  cautions: string | null;
  teacher_points: string[];
  evaluation_items: Array<{ item: string; score: string; reasoning: string }> | null;
  overall_direction: string | null;
  model_tier: string | null;
  prompt_version: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
