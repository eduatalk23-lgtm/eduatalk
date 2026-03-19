// ============================================
// 대학 입시 도메인 타입
// Phase 8.1 — DB 타입 + JSONB 구조 + Import 타입
// ============================================

// ── JSONB 구조 ──────────────────────────────

/** 3개년 경쟁률 { "2025": "3.5", "2024": "남:2.57 여:6.00" } */
export interface CompetitionRates {
  [year: string]: string;
}

/** 입결 연도별 데이터 */
export interface AdmissionResultYear {
  basis?: string;
  grade?: string;
  score?: string;
}

/** 3개년 입결 { "2025": { basis, grade, score }, ... } */
export interface AdmissionResults {
  [year: string]: AdmissionResultYear;
}

/** 3개년 충원 { "2025": "5", "2024": "3" } */
export interface Replacements {
  [year: string]: string;
}

// ── Import 파이프라인 타입 ──────────────────

/** 파싱된 Excel 행 (변환 전) */
export interface RawAdmissionRow {
  [key: string]: string | number | null | undefined;
}

/** 변환된 import 행 (DB 삽입 직전) */
export interface AdmissionImportRow {
  region: string | null;
  university_name: string;
  department_type: string | null;
  department_name: string;
  admission_type: string | null;
  admission_name: string | null;
  eligibility: string | null;
  recruitment_count: string | null;
  year_change: string | null;
  change_details: string | null;
  min_score_criteria: string | null;
  selection_method: string | null;
  required_docs: string | null;
  dual_application: string | null;
  grade_weight: string | null;
  subjects_reflected: string | null;
  career_subjects: string | null;
  notes: string | null;
  exam_date: string | null;
  competition_rates: CompetitionRates;
  competition_change: string | null;
  admission_results: AdmissionResults;
  replacements: Replacements;
}

/** 미적분기하 지정 import 행 */
export interface MathRequirementImportRow {
  university_name: string;
  admission_name: string | null;
  group_type: string | null;
  department_type: string | null;
  department_name: string;
  recruitment_count: string | null;
  usage_method: string | null;
  reflected_areas: string | null;
  korean_req: string | null;
  math_req: string | null;
  science_req: string | null;
  special_notes: string | null;
}

/** 연도 매핑 (헤더에서 감지) */
export interface YearMapping {
  year0: number; // 가장 최근 연도
  year1: number;
  year2: number;
}

/** Import 결과 */
export interface ImportResult {
  total: number;
  inserted: number;
  duplicatesSkipped: number;
  errors: ImportError[];
  cleaningStats: CleaningStats;
}

export interface ImportError {
  row: number;
  universityName: string;
  departmentName: string;
  error: string;
}

export interface CleaningStats {
  dashToNull: number;
  typosNormalized: number;
  exactDuplicatesRemoved: number;
}
