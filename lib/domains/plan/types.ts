/**
 * Plan 도메인 타입 정의
 *
 * Supabase Database 타입에서 파생됩니다.
 * @see lib/supabase/database.types.ts
 */

import type {
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  Json,
} from "@/lib/supabase/database.types";
import type { PlanGroup as DomainPlanGroup } from "@/lib/types/plan/domain";

// ============================================
// Database 타입에서 파생된 타입
// ============================================

/**
 * 플랜 그룹 타입 (도메인 타입 사용)
 */
export type PlanGroup = DomainPlanGroup;

/**
 * 플랜 그룹 생성 입력 타입
 */
export type PlanGroupInsert = TablesInsert<"plan_groups">;

/**
 * 플랜 그룹 수정 입력 타입
 */
export type PlanGroupUpdate = TablesUpdate<"plan_groups">;

/**
 * 학생 플랜 타입
 */
export type StudentPlan = Tables<"student_plan">;

/**
 * 학생 플랜 생성 입력 타입
 */
export type StudentPlanInsert = TablesInsert<"student_plan">;

/**
 * 학생 플랜 수정 입력 타입
 */
export type StudentPlanUpdate = TablesUpdate<"student_plan">;

/**
 * 플랜 콘텐츠 타입
 */
export type PlanContent = Tables<"plan_contents">;

/**
 * 플랜 콘텐츠 생성 입력 타입
 */
export type PlanContentInsert = TablesInsert<"plan_contents">;

/**
 * 플랜 콘텐츠 수정 입력 타입
 */
export type PlanContentUpdate = TablesUpdate<"plan_contents">;

/**
 * 플랜 제외일 타입
 */
export type PlanExclusion = Tables<"plan_exclusions">;

/**
 * 플랜 제외일 생성 입력 타입
 */
export type PlanExclusionInsert = TablesInsert<"plan_exclusions">;

/**
 * 플랜 제외일 수정 입력 타입
 */
export type PlanExclusionUpdate = TablesUpdate<"plan_exclusions">;

/**
 * 테넌트 블록 세트 타입
 */
export type BlockSet = Tables<"tenant_block_sets">;

/**
 * 테넌트 블록 세트 생성 입력 타입
 */
export type BlockSetInsert = TablesInsert<"tenant_block_sets">;

/**
 * 테넌트 블록 세트 수정 입력 타입
 */
export type BlockSetUpdate = TablesUpdate<"tenant_block_sets">;

/**
 * 테넌트 블록 타입
 */
export type Block = Tables<"tenant_blocks">;

/**
 * 테넌트 블록 생성 입력 타입
 */
export type BlockInsert = TablesInsert<"tenant_blocks">;

/**
 * 테넌트 블록 수정 입력 타입
 */
export type BlockUpdate = TablesUpdate<"tenant_blocks">;

/**
 * 학원 타입
 */
export type Academy = Tables<"academies">;

/**
 * 학원 생성 입력 타입
 */
export type AcademyInsert = TablesInsert<"academies">;

/**
 * 학원 수정 입력 타입
 */
export type AcademyUpdate = TablesUpdate<"academies">;

/**
 * 학원 일정 타입
 */
export type AcademySchedule = Tables<"academy_schedules">;

/**
 * 학원 일정 생성 입력 타입
 */
export type AcademyScheduleInsert = TablesInsert<"academy_schedules">;

/**
 * 학원 일정 수정 입력 타입
 */
export type AcademyScheduleUpdate = TablesUpdate<"academy_schedules">;

// ============================================
// Enum 타입
// ============================================

/**
 * 콘텐츠 타입
 */
export type ContentType = Enums<"content_type_enum">;

/**
 * 플랜 상태 (Supabase enum)
 */
export type PlanStatusEnum = Enums<"plan_status_enum">;

/**
 * 플랜 타입 (string literal type - re-exported from @/lib/types/plan)
 * @see lib/types/plan/domain.ts
 */
export type { PlanType } from "@/lib/types/plan";

// ============================================
// JSONB 필드 타입 (스키마에서 파생)
// ============================================

/**
 * 일별 스케줄 정보
 */
export type DailyScheduleInfo = {
  date: string;
  day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정";
  study_hours: number;
  time_slots?: Array<{
    type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
    start: string;
    end: string;
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
    travel_time?: number;
  }>;
  // 1730 Timetable 주기 정보
  week_number?: number | null;
  cycle_day_number?: number | null;
};

/**
 * 스케줄러 옵션
 */
export type SchedulerOptions = {
  weak_subject_focus?: "low" | "medium" | "high" | boolean;
  study_days?: number;
  review_days?: number;
};

