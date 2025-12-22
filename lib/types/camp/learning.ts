/**
 * 캠프 학습 관리 관련 타입 정의
 */

import type { Plan } from "@/lib/types/plan/domain";

/**
 * 날짜별 플랜 상세 정보
 */
export type DatePlanDetail = {
  date: string; // YYYY-MM-DD
  plans: Array<{
    student_id: string;
    student_name: string;
    plan_id: string;
    content_type: "book" | "lecture" | "custom";
    content_title: string | null;
    content_subject: string | null;
    block_index: number;
    planned_range: string; // "1-10페이지" 또는 "1강" 형식
    completed_amount: number | null;
    progress: number | null;
    study_minutes: number;
    status: "completed" | "in_progress" | "not_started";
  }>;
};

/**
 * 학생 정보가 포함된 플랜
 */
export type PlanWithStudent = Plan & {
  student_name: string | null;
};

/**
 * 날짜별 학습 진행률 정보
 */
export type DateLearningProgress = {
  date: string; // YYYY-MM-DD
  total_plans: number;
  completed_plans: number;
  progress_rate: number; // 0-100
  study_minutes: number;
};

