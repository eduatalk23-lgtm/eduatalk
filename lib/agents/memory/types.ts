// ============================================
// 케이스 메모리 타입 정의
// ============================================

export interface ConsultingCase {
  id: string;
  tenantId: string;
  sessionId: string | null;
  studentGrade: number | null;
  schoolCategory: string | null;
  targetMajor: string | null;
  curriculumRevision: string | null;
  diagnosisSummary: string;
  strategySummary: string;
  keyInsights: string[];
  outcome: string | null;
  outcomeScore: number | null;
  embeddingStatus: "pending" | "completed" | "failed";
  createdAt: string;
}

export interface CaseSearchResult {
  case_id: string;
  student_grade: number | null;
  target_major: string | null;
  diagnosis_summary: string;
  strategy_summary: string;
  key_insights: string[];
  outcome: string | null;
  outcome_score: number | null;
  score: number;
}

export interface SearchCasesOptions {
  query: string;
  tenantId?: string | null;
  gradeFilter?: number | null;
  majorFilter?: string | null;
  matchCount?: number;
  similarityThreshold?: number;
}

export interface CaseInsertParams {
  tenantId: string;
  sessionId?: string | null;
  studentGrade?: number | null;
  schoolCategory?: string | null;
  targetMajor?: string | null;
  curriculumRevision?: string | null;
  diagnosisSummary: string;
  strategySummary: string;
  keyInsights?: string[];
}

// ── 교정 피드백 타입 ──

export type CorrectionType = "factual" | "strategic" | "nuance" | "missing";

export interface CorrectionSearchResult {
  correction_id: string;
  original_response: string;
  correction_text: string;
  correction_type: CorrectionType;
  context_summary: string | null;
  score: number;
}

export interface SearchCorrectionsOptions {
  query: string;
  tenantId?: string | null;
  correctionTypeFilter?: CorrectionType | null;
  matchCount?: number;
  similarityThreshold?: number;
}
