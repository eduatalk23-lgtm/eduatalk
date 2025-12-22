/**
 * 캠프 템플릿 액션에서 사용하는 공통 타입 정의
 */

/**
 * 플랜 미리보기 데이터 타입
 */
export type PreviewPlan = {
  plan_date: string;
  block_index: number;
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  content_title: string | null;
  content_subject: string | null;
  content_subject_category: string | null;
  content_category: string | null;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  chapter: string | null;
  start_time: string | null;
  end_time: string | null;
  day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
  week: number | null;
  day: number | null;
  is_partial: boolean;
  is_continued: boolean;
  plan_number: number | null;
};

/**
 * 제외일 타입
 */
export type Exclusion = {
  exclusion_date: string;
  exclusion_type: string;
  reason?: string | null;
};

/**
 * 학원 일정 타입
 */
export type AcademySchedule = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  academy_name?: string;
  subject?: string;
  travel_time?: number;
};

/**
 * 학생 정보 타입 (Supabase 조회 결과)
 */
export type StudentInfo = {
  name: string;
};

