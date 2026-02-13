/**
 * 성적 입력 폼 타입 정의
 * student_internal_scores, student_mock_scores 테이블 기반
 */

import type { Database } from "@/lib/supabase/database.types";

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

// ============================================
// 내신 성적 입력 타입
// ============================================

/**
 * 내신 성적 입력 폼 데이터
 */
export type InternalScoreInputForm = {
  // 필수 필드
  subject_group_id: string;
  subject_id: string;
  subject_type_id: string;
  grade: number; // 학년 (1~3)
  semester: number; // 학기 (1~2)
  credit_hours: number; // 학점수 (예: 4)
  rank_grade: number | null; // 석차등급 (1~9), 성취평가제 과목은 null

  // 선택 필드
  raw_score?: number | null; // 원점수
  avg_score?: number | null; // 과목평균
  std_dev?: number | null; // 표준편차
  total_students?: number | null; // 수강자수

  // 성취평가제 필드
  achievement_level?: string | null; // 성취도 (A~E)
  achievement_ratio_a?: number | null; // 성취도비율 A (%)
  achievement_ratio_b?: number | null; // 성취도비율 B (%)
  achievement_ratio_c?: number | null; // 성취도비율 C (%)
  achievement_ratio_d?: number | null; // 성취도비율 D (%)
  achievement_ratio_e?: number | null; // 성취도비율 E (%)
  class_rank?: number | null; // 석차
};

/**
 * 내신 성적 저장용 데이터 (DB Insert 타입)
 */
export type InternalScoreInsert = TablesInsert<"student_internal_scores">;

/**
 * 내신 성적 Row 타입
 */
export type InternalScore = Tables<"student_internal_scores">;

// ============================================
// 모의고사 성적 입력 타입
// ============================================

/**
 * 모의고사 성적 입력 폼 데이터
 */
export type MockScoreInputForm = {
  // 필수 필드
  exam_date: string; // 시험일 (YYYY-MM-DD)
  exam_title: string; // 시험명 (예: "3월 학력평가")
  grade: number; // 학년 (1~3)
  subject_id: string;
  subject_group_id: string;
  grade_score: number; // 등급 (1~9)

  // 선택 필드
  standard_score?: number | null; // 표준점수
  percentile?: number | null; // 백분위
  raw_score?: number | null; // 원점수
};

/**
 * 모의고사 성적 저장용 데이터 (DB Insert 타입)
 */
export type MockScoreInsert = TablesInsert<"student_mock_scores">;

/**
 * 모의고사 성적 Row 타입
 */
export type MockScore = Tables<"student_mock_scores">;

// ============================================
// API 응답 타입
// ============================================

/**
 * 성적 입력 API 응답
 */
export type ScoreInputResponse = {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    internal_scores?: InternalScore[];
    mock_scores?: MockScore[];
  };
};

/**
 * 폼 에러 타입
 */
export type ScoreInputFormErrors = {
  [key: string]: string | undefined;
};

// ============================================
// 유틸리티 타입
// ============================================

/**
 * 성적 입력 유형
 */
export type ScoreInputType = "internal" | "mock";

/**
 * 학기 정보
 */
export type TermInfo = {
  grade: number;
  semester: number;
  year?: number;
};

