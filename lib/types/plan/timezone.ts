/**
 * 타임존 기반 플랜 생성 시스템 타입 정의
 *
 * 2단계 플랜 생성 방식:
 * 1. 타임존(스케줄 프레임) 생성
 * 2. 콘텐츠 개별 추가 (각 콘텐츠마다 1730 로직 옵션 설정)
 */

import type { PlanGroup, DayType, SchedulerOptions } from "./domain";

// =====================================================
// 타임존 관련 타입
// =====================================================

/**
 * 타임존 상태
 * - draft: 초안 (편집 중)
 * - ready: 준비 완료 (콘텐츠 추가 가능)
 * - active: 활성화 (플랜 실행 중)
 */
export type TimezoneStatus = "draft" | "ready" | "active";

/**
 * 타임존 (스케줄 프레임)
 * plan_groups 테이블을 확장하여 사용
 */
export type Timezone = PlanGroup & {
  is_timezone_only: boolean;
  timezone_status: TimezoneStatus;
  default_scheduler_options?: SchedulerOptions;
};

/**
 * 타임존 + 콘텐츠 정보
 */
export type TimezoneWithContents = Timezone & {
  contents: PlanContentWithScheduler[];
  content_count: number;
  plan_count: number;
  completion_rate: number;
};

/**
 * 타임존 생성 입력
 */
export type CreateTimezoneInput = {
  name: string;
  period_start: string;
  period_end: string;
  block_set_id?: string;
  target_date?: string;
  plan_purpose?: "내신대비" | "모의고사(수능)";

  // 스케줄 설정
  daily_schedule?: DailyScheduleInfo[];
  exclusions?: ExclusionInput[];
  academy_schedules?: AcademyScheduleInput[];

  // 기본 1730 옵션
  default_scheduler_options?: ContentSchedulerOptions;
};

/**
 * 타임존 필터
 */
export type TimezoneFilters = {
  status?: TimezoneStatus;
  include_content_count?: boolean;
  period_start_after?: string;
  period_end_before?: string;
};

// =====================================================
// 콘텐츠별 스케줄러 타입
// =====================================================

/**
 * 콘텐츠 스케줄러 모드
 * - inherit: 타임존 기본 설정 상속
 * - strategy: 전략과목 모드 (주 N일 배정)
 * - weakness: 취약과목 모드 (매일 배정)
 * - custom: 커스텀 설정
 */
export type ContentSchedulerMode =
  | "inherit"
  | "strategy"
  | "weakness"
  | "custom";

/**
 * 콘텐츠별 스케줄러 옵션
 */
export type ContentSchedulerOptions = {
  // 학습일/복습일 주기
  study_days?: number; // 학습일 수 (기본: 6)
  review_days?: number; // 복습일 수 (기본: 1)

  // 과목 유형 설정
  subject_type?: "strategy" | "weakness";
  weekly_allocation_days?: number; // 전략과목: 주당 배정일 (2, 3, 4)

  // 목표 설정
  target_type: "page" | "episode" | "unit" | "time";
  target_value: number; // 목표 페이지/회차/단위/시간(분)

  // 일일 할당
  daily_amount?: number; // 일일 목표량
  daily_duration_minutes?: number; // 일일 목표 시간

  // 복습 설정
  auto_review: boolean; // 복습일 자동 생성
  review_ratio?: number; // 복습 분량 비율 (기본: 0.3)

  // 배치 전략
  distribution_strategy: "even" | "front_loaded" | "back_loaded" | "custom";

  // 커스텀 스케줄 (advanced)
  custom_dates?: string[]; // 특정 날짜만 배치
  excluded_dates?: string[]; // 특정 날짜 제외
  preferred_days?: number[]; // 선호 요일 (0-6)
};

/**
 * 콘텐츠 플랜 생성 상태
 */
export type ContentGenerationStatus = "pending" | "generated" | "modified";

/**
 * plan_contents + 스케줄러 정보
 */
export type PlanContentWithScheduler = {
  id: string;
  plan_group_id: string;
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  master_content_id?: string;
  start_range: number;
  end_range: number;
  display_order: number;

  // 스케줄러 옵션
  scheduler_mode: ContentSchedulerMode;
  content_scheduler_options?: ContentSchedulerOptions;
  generation_status: ContentGenerationStatus;

  // 콘텐츠 메타 (조인 데이터)
  content_title?: string;
  content_subject?: string;
  total_units?: number; // 총 페이지/회차
};

