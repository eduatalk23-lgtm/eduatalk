/**
 * Plan 관련 비즈니스 로직 도메인 타입
 * 
 * 이 파일은 비즈니스 로직에서 사용하는 가공된 타입들을 정의합니다.
 * DB 스키마 타입과는 분리되어 있어, 도메인 로직 변경 시 이 파일만 수정하면 됩니다.
 */

import type { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";

// ============================================
// Enum 타입
// ============================================

/**
 * 플랜 목적
 */
export type PlanPurpose = "내신대비" | "모의고사" | "수능" | "기타";

/**
 * 플랜 유형
 */
export type PlanType = "individual" | "integrated" | "camp";

/**
 * 캠프 프로그램 유형
 */
export type CampProgramType = "윈터캠프" | "썸머캠프" | "파이널캠프" | "기타";

/**
 * 캠프 초대 상태
 */
export type CampInvitationStatus = "pending" | "accepted" | "declined";

/**
 * 스케줄러 유형
 */
export type SchedulerType = "1730_timetable";

/**
 * 플랜 상태
 */
export type PlanStatus =
  | "draft"
  | "saved"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

/**
 * 제외일 유형
 */
// 공통 타입은 lib/types/common.ts에서 import
export type { ExclusionType, ContentType, StudentLevel } from "@/lib/types/common";

// ============================================
// JSONB 필드 타입 (PlanGroup 내부)
// ============================================

/**
 * 일별 스케줄 정보 (daily_schedule JSONB에 저장되는 구조)
 */
export type DailyScheduleInfo = {
  date: string; // YYYY-MM-DD 형식
  day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정";
  study_hours: number; // 학습 가능 시간 (시간 단위)
  time_slots?: Array<{
    type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
    start: string; // HH:mm 형식
    end: string; // HH:mm 형식
    label?: string;
  }>;
  exclusion?: {
    exclusion_date: string;
    exclusion_type: string;
    reason?: string | null;
  } | null;
  academy_schedules?: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string;
    subject?: string;
    travel_time?: number; // 이동시간 (분 단위)
  }>;
};

/**
 * 학습일/복습일 주기 설정
 */
export type StudyReviewCycle = {
  study_days: number; // 학습일 수 (기본값: 6)
  review_days: number; // 복습일 수 (기본값: 1)
};

/**
 * 학습 시간 설정
 */
export type StudyHours = {
  start_time: string; // HH:mm
  end_time: string; // HH:mm
};

/**
 * 자율학습 시간 설정
 */
export type SelfStudyHours = {
  enabled: boolean; // 자율학습 시간 사용 여부
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  allow_on_holiday?: boolean; // 지정휴일에 자율학습 시간 배정 여부
};

/**
 * 교과 제약 조건
 */
export type RequiredSubject = {
  subject_category: string; // 교과 (예: 국어, 수학, 영어)
  subject?: string; // 세부 과목 (선택사항, 예: 화법과 작문, 미적분)
  min_count: number; // 최소 개수 (기본값: 1)
  subjects_by_curriculum?: Array<{
    curriculum_revision_id: string;
    subject_id: string;
    subject_name?: string;
  }>; // 개정교육과정별 세부 과목
};

export type SubjectConstraints = {
  required_subjects?: RequiredSubject[]; // 필수 교과/과목 목록 (위계 구조 + 개수)
  excluded_subjects?: string[]; // 제외 교과 목록
  constraint_handling: "strict" | "warning" | "auto_fix"; // 제약 조건 처리 방법
};

/**
 * 추가 기간 재배치 설정
 */
export type AdditionalPeriodReallocation = {
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
  type: "additional_review"; // 추가 복습
  original_period_start: string; // 원본 플랜 기간 시작일
  original_period_end: string; // 원본 플랜 기간 종료일
  subjects?: string[]; // 재배치할 과목 목록 (없으면 전체)
  review_of_review_factor?: number; // 복습의 복습 보정 계수 (기본값: 0.25)
};

/**
 * 학습 시간 제외 항목
 */
export type NonStudyTimeBlock = {
  type: "아침식사" | "점심식사" | "저녁식사" | "수면" | "기타";
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  day_of_week?: number[]; // 요일 적용 범위 (0-6, 없으면 매일)
  description?: string; // 설명
};

/**
 * 스케줄러 옵션
 */
