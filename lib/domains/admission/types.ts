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

// ── Phase 8.2 Import 타입 ────────────────

/** 환산 설정 import 행 (COMPUTE 시트 → university_score_configs) */
export interface ScoreConfigImportRow {
  university_name: string;
  mandatory_pattern: string | null;
  optional_pattern: string | null;
  weighted_pattern: string | null;
  inquiry_count: number;
  math_selection: string;
  inquiry_selection: string;
  history_substitute: string | null;
  foreign_substitute: string | null;
  bonus_rules: Record<string, unknown>;
  conversion_type: string;
  scoring_path: "subject" | "percentage";
}

/** 환산점수 변환 import 행 (SUBJECT3 시트 → university_score_conversions) */
export interface ConversionImportRow {
  university_name: string;
  subject: string;
  raw_score: number;
  converted_score: number;
}

/** PERCENTAGE 변환 import 행 (PERCENTAGE 시트 → university_percentage_conversions) */
export interface PercentageConversionImportRow {
  university_name: string;
  track: string;
  percentile: number;
  converted_score: number;
}

/** 결격사유 import 행 (RESTRICT 시트 → university_score_restrictions) */
export interface RestrictionImportRow {
  university_name: string;
  department_name: string | null;
  restriction_type: "no_show" | "grade_sum" | "subject_req";
  rule_config: Record<string, unknown>;
  description: string | null;
}

// ── Phase 8.3: 대학 공식 정보 ────────────────

/** universities 테이블의 공식 대학 정보 */
export interface UniversityInfo {
  id: number;
  nameKor: string;
  nameEng: string | null;
  homepageUrl: string | null;
  establishmentType: string | null;
}

// ── Phase 8.6: 졸업생 DB 검색 타입 ────────────────

/** 검색 필터 */
export interface AdmissionSearchFilter {
  universityName?: string;
  departmentName?: string;
  region?: string;
  departmentType?: string;
  admissionType?: string;
  dataYear?: number;
}

/** 페이지네이션 파라미터 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** DB 행 camelCase 매핑 */
export interface AdmissionSearchRow {
  id: string;
  dataYear: number;
  region: string | null;
  universityName: string;
  departmentType: string | null;
  departmentName: string;
  admissionType: string | null;
  admissionName: string | null;
  eligibility: string | null;
  recruitmentCount: string | null;
  yearChange: string | null;
  changeDetails: string | null;
  minScoreCriteria: string | null;
  selectionMethod: string | null;
  requiredDocs: string | null;
  dualApplication: string | null;
  gradeWeight: string | null;
  subjectsReflected: string | null;
  careerSubjects: string | null;
  notes: string | null;
  examDate: string | null;
  competitionRates: CompetitionRates;
  competitionChange: string | null;
  admissionResults: AdmissionResults;
  replacements: Replacements;
}

/** 페이지네이션 포함 검색 결과 */
export interface AdmissionSearchResult {
  rows: AdmissionSearchRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** 대학명 → 공식 대학 정보 매핑 (별칭 해석 결과) */
  universityInfoMap?: Record<string, UniversityInfo | null>;
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