/**
 * 교과 제약 조건
 */
export type SubjectConstraints = {
  required_subjects?: Array<{
    subject_group_id: string;
    subject_category: string;
    min_count: number;
    subjects_by_curriculum?: Array<{
      curriculum_revision_id: string;
      subject_id?: string;
      subject_name?: string;
    }>;
  }>;
  excluded_subjects?: string[];
  constraint_handling: "strict" | "warning" | "auto_fix";
};

/**
 * 추가 기간 재배치 설정
 */
export type AdditionalPeriodReallocation = {
  period_start: string;
  period_end: string;
  type: "additional_review";
  original_period_start: string;
  original_period_end: string;
  subjects?: string[];
  review_of_review_factor?: number;
};

/**
 * 학습 시간 제외 항목
 */
export type NonStudyTimeBlock = {
  type: "아침식사" | "점심식사" | "저녁식사" | "수면" | "기타";
  start_time: string;
  end_time: string;
  day_of_week?: number[];
  description?: string;
};

/**
 * 학습 시간 설정
 */
export type StudyHours = {
  start_time: string;
  end_time: string;
};

/**
 * 자율학습 시간 설정
 */
export type SelfStudyHours = {
  enabled: boolean;
  start_time: string;
  end_time: string;
  allow_on_holiday?: boolean;
};

// ============================================
// 비즈니스 로직용 타입
// ============================================

/**
 * 플랜 그룹 조회 필터
 */
export type PlanGroupFilters = {
  studentId: string;
  tenantId?: string | null;
  status?: string | string[];
  planPurpose?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  includeDeleted?: boolean;
};

/**
 * 플랜 상태 필터
 */
export type PlanStatusFilter =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped"
  | "postponed";

/**
 * 진행률 필터
 */
export type ProgressFilter = {
  /** 최소 진행률 (0-100) */
  min?: number;
  /** 최대 진행률 (0-100) */
  max?: number;
};

/**
 * 정렬 옵션
 */
export type PlanSortOption = {
  field: "plan_date" | "progress" | "created_at" | "updated_at" | "block_index";
  direction: "asc" | "desc";
};

/**
 * 학생 플랜 조회 필터
 */
export type StudentPlanFilters = {
  studentId: string;
  tenantId?: string | null;
  dateRange?: {
    start: string;
    end: string;
  };
  planDate?: string;
  contentType?: ContentType;
  planGroupIds?: string[];
  /** 플랜 상태 필터 (단일 또는 배열) */
  status?: PlanStatusFilter | PlanStatusFilter[];
  /** 진행률 필터 */
  progress?: ProgressFilter;
  /** 정렬 옵션 (기본: plan_date asc, block_index asc) */
  orderBy?: PlanSortOption[];
  /** 조회 개수 제한 */
  limit?: number;
  /** 오프셋 (페이지네이션) */
  offset?: number;
};

// ============================================
// 응답 타입
// ============================================

/**
 * 플랜 그룹 생성 결과
 */
export type PlanGroupCreateResult = {
  success: boolean;
  error?: string;
  planGroupId?: string;
  planGroup?: PlanGroup;
};

/**
 * 플랜 그룹 수정 결과
 */
export type PlanGroupUpdateResult = {
  success: boolean;
  error?: string;
  planGroup?: PlanGroup;
};

/**
 * 플랜 액션 결과
 */
export type PlanActionResult = {
  success: boolean;
  error?: string;
  planId?: string;
};

// ============================================
// 레거시 타입 별칭 (하위 호환성)
// ============================================

/**
 * Plan 타입 별칭 (StudentPlan과 동일)
 * @deprecated StudentPlan 사용 권장
 */
export type Plan = StudentPlan;

// ============================================
// lib/types/plan.ts 타입 re-export (하위 호환성)
// ============================================

export type {
  PlanPurpose,
  PlanStatus,
  SchedulerType,
  ExclusionType,
  StudentLevel,
  StudyReviewCycle,
  TimeSettings,
  DurationInfo,
  ReviewInfo,
  AllocationType,
  SplitInfo,
  ReallocationInfo,
  SubjectAllocation,
  PlanGroupCreationData,
  PlanContentInput,
  PlanExclusionInput,
  AcademyInput,
  AcademyScheduleInput,
  PlanFilters,
  PlanStatusTransition,
  // 캠프 관련
  CampTemplate,
  CampInvitation,
  CampProgramType,
  CampInvitationStatus,
  // 콘텐츠 관련
  ContentMaster,
  MasterBook,
  MasterLecture,
  BookDetail,
  LectureEpisode,
} from "@/lib/types/plan";