// =====================================================
// 달력 뷰 관련 타입
// =====================================================

/**
 * 가용 날짜 정보 (달력 뷰용)
 */
export type AvailableDate = {
  date: string;
  day_type: DayType;
  is_exclusion: boolean;
  exclusion_reason?: string;
  academy_schedules?: AcademyScheduleInfo[];
  available_slots: TimeSlot[];
  allocated_contents: AllocatedContent[];
  remaining_minutes: number;
};

/**
 * 시간 슬롯
 */
export type TimeSlot = {
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  duration_minutes: number;
  is_available: boolean;
  block_type?: "study" | "break" | "academy" | "lunch" | "self_study";
};

/**
 * 날짜에 배정된 콘텐츠
 */
export type AllocatedContent = {
  content_id: string;
  content_title: string;
  duration_minutes: number;
  range_start: number;
  range_end: number;
};

/**
 * 타임존 달력 데이터
 */
export type TimezoneCalendarData = {
  timezone: Timezone;
  contents: PlanContentWithScheduler[];
  plans: StudentPlanSummary[];
  available_dates: AvailableDate[];
  summary: {
    total_days: number;
    study_days: number;
    review_days: number;
    exclusion_days: number;
    total_study_hours: number;
  };
};

// =====================================================
// 플랜 미리보기 타입
// =====================================================

/**
 * 플랜 미리보기 (콘텐츠 추가 전 확인용)
 */
export type PlanPreview = {
  date: string;
  day_type: "study" | "review";
  content_id: string;
  content_title: string;
  range_start: number;
  range_end: number;
  estimated_duration_minutes: number;
  slot?: {
    start_time: string;
    end_time: string;
  };
};

/**
 * 콘텐츠 추가 입력
 */
export type AddContentInput = {
  timezone_id: string;
  content_type: "book" | "lecture" | "custom";

  // 기존 콘텐츠 선택
  content_id?: string;
  master_content_id?: string;

  // 새 콘텐츠 생성
  new_content?: {
    title: string;
    subject?: string;
    total_pages?: number;
    total_episodes?: number;
  };

  // 범위 설정
  range?: {
    start: number;
    end: number;
    unit: "page" | "episode" | "unit";
  };

  // 1730 옵션
  scheduler_mode: ContentSchedulerMode;
  scheduler_options?: ContentSchedulerOptions;

  // 배치 설정
  placement?: {
    start_date?: string;
    preferred_days?: number[];
  };
};

// =====================================================
// 복습 그룹 타입
// =====================================================

/**
 * 복습 그룹 (콘텐츠별 주차 복습)
 */
export type ReviewGroup = {
  id: string;
  content_id: string;
  content_title: string;
  week_number: number;
  review_date: string;
  source_plans: ReviewSourcePlan[];
  total_range: {
    start: number;
    end: number;
  };
  estimated_duration_minutes: number;
  status: "pending" | "completed";
};

/**
 * 복습 원본 플랜
 */
export type ReviewSourcePlan = {
  plan_id: string;
  plan_date: string;
  range_start: number;
  range_end: number;
};

// =====================================================
// 보조 타입 (import용)
// =====================================================

/**
 * 일별 스케줄 정보
 */
export type DailyScheduleInfo = {
  date: string;
  day_type: DayType;
  study_hours: number;
  time_slots?: TimeSlot[];
  // 1730 Timetable 주기 정보
  week_number?: number | null;
  cycle_day_number?: number | null;
};

/**
 * 제외일 입력
 */
export type ExclusionInput = {
  date: string;
  type: "휴가" | "개인일정" | "지정휴일" | "기타";
  reason?: string;
};

/**
 * 학원 일정 입력
 */
export type AcademyScheduleInput = {
  day_of_week: number; // 0-6
  start_time: string;
  end_time: string;
  academy_name?: string;
  subject?: string;
  travel_time?: number;
};

/**
 * 학원 일정 정보 (특정 날짜용)
 */
export type AcademyScheduleInfo = {
  start_time: string;
  end_time: string;
  academy_name?: string;
  subject?: string;
};

/**
 * 학생 플랜 요약 (달력 표시용)
 */
export type StudentPlanSummary = {
  id: string;
  plan_date: string;
  content_id: string;
  content_title: string;
  day_type: DayType;
  range_start: number;
  range_end: number;
  status: "pending" | "in_progress" | "completed" | "canceled";
  review_group_id?: string;
};
