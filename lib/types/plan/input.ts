/**
 * Plan 관련 폼 입력 및 API 요청 타입
 * 
 * 이 파일은 사용자 입력 및 API 요청에서 사용하는 타입들을 정의합니다.
 * 폼 검증, 데이터 변환 등의 목적으로 사용됩니다.
 */

import type {
  PlanPurpose,
  SchedulerType,
  ExclusionType,
  ContentType,
  PlanType,
  PlanStatus,
  SchedulerOptions,
  TimeSettings,
  StudyReviewCycle,
  StudentLevel,
  SubjectAllocation,
  SubjectConstraints,
  AdditionalPeriodReallocation,
  NonStudyTimeBlock,
  DailyScheduleInfo,
  TimeRange,
} from "./domain";
import type { ContentSlot } from "@/lib/types/content-selection";
import type { StudyType } from "./contentPlanGroup";

/**
 * 플랜 그룹 생성 데이터
 */
export type PlanGroupCreationData = {
  name?: string | null;
  plan_purpose: PlanPurpose;
  scheduler_type: SchedulerType;
  scheduler_options?: SchedulerOptions | null;
  time_settings?: TimeSettings; // time_settings는 scheduler_options에 병합되어 저장됨
  period_start: string; // date
  period_end: string; // date
  target_date?: string | null; // date
  block_set_id?: string | null;
  planner_id?: string | null; // 플래너 연결
  contents: PlanContentInput[];
  exclusions: PlanExclusionInput[];
  academy_schedules: AcademyScheduleInput[];
  // 1730 Timetable 추가 필드
  study_review_cycle?: StudyReviewCycle; // 학습일/복습일 주기 설정
  student_level?: StudentLevel; // 학생 수준 정보 (필수)
  subject_allocations?: SubjectAllocation[]; // 전략과목/취약과목 정보 (필수)
  subject_constraints?: SubjectConstraints; // 교과 제약 조건
  additional_period_reallocation?: AdditionalPeriodReallocation; // 추가 기간 재배치 설정
  non_study_time_blocks?: NonStudyTimeBlock[]; // 학습 시간 제외 항목
  daily_schedule?: DailyScheduleInfo[] | null; // JSONB: 일별 스케줄 정보 (Step 2.5에서 생성)
  // 캠프 관련 필드
  plan_type?: PlanType;
  camp_template_id?: string | null;
  camp_invitation_id?: string | null;
  // 2단계 콘텐츠 선택 시스템 (슬롯 모드)
  use_slot_mode?: boolean;
  content_slots?: ContentSlot[] | null;
  // NEW: 플래너 상속 시간 설정 (Planner와 동일한 구조)
  study_hours?: TimeRange | null; // 학습 시간 (예: {start: "10:00", end: "19:00"})
  self_study_hours?: TimeRange | null; // 자율학습 시간 (예: {start: "19:00", end: "22:00"})
  lunch_time?: TimeRange | null; // 점심 시간 (예: {start: "12:00", end: "13:00"})
  // 플랜 그룹 레벨 학습 유형 설정
  study_type?: StudyType | null; // 전략 학습 또는 취약 보완
  strategy_days_per_week?: 2 | 3 | 4 | null; // 전략 학습 시 주간 학습일 (study_type이 'strategy'일 때만 사용)
  // Phase 3: 단일 콘텐츠 모드 필드 (is_single_content=true 시 contents 대신 사용)
  is_single_content?: boolean; // 단일 콘텐츠 모드 여부
  single_content_type?: ContentType | null; // 단일 콘텐츠 타입
  single_content_id?: string | null; // 단일 콘텐츠 ID
  single_master_content_id?: string | null; // 단일 마스터 콘텐츠 ID
  single_start_range?: number | null; // 단일 콘텐츠 시작 범위
  single_end_range?: number | null; // 단일 콘텐츠 종료 범위
  single_start_detail_id?: string | null; // 단일 콘텐츠 시작 상세 ID
  single_end_detail_id?: string | null; // 단일 콘텐츠 종료 상세 ID
};

/**
 * 플랜 콘텐츠 입력
 */
export type PlanContentInput = {
  content_type: ContentType;
  content_id: string;
  master_content_id?: string | null; // 마스터 콘텐츠 ID (학생 콘텐츠가 마스터 콘텐츠와 연계된 경우)
  start_range: number;
  end_range: number;
  start_detail_id?: string | null; // 시작 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id)
  end_detail_id?: string | null; // 종료 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id)
  display_order?: number;
};

