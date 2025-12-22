/**
 * Analysis Domain Types
 *
 * Risk Index 분석 관련 타입 정의
 */

export type ScoreRow = {
  id: string;
  course?: string | null;
  course_detail?: string | null;
  grade?: number | null;
  raw_score?: number | null;
  test_date?: string | null;
  semester?: string | null;
  created_at?: string | null;
};

export type ProgressRow = {
  content_type?: string | null;
  content_id?: string | null;
  progress?: number | null;
  last_updated?: string | null;
};

export type PlanRow = {
  id: string;
  content_type?: string | null;
  content_id?: string | null;
  plan_date?: string | null;
  completed_amount?: number | null;
};

export type ContentRow = {
  id: string;
  subject?: string | null;
  difficulty_level?: string | null;
};

export type SubjectRiskAnalysis = {
  subject: string;
  risk_score: number; // 0-100
  recent_grade_trend: number; // -1 (하락), 0 (유지), 1 (상승)
  consistency_score: number; // 0-100 (높을수록 일관적)
  mastery_estimate: number; // 0-100 (높을수록 숙련도 높음)
  recent3AvgGrade: number;
  gradeChange: number; // 최근 등급 변화
  scoreVariance: number; // 원점수 편차
  improvementRate: number; // 학습 시간 대비 성취도 개선율
};
