// 플랜 관련 타입 정의

/**
 * 플랜 목적
 */
export type PlanPurpose = "내신대비" | "모의고사" | "수능" | "기타";

/**
 * 스케줄러 유형
 */
export type SchedulerType = "자동스케줄러" | "1730_timetable";

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
  created_at: string;
  updated_at: string;
};

/**
 * 개별 플랜 항목 (기존 구조 유지)
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
  created_at?: string | null;
  updated_at?: string | null;
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
  start_range: number;
  end_range: number;
  display_order: number;
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
  subject_category: string | null; // 교과 (국어, 수학 등)
  subject: string | null; // 과목 (화법과 작문 등)
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
  publisher: string | null; // 출판사
  total_pages: number; // 총 페이지 (필수)
  // AI 분석 필드 (향후 확장용)
  pdf_url?: string | null;
  ocr_data?: any | null; // JSONB
  page_analysis?: any | null; // JSONB
  overall_difficulty?: number | null; // 0.00 ~ 10.00
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
 * 스케줄러 옵션
 */
export type SchedulerOptions = {
  // 자동 스케줄러
  difficulty_weight?: number;
  progress_weight?: number;
  score_weight?: number;
  weak_subject_focus?: "low" | "medium" | "high" | boolean;
  exam_urgency_enabled?: boolean;
  allow_consecutive?: boolean;
  // 1730 Timetable
  study_days?: number;
  review_days?: number;
  review_scope?: "full" | "partial";
};

/**
 * 플랜 그룹 생성 데이터
 */
export type PlanGroupCreationData = {
  name?: string | null;
  plan_purpose: PlanPurpose;
  scheduler_type: SchedulerType;
  scheduler_options?: SchedulerOptions | null;
  period_start: string; // date
  period_end: string; // date
  target_date?: string | null; // date
  block_set_id?: string | null;
  contents: PlanContentInput[];
  exclusions: PlanExclusionInput[];
  academy_schedules: AcademyScheduleInput[];
};

/**
 * 플랜 콘텐츠 입력
 */
export type PlanContentInput = {
  content_type: ContentType;
  content_id: string;
  start_range: number;
  end_range: number;
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
