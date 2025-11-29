// 플랜 관련 타입 정의

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
 * 캠프 템플릿
 */
export type CampTemplate = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  program_type: CampProgramType;
  template_data: any; // WizardData 구조의 JSON (Partial<WizardData>)
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
export type ExclusionType = "휴가" | "개인사정" | "휴일지정" | "기타";

/**
 * 콘텐츠 타입
 */
export type ContentType = "book" | "lecture" | "custom";

/**
 * 플랜 그룹 (메타데이터)
 */
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

/**
 * 플랜 그룹 콘텐츠 관계
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
 * 플랜 그룹 제외일 (학생별 전역 관리)
 */
export type PlanExclusion = {
  id: string;
  tenant_id: string;
  student_id: string; // students 참조 (플랜 그룹과 분리)
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
 * 공통 콘텐츠 필드 (교재/강의 공통)
 */
export type CommonContentFields = {
  id: string;
  tenant_id: string | null; // NULL이면 전체 기관 공통
  revision: string | null; // 개정 (2015개정 등)
  content_category: string | null; // 유형
  semester: string | null; // 학기 (고3-1 등)
  title: string;
  difficulty_level: string | null; // 난이도
  notes: string | null; // 비고/메모
  updated_at: string;
  created_at: string;
};

/**
 * 서비스 마스터 교재
 */
export type MasterBook = CommonContentFields & {
  // 기본 상태
  is_active: boolean; // 활성화 상태
  
  // 교육과정 관련
  curriculum_revision_id: string | null; // 교육과정 개정판 ID (FK → curriculum_revisions)
  subject_id: string | null; // 과목 ID (FK → subjects)
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
  ocr_data: any | null; // JSONB
  page_analysis: any | null; // JSONB
  overall_difficulty: number | null; // 0.00 ~ 10.00
};

/**
 * 서비스 마스터 강의
 */
export type MasterLecture = CommonContentFields & {
  platform: string | null; // 플랫폼 (메가스터디, EBSi 등)
  total_episodes: number; // 총 회차 (필수)
  total_duration: number | null; // 총 강의시간 (분 단위)
  linked_book_id: string | null; // 연결된 교재 ID (선택사항)
  // AI 분석 필드 (향후 확장용)
  video_url?: string | null;
  transcript?: string | null;
  episode_analysis?: any | null; // JSONB
  overall_difficulty?: number | null; // 0.00 ~ 10.00
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
  semester: string | null; // 학기
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
  episode_title: string | null; // 회차 제목
  duration: number | null; // 회차 시간 (분 단위)
  display_order: number;
  created_at: string;
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
 * 학생 수준
 */
export type StudentLevel = "high" | "medium" | "low";

/**
 * 전략과목/취약과목 정보
 */
export type SubjectAllocation = {
  subject_id: string;
  subject_name: string;
  subject_type: "strategy" | "weakness";
  weekly_days?: number; // 전략과목인 경우: 2, 3, 4
};

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
};

/**
 * 플랜 상태 전이 규칙
 */
export type PlanStatusTransition = {
  from: PlanStatus;
  to: PlanStatus;
  allowed: boolean;
  condition?: string; // 전이 조건 설명
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