export type SchedulerOptions = {
  weak_subject_focus?: "low" | "medium" | "high" | boolean;
  study_days?: number; // 학습일 수 (기본값: 6)
  review_days?: number; // 복습일 수 (기본값: 1)
  student_level?: StudentLevel;
  subject_allocations?: Array<{
    subject_id: string;
    subject_name: string;
    subject_type: "strategy" | "weakness";
    weekly_days?: number;
  }>;
  content_allocations?: Array<{
    content_type: "book" | "lecture";
    content_id: string;
    subject_type: "strategy" | "weakness";
    weekly_days?: number;
  }>;
};

/**
 * 시간 설정
 */
export type TimeSettings = {
  lunch_time?: { start: string; end: string };
  camp_study_hours?: { start: string; end: string };
  camp_self_study_hours?: { start: string; end: string };
  designated_holiday_hours?: { start: string; end: string };
  use_self_study_with_blocks?: boolean;
  // 자율학습 시간 배정 토글
  enable_self_study_for_holidays?: boolean; // 지정휴일 자율학습 시간 배정
  enable_self_study_for_study_days?: boolean; // 학습일/복습일 자율학습 시간 배정
};

/**
 * 전략과목/취약과목 정보
 */
export type SubjectAllocation = {
  subject_id: string;
  subject_name: string;
  subject_type: "strategy" | "weakness";
  weekly_days?: number; // 전략과목인 경우: 2, 3, 4
};

// ============================================
// Plan JSONB 필드 타입 (Plan 내부)
// ============================================

/**
 * 소요시간 정보
 */
export type DurationInfo = {
  base_duration: number; // 기본 소요시간 (분)
  student_level_factor: number; // 학생 수준 보정 계수
  subject_factor: number; // 과목별 보정 계수
  difficulty_factor: number; // 난이도 보정 계수
  review_factor?: number; // 복습 보정 계수 (복습일인 경우)
  review_of_review_factor?: number; // 복습의 복습 보정 계수 (추가 기간인 경우)
  final_duration: number; // 최종 소요시간 (분)
};

/**
 * 복습일 정보
 */
export type ReviewInfo = {
  previous_study_days_range: string; // 직전 학습일 범위 (예: "2025-01-01 ~ 2025-01-06")
  previous_study_duration: number; // 직전 학습일 학습 소요시간 (분)
  review_factor: number; // 복습 보정 계수
  review_duration: number; // 복습 소요시간 (분)
};

/**
 * 배정 방식 정보
 */
export type AllocationType = {
  type: "all_study_days" | "weekly_days"; // 취약과목: 전체 학습일, 전략과목: 주당 배정 일수
  weekly_days?: number; // 전략과목인 경우 주당 배정 일수 (2, 3, 4)
};

/**
 * 분할된 플랜 정보
 */
export type SplitInfo = {
  original_plan_id: string; // 원본 플랜 ID (분할된 플랜들을 연결)
  split_order: number; // 원본 플랜 내에서의 분할 순서
  total_split_count: number; // 전체 분할 개수
  total_duration: number; // 전체 소요시간 (모든 분할된 시간대의 합)
};

/**
 * 추가 기간 재배치 정보
 */
export type ReallocationInfo = {
  is_reallocated: boolean; // 재배치된 플랜 여부
  original_plan_id?: string; // 원본 플랜 ID
  original_period_start?: string; // 원본 플랜 기간 시작일
  original_period_end?: string; // 원본 플랜 기간 종료일
  review_of_review_factor?: number; // 복습의 복습 보정 계수
};

// ============================================
// 주요 도메인 타입
// ============================================

/**
 * 플랜 그룹 (메타데이터)
 */
