// ============================================
// 생기부 도메인 — 서비스/UI 인터페이스 타입
// ============================================

import type { CompetencyGrade } from "./enums";
import type {
  RecordSetek, RecordPersonalSetek, RecordChangche, RecordHaengteuk,
  RecordReading, RecordAttendance, RecordApplication,
  MinScoreTarget, MinScoreSimulation, MinScoreSimulationInsert,
  Storyline, RoadmapItem, CompetencyScore, ActivityTag,
  Diagnosis, Strategy,
} from "./db-models";

// ── 루브릭 ──

/** 개별 루브릭 질문 평가 (competency_scores.rubric_scores JSONB) */
export interface RubricScoreEntry {
  questionIndex: number;
  grade: CompetencyGrade;
  reasoning: string;
}

// ── 서비스 I/O ──

export interface InterviewConflict {
  applicationId1: string;
  applicationId2: string;
  university1: string;
  university2: string;
  conflictDate: string;
  severity: "critical" | "warning";
}

export interface MinScoreSimulationResult {
  targetId: string;
  universityName: string;
  department: string;
  isMet: boolean;
  actualGrades: Record<string, number>;
  gradeSum: number | null;
  gap: number | null;
  bottleneckSubjects: string[];
  whatIf: Record<string, { isMet: boolean; newSum: number }>;
}

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

export interface NormalizedGrade {
  original: string;
  gradeSystem: 5 | 9;
  normalizedTo9: number | null;
  normalizedTo5: string | null;
  percentileRange: [number, number];
  displayLabel: string;
}

export interface NeisValidationResult {
  chars: number;
  bytes: number;
  charLimit: number;
  byteLimit: number;
  isOverChar: boolean;
  isOverByte: boolean;
  isOver: boolean;
  invalidChars: { char: string; position: number }[];
}

// ── 탭 데이터 ──

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
  careerField: string | null;
  targetMajor: string | null;
  targetSubClassificationId: number | null;
  targetSubClassificationName: string | null;
  qualityScores?: Array<{
    record_type: "setek" | "changche" | "haengteuk" | "personal_setek";
    record_id: string;
    overall_score: number;
    issues: string[];
    feedback: string | null;
    specificity: number;
    coherence: number;
    depth: number;
    grammar: number;
    scientific_validity: number | null;
  }>;
  /** 학기별 차트 보정용: 내신 과목별 학기 정보 */
  scoreSemesterHints?: Array<{ grade: number | null; semester: number | null; subject_id: string | null }>;
  fourAxisDiagnosis?: import("@/lib/domains/admission/prediction/profile-diagnosis").FourAxisDiagnosis | null;
  projectedData?: {
    competencyScores: CompetencyScore[];
    edges: import("../repository/edge-repository").PersistedEdge[];
    leveling: import("../leveling/types").LevelingResult | null;
    designGrades: number[];
    contentQuality: Array<{
      record_type: string;
      overall_score: number;
      issues: string[];
      feedback: string | null;
    }>;
    /**
     * L4-E: 서사 기반 설계 우선순위.
     * 진단 탭은 record 단위 컨텍스트가 없으므로 `prioritizedWeaknesses`만 채워진다
     * (ReportClient 경로와 달리 `recordPriorityOrder`는 항상 빈 배열).
     */
    narrativeContext?: import("@/lib/domains/record-analysis/pipeline/narrative-context").NarrativeContext;
  };
}

export interface CourseAdequacyResult {
  score: number;
  majorCategory: string;
  /** 교육과정 연도 (2015 또는 2022) — 추천교과 상수 선택에 사용 */
  curriculumYear?: number;
  totalRecommended: number;
  totalAvailable: number;
  taken: string[];
  notTaken: string[];
  notOffered: string[];
  generalRate: number;
  careerRate: number;
  fusionRate: number | null;
}

// ── 활동 요약서 ──

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
  /**
   * 섹션 주제어 3~6개. 명사/명사구 토큰 형태(문장 파편 금지).
   * cross-run feedback에서 직전 실행이 포착한 축을 다음 실행에 힌트로 주입할 때 사용.
   */
  keywords?: string[];
}

// ── 가이드 타입 ──

export interface SetekGuideItem {
  subjectName: string;
  keywords: string[];
  competencyFocus: string[];
  direction: string;
  cautions: string;
  teacherPoints: string[];
}

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
  is_stale: boolean;
  stale_reason: string | null;
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

export interface ChangcheGuideItem {
  activityType: string;
  activityLabel: string;
  keywords: string[];
  competencyFocus: string[];
  direction: string;
  cautions: string;
  teacherPoints: string[];
}

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
  is_stale: boolean;
  stale_reason: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HaengteukGuideItem {
  keywords: string[];
  competencyFocus: string[];
  direction: string;
  cautions: string;
  teacherPoints: string[];
  evaluationItems?: Array<{ item: string; score: string; reasoning: string }>;
}

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
  is_stale: boolean;
  stale_reason: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Overview (Phase 3: 서버 사이드 경고 + 진행률) ──

export interface ProgressCounts {
  recordFilled: number;
  recordTotal: number;
  diagnosisFilled: number;
  designFilled: number;
  strategyFilled: number;
}

export interface StudentRecordOverview {
  warnings: import("../warnings/types").RecordWarning[];
  progressCounts: ProgressCounts;
}

// ── Action 응답 ──

import type { ActionResponse } from "@/lib/types/actionResponse";
/** @deprecated 점진적으로 ActionResponse<T>로 전환 중 */
export type StudentRecordActionResult = ActionResponse<{ id?: string }>;
