/**
 * Score 도메인 타입 정의
 */

// ============================================
// 통합 성적 타입 (legacy student_scores 테이블)
// ============================================

export type StudentScore = {
  id: string;
  tenant_id?: string | null;
  student_id: string;
  subject_type: string;
  semester?: string | null;
  course: string;
  course_detail: string;
  raw_score: number;
  grade: number;
  score_type_detail?: string | null;
  test_date?: string | null;
  created_at?: string | null;
};

// ============================================
// 내신 성적 타입
// ============================================

export type SchoolScore = {
  id: string;
  tenant_id?: string | null;
  student_id: string;
  grade: number; // 학년
  semester: number; // 학기
  // FK 필드 (새로운 방식)
  subject_group_id?: string | null;
  subject_id?: string | null;
  subject_type_id?: string | null;
  // Deprecated: 텍스트 필드 (하위 호환성 유지)
  /** @deprecated subject_group_id를 사용하세요 */
  subject_group?: string | null;
  /** @deprecated subject_type_id를 사용하세요 */
  subject_type?: string | null;
  /** @deprecated subject_id를 사용하세요 */
  subject_name?: string | null;
  credit_hours?: number | null;
  raw_score?: number | null;
  subject_average?: number | null;
  standard_deviation?: number | null;
  grade_score?: number | null; // 등급 (1-9)
  total_students?: number | null;
  rank_grade?: number | null;
  created_at?: string | null;
};

// ============================================
// 모의고사 성적 타입
// ============================================

export type MockExamType = "수능" | "평가원" | "교육청" | "사설";

export type MockScore = {
  id: string;
  tenant_id?: string | null;
  student_id: string;
  grade: number; // 학년
  exam_type: string;
  // FK 필드 (새로운 방식)
  subject_group_id?: string | null;
  subject_id?: string | null;
  subject_type_id?: string | null;
  // Deprecated: 텍스트 필드 (하위 호환성 유지)
  /** @deprecated subject_group_id를 사용하세요 */
  subject_group?: string | null;
  /** @deprecated subject_id를 사용하세요 */
  subject_name?: string | null;
  raw_score?: number | null;
  standard_score?: number | null;
  percentile?: number | null;
  grade_score?: number | null; // 등급 (1-9)
  exam_round?: string | null; // 월 (3, 6, 9, 11 등)
  created_at?: string | null;
};

// ============================================
// 조회 필터 타입
// ============================================

export type GetSchoolScoresFilter = {
  grade?: number;
  semester?: number;
  subjectGroup?: string;
  subjectGroupId?: string;
};

export type GetMockScoresFilter = {
  grade?: number;
  examType?: string;
  subjectGroup?: string;
  subjectGroupId?: string;
  examRound?: string;
};

// ============================================
// 생성/수정 입력 타입
// ============================================

export type CreateSchoolScoreInput = {
  tenant_id?: string | null;
  student_id: string;
  grade: number;
  semester: number;
  // FK 필드
  subject_group_id?: string | null;
  subject_id?: string | null;
  subject_type_id?: string | null;
  // 텍스트 필드 (deprecated)
  subject_group?: string | null;
  subject_type?: string | null;
  subject_name?: string | null;
  credit_hours?: number | null;
  raw_score?: number | null;
  subject_average?: number | null;
  standard_deviation?: number | null;
  grade_score?: number | null;
  total_students?: number | null;
  rank_grade?: number | null;
};

export type UpdateSchoolScoreInput = Partial<
  Omit<SchoolScore, "id" | "student_id" | "tenant_id" | "created_at">
>;

export type CreateMockScoreInput = {
  tenant_id?: string | null;
  student_id: string;
  grade: number;
  exam_type: string;
  // FK 필드
  subject_group_id?: string | null;
  subject_id?: string | null;
  subject_type_id?: string | null;
  // 텍스트 필드 (deprecated)
  subject_group?: string | null;
  subject_name?: string | null;
  raw_score?: number | null;
  standard_score?: number | null;
  percentile?: number | null;
  grade_score?: number | null;
  exam_round?: string | null;
};

export type UpdateMockScoreInput = Partial<
  Omit<MockScore, "id" | "student_id" | "tenant_id" | "created_at">
>;

// ============================================
// 응답 타입
// ============================================

export type ScoreActionResult = {
  success: boolean;
  error?: string;
  scoreId?: string;
};