export type PlanGroup = {
  id: string;
  tenant_id: string;
  student_id: string;
  name: string | null;
  plan_purpose: PlanPurpose | null;
  scheduler_type: SchedulerType | null;
  scheduler_options?: SchedulerOptions | null;
  period_start: string; // date
  period_end: string; // date
  target_date: string | null; // date (D-day)
  block_set_id: string | null;
  status: PlanStatus;
  deleted_at: string | null;
  daily_schedule?: DailyScheduleInfo[] | null; // JSONB: 일별 스케줄 정보 (Step7에서 생성)
  subject_constraints?: SubjectConstraints | null; // JSONB: 교과 제약 조건
  additional_period_reallocation?: AdditionalPeriodReallocation | null; // JSONB: 추가 기간 재배치 정보
  non_study_time_blocks?: NonStudyTimeBlock[] | null; // JSONB: 학습 시간 제외 항목
  study_hours?: StudyHours | null; // JSONB: 학습 시간 설정
  self_study_hours?: SelfStudyHours | null; // JSONB: 자율학습 시간 설정
  // 캠프 관련 필드
  plan_type?: PlanType | null;
  camp_template_id?: string | null;
  camp_invitation_id?: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * 개별 플랜 항목 (기존 구조 유지 + 1730 Timetable 확장)
 */
export type Plan = {
  id: string;
  tenant_id?: string | null;
  student_id: string;
  plan_group_id: string | null; // 플랜 그룹 참조
  origin_plan_item_id?: string | null; // 원본 논리 플랜 항목 참조 (Phase 2)
  plan_date: string;
  block_index: number;
  content_type: ContentType;
  content_id: string;
  chapter?: string | null;
  planned_start_page_or_time?: number | null;
  planned_end_page_or_time?: number | null;
  completed_amount?: number | null;
  progress?: number | null;
  start_time?: string | null; // HH:mm 형식 - 플랜 생성 시 계산된 시작 시간
  end_time?: string | null; // HH:mm 형식 - 플랜 생성 시 계산된 종료 시간
  is_reschedulable: boolean;
  // 1730 Timetable 추가 필드
  cycle_day_number?: number | null; // 주기 내 일자 번호
  date_type?: "study" | "review" | "exclusion" | null; // 날짜 유형
  time_slot_type?: "study" | "self_study" | null; // 시간대 유형
  duration_info?: DurationInfo | null; // JSONB: 소요시간 정보
  review_info?: ReviewInfo | null; // JSONB: 복습일 정보
  allocation_type?: AllocationType | null; // JSONB: 배정 방식 정보
  split_info?: SplitInfo | null; // JSONB: 분할된 플랜 정보
  reallocation_info?: ReallocationInfo | null; // JSONB: 추가 기간 재배치 정보
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * 플랜 그룹 콘텐츠 관계 (기존 테이블)
 */
export type PlanContent = {
  id: string;
  tenant_id: string;
  plan_group_id: string; // plan_groups 참조
  content_type: ContentType;
  content_id: string;
  master_content_id?: string | null; // 마스터 콘텐츠 ID (학생 콘텐츠가 마스터 콘텐츠와 연계된 경우)
  start_range: number;
  end_range: number;
  start_detail_id?: string | null; // 시작 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id)
  end_detail_id?: string | null; // 종료 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id)
  display_order: number;
  // 자동 추천 관련 필드
  is_auto_recommended?: boolean;
  recommendation_source?: "auto" | "admin" | "template" | null;
  recommendation_reason?: string | null;
  recommendation_metadata?: {
    scoreDetails?: {
      schoolGrade?: number | null;
      schoolAverageGrade?: number | null;
      mockPercentile?: number | null;
      mockGrade?: number | null;
      riskScore?: number;
    };
    priority?: number;
  } | null;
  recommended_at?: string | null;
  recommended_by?: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * 논리 플랜 아이템 (Phase 2 신규 테이블)
 * - 플랜그룹 내 학습 계획의 "설계" 단위
 * - student_plan은 이 테이블의 항목에서 파생된 "실행" 데이터
 * @see supabase/migrations/20251209000002_create_plan_group_items.sql
 */
export type PlanGroupItem = {
  id: string;
  tenant_id: string;
  plan_group_id: string; // plan_groups 참조
  content_type: ContentType;
  content_id: string;
  master_content_id?: string | null; // 마스터 콘텐츠 참조
  // 목표 범위
  target_start_page_or_time: number;
  target_end_page_or_time: number;
  // 분할/반복 전략
  repeat_count: number; // 몇 회차로 나눌지 (기본 1)
  split_strategy: "equal" | "custom" | "auto"; // 분할 전략
  // 플래그
  is_review: boolean; // 복습 항목 여부
  is_required: boolean; // 필수 여부
  // 순서/우선순위
  priority: number; // 높을수록 우선
  display_order: number; // 표시 순서
  // 메타데이터
  metadata?: {
    /** 사용자 지정 분할 범위 (split_strategy === 'custom'일 때) */
    custom_splits?: Array<{
      start: number;
      end: number;
    }>;
    /** 기타 확장 필드 */
    [key: string]: unknown;
  } | null;
  created_at: string;
  updated_at: string;
};

/**
 * 플랜 그룹 제외일 (학생별 전역 관리)
 */
export type PlanExclusion = {
  id: string;
  tenant_id: string;
  student_id: string; // students 참조 (플랜 그룹과 분리)
  plan_group_id: string | null; // plan_groups 참조 (NULL이면 시간 관리 영역의 제외일)
  exclusion_date: string; // date
  exclusion_type: ExclusionType;
  reason: string | null;
  created_at: string;
};

/**
 * 학원 (학생별 전역 관리)
 */
export type Academy = {
  id: string;
  tenant_id: string | null;
  student_id: string; // students 참조
  name: string; // 학원명
  travel_time: number; // 기본 이동시간 (분 단위)
  created_at: string;
  updated_at: string;
};

/**
 * 학원 일정 (학원별 요일별 시간대)
 */
export type AcademySchedule = {
  id: string;
  tenant_id: string | null;
  student_id: string; // students 참조 (플랜 그룹과 분리)
  academy_id: string; // academies 참조
  day_of_week: number; // 0-6 (일-토)
  start_time: string; // time
  end_time: string; // time
  subject: string | null; // 과목 (선택사항)
  created_at: string;
  updated_at: string;
  // 하위 호환성을 위한 필드 (deprecated)
  academy_name?: string | null;
  travel_time?: number | null;
};

/**
 * 캠프 템플릿
 */
export type CampTemplate = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  program_type: CampProgramType;
  template_data: Partial<WizardData> | null;
  status: "draft" | "active" | "archived";
  camp_start_date: string | null; // 캠프 시작일 (date)
  camp_end_date: string | null; // 캠프 종료일 (date)
  camp_location: string | null; // 캠프 장소
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * 캠프 초대
 */
export type CampInvitation = {
  id: string;
  tenant_id: string;
  camp_template_id: string;
  student_id: string;
  status: CampInvitationStatus;
  invited_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// 콘텐츠 관련 타입
// ============================================

/**
 * OCR 데이터 타입
 */
type OCRData = {
  text?: string;
  confidence?: number;
  bounding_boxes?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
};

/**
 * 페이지 분석 데이터 타입
 */
type PageAnalysis = {
  difficulty?: number;
  topics?: string[];
  keywords?: string[];
  summary?: string;
  [key: string]: unknown; // 확장 가능한 필드
};

/**
 * 에피소드 분석 데이터 타입
 */
type EpisodeAnalysis = {
  duration?: number;
  difficulty?: number;
  topics?: string[];
  summary?: string;
  [key: string]: unknown; // 확장 가능한 필드
};

/**
 * 공통 콘텐츠 필드 (교재/강의 공통)
 */
export type CommonContentFields = {
  id: string;
  tenant_id: string | null; // NULL이면 전체 기관 공통
  revision: string | null; // 개정 (2015개정 등)
  content_category: string | null; // 유형
  semester: string | null; // 학기 (고3-1 등) - 학생 콘텐츠용
  title: string;
  difficulty_level: string | null; // 난이도 (레거시, @deprecated: difficulty_level_id 사용 권장. getMasterBookById/getMasterLectureById에서 JOIN된 difficulty_levels.name으로 자동 덮어쓰기됨)
  notes: string | null; // 비고/메모
  updated_at: string;
  created_at: string;
};

/**
 * 마스터 콘텐츠 공통 필드 (semester 제외)
 */
export type MasterContentFields = Omit<CommonContentFields, "semester"> & {
  difficulty_level_id: string | null; // FK to difficulty_levels (우선 사용, getMasterBookById/getMasterLectureById에서 JOIN하여 difficulty_levels.name을 difficulty_level에 자동 반영)
};

/**
 * 서비스 마스터 교재
 */
export type MasterBook = MasterContentFields & {
  // 기본 상태
  is_active: boolean; // 활성화 상태
  
  // 교육과정 관련
  curriculum_revision_id: string | null; // 교육과정 개정판 ID (FK → curriculum_revisions)
  subject_id: string | null; // 과목 ID (FK → subjects)
  subject_group_id: string | null; // 교과 그룹 ID (FK → subject_groups, denormalized)
  subject_category: string | null; // 교과 그룹명 (denormalized, same as subject_groups.name)
  subject: string | null; // 과목명 (denormalized, same as subjects.name)
  grade_min: number | null; // 최소 학년 (1-3)
  grade_max: number | null; // 최대 학년 (1-3)
  school_type: string | null; // 학교 유형 (MIDDLE, HIGH, OTHER)
  
  // 교재 메타 정보
  subtitle: string | null; // 부제목
  series_name: string | null; // 시리즈명
  author: string | null; // 저자
  publisher_id: string | null; // 출판사 ID (FK → publishers)
  publisher_name: string | null; // 출판사명 (중복 저장)
  
  // ISBN 정보
  isbn_10: string | null; // ISBN-10 코드
  isbn_13: string | null; // ISBN-13 코드 (UNIQUE)
  
  // 출판 정보
  edition: string | null; // 판차
  published_date: string | null; // 출판일 (date)
  total_pages: number | null; // 총 페이지 (선택적)
  
  // 추가 교육 메타 정보
  target_exam_type: string[] | null; // 대상 시험 유형 (배열)
  
  // 설명 및 리뷰
  description: string | null; // 교재 설명
  toc: string | null; // 목차 (Table of Contents)
  publisher_review: string | null; // 출판사 리뷰
  tags: string[] | null; // 태그 (배열)
  
  // 출처 정보
  source: string | null; // 데이터 출처
  source_product_code: string | null; // 출처 상품 코드
  source_url: string | null; // 출처 URL
  cover_image_url: string | null; // 표지 이미지 URL
  
  // AI 분석 필드 (향후 확장용)
  pdf_url: string | null;
  ocr_data: OCRData | null; // JSONB
  page_analysis: PageAnalysis | null; // JSONB
  overall_difficulty: number | null; // 0.00 ~ 10.00
};

/**
 * 서비스 마스터 강의
 */
export type MasterLecture = MasterContentFields & {
  platform_name: string | null; // 플랫폼명 (레거시, platform → platform_name 변경)
  platform_id?: string | null; // 플랫폼 ID (우선 사용, FK to platforms)
  total_episodes: number; // 총 회차 (필수)
  total_duration: number | null; // 총 강의시간 (분 단위)
  linked_book_id: string | null; // 연결된 교재 ID (선택사항)

  // 교육과정 관련 (선택적)
  curriculum_revision_id: string | null; // 교육과정 개정판 ID (FK → curriculum_revisions)
  subject_id: string | null; // 과목 ID (FK → subjects)
  subject_group_id: string | null; // 교과 그룹 ID (FK → subject_groups, denormalized)

  // 강의 메타 정보
  instructor_name: string | null; // 강사명 (실제 DB 컬럼명)
  instructor?: string | null; // @deprecated instructor_name 사용 권장
  grade_level: string | null; // 학년 레벨
  grade_min: number | null; // 최소 학년 (1-3)
  grade_max: number | null; // 최대 학년 (1-3)
  lecture_type: string | null; // 강의 유형
  lecture_source_url: string | null; // 강의 출처 URL
  source_url: string | null; // 출처 URL (레거시)

  // 레거시 필드 (기존 코드 호환성 유지)
  platform?: string | null; // @deprecated platform_name 사용 권장
  subject?: string | null; // @deprecated CommonContentFields.subject 또는 subject_id 사용
  subject_category?: string | null; // @deprecated CommonContentFields.subject_category 사용

  // AI 분석 필드 (향후 확장용)
  video_url?: string | null;
  cover_image_url?: string | null; // 표지 이미지 URL
  transcript?: string | null;
  episode_analysis?: EpisodeAnalysis | null; // JSONB
  overall_difficulty?: number | null; // 0.00 ~ 10.00
};

/**
 * 서비스 마스터 커스텀 콘텐츠
 */
export type MasterCustomContent = MasterContentFields & {
  // 커스텀 콘텐츠 특화 필드
  content_type: string | null; // 콘텐츠 유형 ('book', 'lecture', 'worksheet', 'other')
  total_page_or_time: number | null; // 총 페이지 수 또는 시간(분)
  subject: string | null; // 과목명 (denormalized)
  subject_category: string | null; // 교과 그룹명 (denormalized)
  
  // 교육과정 관련 (선택적)
  curriculum_revision_id: string | null; // 교육과정 개정판 ID (FK → curriculum_revisions)
  subject_id: string | null; // 과목 ID (FK → subjects)
  subject_group_id: string | null; // 교과 그룹 ID (FK → subject_groups, denormalized)
  
  // 콘텐츠 URL
  content_url: string | null; // 콘텐츠 URL (PDF, 동영상, 문제집 등의 링크)
};

/**
 * 콘텐츠 마스터 (서비스 제공 교재/강의) - 레거시 타입 (하위 호환성)
 * @deprecated master_books, master_lectures로 분리됨. MasterBook 또는 MasterLecture 사용 권장
 */
export type ContentMaster = {
  id: string;
  tenant_id: string | null; // NULL이면 전체 공통
  content_type: "book" | "lecture";
  revision: string | null; // 개정
  content_category: string | null; // 유형
  // semester: string | null; // 학기 - 제거됨 (2025-02-04)
  subject_category: string | null; // 교과
  subject: string | null; // 과목
  title: string;
  publisher_or_academy: string | null;
  total_pages: number | null; // 교재
  total_episodes: number | null; // 강의
  difficulty_level: string | null;
  notes: string | null;
  updated_at: string;
  created_at: string;
};

/**
 * 교재 세부 정보 (대단원, 중단원, 페이지)
 */
export type BookDetail = {
  id: string;
  book_id: string; // master_books.id 참조
  major_unit: string | null; // 대단원
  minor_unit: string | null; // 중단원
  page_number: number;
  display_order: number;
  created_at: string;
};

/**
 * 강의 episode 정보
 */
export type LectureEpisode = {
  id: string;
  lecture_id: string; // master_lectures.id 참조
  episode_number: number; // 회차 번호
  episode_title: string | null; // 회차 제목 (실제 DB 컬럼명)
  title?: string | null; // 회차 제목 (호환성)
  duration: number | null; // 회차 시간 (초 단위)
  display_order: number;
  created_at: string;
  difficulty_level?: string | null;
  difficulty_score?: number | null;
  tags?: string[] | null;
  lecture_source_url?: string | null;
};

/**
 * 콘텐츠 마스터 세부 정보 (교재) - 레거시 타입 (하위 호환성)
 * @deprecated book_details로 변경됨. BookDetail 사용 권장
 */
export type ContentMasterDetail = {
  id: string;
  master_id: string;
  major_unit: string | null; // 대단원
  minor_unit: string | null; // 중단원
  page_number: number;
  display_order: number;
  created_at: string;
};

// ============================================
// 유틸리티 타입
// ============================================

/**
 * 플랜 상태 전이 규칙
 */
export type PlanStatusTransition = {
  from: PlanStatus;
  to: PlanStatus;
  allowed: boolean;
  condition?: string; // 전이 조건 설명
};

// ============================================
// 확장 타입 (타입 안전성 개선용)
// ============================================

/**
 * PlanContent에 start_detail_id, end_detail_id가 확실히 포함된 타입
 * DB 조회 시 해당 필드가 포함되지 않을 수 있으므로 별도 타입으로 정의
 */
export type PlanContentWithDetails = PlanContent & {
  start_detail_id?: string | null;
  end_detail_id?: string | null;
};

/**
 * SchedulerOptions와 TimeSettings를 통합한 타입
 * scheduler_options JSONB 필드에 TimeSettings가 병합되어 저장됨
 */
export type SchedulerOptionsWithTimeSettings = SchedulerOptions & TimeSettings;

/**
 * MasterBook에 JOIN된 데이터를 포함한 타입
 * Supabase JOIN 쿼리 결과를 타입 안전하게 처리하기 위한 타입
 */
export type MasterBookWithJoins = MasterBook & {
  curriculum_revisions?: Array<{ id: string; name: string }> | null;
  subjects?: Array<{
    id: string;
    name: string;
    subject_groups?: Array<{ id: string; name: string }> | null;
  }> | null;
  publishers?: Array<{ id: string; name: string }> | null;
  difficulty_levels?: Array<{ id: string; name: string }> | null;
};

/**
 * MasterLecture에 JOIN된 데이터를 포함한 타입
 * Supabase JOIN 쿼리 결과를 타입 안전하게 처리하기 위한 타입
 */
export type MasterLectureWithJoins = MasterLecture & {
  curriculum_revisions?: Array<{ id: string; name: string }> | null;
  subjects?: Array<{
    id: string;
    name: string;
    subject_groups?: Array<{ id: string; name: string }> | null;
  }> | null;
  difficulty_levels?: Array<{ id: string; name: string }> | null;
};

