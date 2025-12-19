/**
 * 레거시 성적 대시보드 타입 정의
 * 
 * ⚠️ 주의: 이 타입들은 레거시 대시보드(/scores/dashboard)에서만 사용됩니다.
 * 새로운 통합 대시보드(/scores/dashboard/unified)는 lib/types/scoreDashboard.ts 의 타입을 사용합니다.
 * 
 * 새 기능 구현 시 lib/types/scoreDashboard.ts 의 타입을 사용하세요.
 */

/**
 * ⚠️ 레거시 타입: student_internal_scores 테이블 기반
 * 새로운 코드에서는 lib/types/scoreDashboard.ts 의 타입을 사용하세요.
 */
export type SchoolScoreRow = {
  id: string;
  student_id: string;
  grade: number;
  semester: number;
  subject_group: string;
  subject_type: string | null;
  subject_name: string | null;
  raw_score: number | null;
  grade_score: number | null;
  class_rank: number | null;
  created_at: string | null;
};

/**
 * ⚠️ 레거시 타입: student_mock_scores 테이블 기반
 * 새로운 코드에서는 lib/types/scoreDashboard.ts 의 타입을 사용하세요.
 */
export type MockScoreRow = {
  id: string;
  student_id: string;
  grade: number;
  subject_group: string;
  exam_type: string;
  subject_name: string | null;
  raw_score: number | null;
  percentile: number | null;
  grade_score: number | null;
  exam_round: string | null;
  created_at: string | null;
};

