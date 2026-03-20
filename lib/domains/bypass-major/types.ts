// ============================================================
// CMS C1.5: 우회학과 도메인 타입
// ============================================================

// ------------------------------------
// 1. 상수 타입
// ------------------------------------

export const BYPASS_CANDIDATE_SOURCES = [
  "pre_mapped",
  "similarity",
  "manual",
] as const;
export type BypassCandidateSource =
  (typeof BYPASS_CANDIDATE_SOURCES)[number];

export const BYPASS_CANDIDATE_STATUSES = [
  "candidate",
  "shortlisted",
  "rejected",
] as const;
export type BypassCandidateStatus =
  (typeof BYPASS_CANDIDATE_STATUSES)[number];

export const BYPASS_CANDIDATE_STATUS_LABELS: Record<
  BypassCandidateStatus,
  string
> = {
  candidate: "후보",
  shortlisted: "선별",
  rejected: "제외",
};

export const BYPASS_CANDIDATE_SOURCE_LABELS: Record<
  BypassCandidateSource,
  string
> = {
  pre_mapped: "사전 매핑",
  similarity: "유사도 분석",
  manual: "수동 지정",
};

// ------------------------------------
// 2. DB Row 타입
// ------------------------------------

/** university_departments 테이블 행 */
export interface UniversityDepartment {
  id: string;
  legacy_id: number;
  university_name: string;
  college_name: string | null;
  department_name: string;
  major_classification: string | null;
  mid_classification: string | null;
  sub_classification: string | null;
  classification_code: string | null;
  campus: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** department_curriculum 테이블 행 */
export interface DepartmentCurriculum {
  id: string;
  department_id: string;
  legacy_id: number | null;
  course_name: string;
  semester: string | null;
  course_type: string | null;
  notes: string | null;
  created_at: string;
}

/** department_classifications 테이블 행 */
export interface DepartmentClassification {
  id: number;
  major_code: string;
  major_name: string;
  mid_code: string | null;
  mid_name: string | null;
  sub_code: string | null;
  sub_name: string | null;
}

/** bypass_major_pairs 테이블 행 (사전 매핑) */
export interface BypassMajorPair {
  id: string;
  department_id: string;
  bypass_department_name: string;
  bypass_department_id: string | null;
  legacy_management_id: number | null;
  created_at: string;
}

/** bypass_major_candidates 테이블 행 */
export interface BypassMajorCandidate {
  id: string;
  tenant_id: string;
  student_id: string;
  target_department_id: string;
  candidate_department_id: string;
  source: BypassCandidateSource;
  curriculum_similarity_score: number | null;
  placement_grade: string | null;
  competency_fit_score: number | null;
  composite_score: number | null;
  rationale: string | null;
  consultant_notes: string | null;
  status: BypassCandidateStatus;
  school_year: number;
  created_at: string;
  updated_at: string;
}

// ------------------------------------
// 3. 서비스 레이어 타입 (JOIN)
// ------------------------------------

/** 학과 + 교육과정 목록 */
export interface DepartmentWithCurriculum extends UniversityDepartment {
  curriculum: DepartmentCurriculum[];
}

/** 우회 후보 + 학과 상세 */
export interface BypassCandidateWithDetails extends BypassMajorCandidate {
  target_department: UniversityDepartment;
  candidate_department: UniversityDepartment;
}

// ------------------------------------
// 4. 필터/검색 타입
// ------------------------------------

/** 학과 검색 필터 */
export interface DepartmentSearchFilter {
  query?: string;
  universityName?: string;
  majorClassification?: string;
  page?: number;
  pageSize?: number;
}

/** 교육과정 비교 결과 */
export interface CurriculumCompareResult {
  departmentA: { id: string; name: string; universityName: string };
  departmentB: { id: string; name: string; universityName: string };
  sharedCourses: string[];
  uniqueToA: string[];
  uniqueToB: string[];
  overlapScore: number;
  totalCoursesA: number;
  totalCoursesB: number;
}

// ------------------------------------
// 5. Import 관련 타입 (Access DB CSV)
// ------------------------------------

/** Access DB 학과 행 */
export interface AccessDepartmentRow {
  ID: string;
  대학명: string;
  학과: string;
  대분류명: string;
  중분류명: string;
  소분류명: string;
  [key: string]: string;
}

/** Access DB 교육과정 행 */
export interface AccessCurriculumRow {
  ID: string;
  과목명: string;
  학년학기: string;
  비고: string;
  학과ID: string;
}

/** Access DB 우회학과 페어 행 */
export interface AccessBypassPairRow {
  우회학과관리ID: string;
  학과ID: string;
  우회학과: string;
}

/** Access DB 분류 코드 행 */
export interface AccessClassificationRow {
  대분류코드: string;
  대분류명: string;
  중분류코드: string;
  중분류명: string;
  소분류코드: string;
  소분류명: string;
}

/** Import 결과 (공통) */
export interface ImportDepartmentResult {
  total: number;
  inserted: number;
  skipped: number;
  errors: Array<{ legacyId: number; error: string }>;
}
