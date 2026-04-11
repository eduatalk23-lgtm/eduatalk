// ============================================
// 생기부 도메인 — DB 테이블 파생 타입
// Tables / TablesInsert / TablesUpdate 쌍
// ============================================

import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";

// ── 콘텐츠 4분할 확장 필드 ──

/** Phase 2.5b: content 4분할 확장 필드 (마이그레이션 적용 후 supabase gen types 재생성 시 제거) */
export interface ContentSeparationFields {
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

/** ai_generating: fire-and-forget 진단 생성 상태 추적 (마이그레이션 적용 후 gen types 재생성 시 제거) */
export interface DiagnosisExtFields {
  ai_generating?: boolean | null;
}

/** Phase 0 증거 체인: activity_tags 확장 필드 (마이그레이션 적용 후 gen types 재생성 시 제거) */
export interface ActivityTagEvidenceFields {
  section_type?: string | null;
  highlight_phrase?: string | null;
}

/** Phase 0 증거 체인: competency_scores 확장 필드 (마이그레이션 적용 후 gen types 재생성 시 제거) */
export interface CompetencyScoreEvidenceFields {
  source_tag_ids?: string[] | null;
  source_record_ids?: string[] | null;
}

/** Phase 0 증거 체인: content_quality 확장 필드 (마이그레이션 적용 후 gen types 재생성 시 제거) */
export interface ContentQualityEvidenceFields {
  issue_tag_ids?: string[] | null;
}

// ── 1. 기록 (Record) — Phase 1a ──

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

// ── 2. 보조 기록 (Supplementary) — Phase 1b ──

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

// ── 3. 확장 기능 — Phase 1c ──

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

// ── 3b. 진단 기능 — Phase 5 ──

export type CompetencyScore = Tables<"student_record_competency_scores"> & CompetencyScoreEvidenceFields;
export type CompetencyScoreInsert = TablesInsert<"student_record_competency_scores"> & CompetencyScoreEvidenceFields;
export type CompetencyScoreUpdate = TablesUpdate<"student_record_competency_scores"> & CompetencyScoreEvidenceFields;

export type ActivityTag = Tables<"student_record_activity_tags"> & ActivityTagEvidenceFields;
export type ActivityTagInsert = TablesInsert<"student_record_activity_tags"> & ActivityTagEvidenceFields;

export type Diagnosis = Tables<"student_record_diagnosis"> & DiagnosisExtFields;
export type DiagnosisInsert = TablesInsert<"student_record_diagnosis"> & DiagnosisExtFields;
export type DiagnosisUpdate = TablesUpdate<"student_record_diagnosis"> & DiagnosisExtFields;

export type Strategy = Tables<"student_record_strategies">;
export type StrategyInsert = TablesInsert<"student_record_strategies">;
export type StrategyUpdate = TablesUpdate<"student_record_strategies">;

// ── 유틸리티 ──

/** LLM rubricScores → DB Json 타입 변환 */
export function toDbJson(value: unknown): import("@/lib/supabase/database.types").Json {
  return value as import("@/lib/supabase/database.types").Json;
}