/**
 * 플랜 제외일 입력
 */
export type PlanExclusionInput = {
  exclusion_date: string; // date
  exclusion_type: ExclusionType;
  reason?: string | null;
};

/**
 * 학원 입력
 */
export type AcademyInput = {
  name: string; // 학원명
  travel_time?: number; // 기본 이동시간 (분 단위, 기본값: 60)
};

/**
 * 학원 일정 입력 (학원별 요일별 시간대)
 */
export type AcademyScheduleInput = {
  academy_id?: string; // 기존 학원 ID (수정 시)
  academy_name?: string; // 새 학원명 (생성 시, 하위 호환성)
  day_of_week: number;
  start_time: string; // time
  end_time: string; // time
  subject?: string | null; // 과목 (선택사항)
  travel_time?: number; // 이동시간 (하위 호환성, academy의 travel_time 사용)
  source?: "template" | "student" | "time_management"; // 일정 출처 (템플릿, 학생 입력, 시간관리)
  is_locked?: boolean; // 템플릿 잠금 여부 (잠금 시 학생 수정 불가)
};

/**
 * 논리 플랜 아이템 입력
 */
export type PlanGroupItemInput = {
  content_type: ContentType;
  content_id: string;
  master_content_id?: string | null;
  target_start_page_or_time: number;
  target_end_page_or_time: number;
  repeat_count?: number;
  split_strategy?: "equal" | "custom" | "auto";
  is_review?: boolean;
  is_required?: boolean;
  priority?: number;
  display_order?: number;
  metadata?: Record<string, unknown> | null;
};

/**
 * 템플릿 잠금 필드 설정
 * 템플릿 모드에서 특정 필드를 고정하거나 학생 입력을 제한하는 설정
 */
export type TemplateLockedFields = {
  // Step 1 고정 필드
  step1?: {
    name?: boolean;
    plan_purpose?: boolean;
    scheduler_type?: boolean;
    period_start?: boolean;
    period_end?: boolean;
    block_set_id?: boolean;
    student_level?: boolean;
    subject_allocations?: boolean;
    study_review_cycle?: boolean;
    // 학생 입력 허용 필드
    allow_student_name?: boolean;
    allow_student_plan_purpose?: boolean;
    allow_student_scheduler_type?: boolean;
    allow_student_period?: boolean; // period_start, period_end 통합
    allow_student_block_set_id?: boolean;
    allow_student_student_level?: boolean;
    allow_student_subject_allocations?: boolean;
    allow_student_study_review_cycle?: boolean;
    allow_student_additional_period_reallocation?: boolean;
  };
  // Step 2 고정 필드
  step2?: {
    exclusions?: boolean; // 전체 제외일 고정
    exclusion_items?: string[]; // 특정 제외일 ID 배열 (exclusion_date 기준)
    academy_schedules?: boolean; // 전체 학원 일정 고정
    academy_schedule_items?: string[]; // 특정 학원 일정 ID 배열
    time_settings?: boolean; // 전체 시간 설정 고정
    time_settings_fields?: string[]; // 특정 시간 설정 필드 배열
    // 신규 필드
    non_study_time_blocks?: boolean; // 학습 시간 제외 항목 사용/미사용
    allow_student_exclusions?: boolean; // 학생이 제외일 입력 가능 여부
    allow_student_academy_schedules?: boolean; // 학생이 학원 일정 입력 가능 여부
    allow_student_time_settings?: boolean; // 학생이 시간 설정 입력 가능 여부
    allow_student_non_study_time_blocks?: boolean; // 학생이 학습 시간 제외 항목 입력 가능 여부
  };
  // Step 3 고정 필드
  step3?: {
    student_contents?: boolean; // 전체 학생 콘텐츠 고정
    student_content_items?: string[]; // 특정 콘텐츠 ID 배열 (content_id 기준)
  };
};

/**
 * 플랜 필터
 */
export type PlanFilters = {
  studentId: string;
  tenantId?: string | null;
  status?: PlanStatus | PlanStatus[];
  planPurpose?: PlanPurpose;
  dateRange?: {
    start: string;
    end: string;
  };
  planDate?: string;
  contentType?: ContentType;
  includeDeleted?: boolean;
};

