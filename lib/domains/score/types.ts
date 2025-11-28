/**
 * Score 도메인 타입 정의
 *
 * Supabase Database 타입에서 파생됩니다.
 * @see lib/supabase/database.types.ts
 */

import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";

// ============================================
// Database 타입에서 파생된 타입
// ============================================

/**
 * 내신 성적 타입 (정규화 버전)
 */
export type InternalScore = Tables<"student_internal_scores">;

/**
 * 내신 성적 생성 입력 타입
 */
export type InternalScoreInsert = TablesInsert<"student_internal_scores">;

/**
 * 내신 성적 수정 입력 타입
 */
export type InternalScoreUpdate = TablesUpdate<"student_internal_scores">;

/**
 * 내신 성적 타입 (레거시 - 하위 호환성)
 * @deprecated InternalScore를 사용하세요
 */
export type SchoolScore = Tables<"student_school_scores">;

/**
 * 내신 성적 생성 입력 타입 (레거시)
 * @deprecated InternalScoreInsert를 사용하세요
 */
export type SchoolScoreInsert = TablesInsert<"student_school_scores">;

/**
 * 내신 성적 수정 입력 타입 (레거시)
 * @deprecated InternalScoreUpdate를 사용하세요
 */
export type SchoolScoreUpdate = TablesUpdate<"student_school_scores">;

/**
 * 모의고사 성적 타입
 */
export type MockScore = Tables<"student_mock_scores">;

/**
 * 모의고사 성적 생성 입력 타입
 */
export type MockScoreInsert = TablesInsert<"student_mock_scores">;

/**
 * 모의고사 성적 수정 입력 타입
 */
export type MockScoreUpdate = TablesUpdate<"student_mock_scores">;

// ============================================
// 레거시 타입 (하위 호환성)
// ============================================

/**
 * 통합 성적 타입 (legacy student_scores 테이블)
 * @deprecated 내신/모의고사 별도 테이블 사용 권장
 */
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
// 조회 필터 타입
// ============================================

/**
 * 내신 성적 조회 필터
 */
export type GetSchoolScoresFilter = {
  grade?: number;
  semester?: number;
  subjectGroup?: string;
  subjectGroupId?: string;
};

/**
 * 모의고사 성적 조회 필터
 */
export type GetMockScoresFilter = {
  grade?: number;
  examTitle?: string;
  examDate?: string;
  subjectGroup?: string;
  subjectGroupId?: string;
};

// ============================================
// 비즈니스 로직용 입력 타입
// ============================================

/**
 * 내신 성적 생성 입력 (서비스용 - 정규화 버전)
 */
export type CreateInternalScoreInput = {
  tenant_id: string;
  student_id: string;
  curriculum_revision_id: string;
  subject_group_id: string;
  subject_type_id: string;
  subject_id: string;
  grade: number;
  semester: number;
  credit_hours: number;
  raw_score?: number | null;
  avg_score?: number | null;
  std_dev?: number | null;
  rank_grade?: number | null;
  total_students?: number | null;
};

/**
 * 내신 성적 생성 입력 (서비스용 - 레거시)
 * @deprecated CreateInternalScoreInput을 사용하세요
 */
export type CreateSchoolScoreInput = {
  tenant_id?: string | null;
  student_id: string;
  grade: number;
  semester: number;
  // FK 필드
  subject_group_id?: string | null;
  subject_id?: string | null;
  subject_type_id?: string | null;
  // deprecated 텍스트 필드
  subject_group?: string | null;
  subject_type?: string | null;
  subject_name?: string | null;
  // 성적 정보
  credit_hours?: number | null;
  raw_score?: number | null;
  subject_average?: number | null;
  standard_deviation?: number | null;
  grade_score?: number | null;
  total_students?: number | null;
  rank_grade?: number | null;
};

/**
 * 내신 성적 수정 입력 (서비스용 - 정규화 버전)
 */
export type UpdateInternalScoreInput = Partial<
  Omit<InternalScore, "id" | "student_id" | "tenant_id" | "created_at" | "updated_at">
>;

/**
 * 내신 성적 수정 입력 (서비스용 - 레거시)
 * @deprecated UpdateInternalScoreInput을 사용하세요
 */
export type UpdateSchoolScoreInput = Partial<
  Omit<SchoolScore, "id" | "student_id" | "tenant_id" | "created_at" | "updated_at">
>;

/**
 * 모의고사 성적 생성 입력 (서비스용 - 정규화 버전)
 */
export type CreateMockScoreInput = {
  tenant_id: string;
  student_id: string;
  exam_date: string; // date 형식: YYYY-MM-DD
  exam_title: string;
  grade: number;
  subject_id: string;
  subject_group_id: string;
  raw_score?: number | null;
  standard_score?: number | null;
  percentile?: number | null;
  grade_score?: number | null;
};

/**
 * 모의고사 성적 수정 입력 (서비스용)
 */
export type UpdateMockScoreInput = Partial<
  Omit<MockScore, "id" | "student_id" | "tenant_id" | "created_at" | "updated_at">
>;

// ============================================
// 응답 타입
// ============================================

/**
 * 성적 액션 결과
 */
export type ScoreActionResult = {
  success: boolean;
  error?: string;
  scoreId?: string;
};

// ============================================
// 모의고사 유형 Enum
// ============================================

/**
 * 모의고사 유형
 */
export type MockExamType = "수능" | "평가원" | "교육청" | "사설";
