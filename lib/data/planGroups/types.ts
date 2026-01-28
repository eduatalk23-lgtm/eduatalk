/**
 * 플랜 그룹 관련 타입 정의
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PlanGroup,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
  SchedulerOptions,
  SubjectConstraints,
  AdditionalPeriodReallocation,
  NonStudyTimeBlock,
  DailyScheduleInfo,
  PlanContentWithDetails,
  ExclusionType,
} from "@/lib/types/plan";
import type { ContentSlot } from "@/lib/types/content-selection";
import type { Database } from "@/lib/supabase/database.types";

// Database 타입에서 테이블 타입 추출
export type PlanGroupInsert = Database["public"]["Tables"]["plan_groups"]["Insert"];
export type PlanGroupUpdate = Database["public"]["Tables"]["plan_groups"]["Update"];

/**
 * 플랜 그룹 생성 시 사용하는 payload 타입
 */
export type PlanGroupPayload = {
  tenant_id: string;
  student_id: string;
  name: string | null;
  plan_purpose: string | null;
  scheduler_type: string | null;
  scheduler_options?: SchedulerOptions | null;
  period_start: string;
  period_end: string;
  target_date: string | null;
  block_set_id: string | null;
  status: string;
  subject_constraints?: SubjectConstraints | null;
  additional_period_reallocation?: AdditionalPeriodReallocation | null;
  non_study_time_blocks?: NonStudyTimeBlock[] | null;
  daily_schedule?: DailyScheduleInfo[] | null;
  plan_type?: string | null;
  camp_template_id?: string | null;
  camp_invitation_id?: string | null;
  // 2단계 콘텐츠 선택 시스템 (슬롯 모드)
  use_slot_mode?: boolean;
  content_slots?: ContentSlot[] | null;
  // 캘린더 우선 생성 지원
  is_calendar_only?: boolean;
  content_status?: "pending" | "partial" | "complete";
  schedule_generated_at?: string | null;
};

/**
 * 플랜 그룹 필터 옵션
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
 * 플랜 그룹 통계 (getPlanGroupsWithStats 반환용)
 */
export type PlanGroupStats = {
  planCount: number;
  completedCount: number;
  totalCount: number;
  isCompleted: boolean;
  statusBreakdown: {
    pending: number;
    inProgress: number;
    completed: number;
  };
};

/**
 * 플랜 그룹 상세 통계 (전체 통계용)
 */
export type PlanGroupDetailedStats = {
  id: string;
  name: string | null;
  status: string;
  period_start: string;
  period_end: string;
  totalPlans: number;
  completedPlans: number;
  inProgressPlans: number;
  pendingPlans: number;
  totalMinutes: number;
  completedMinutes: number;
  progressRate: number;
};

/**
 * 플랜 그룹 콘텐츠 요약
 */
export type PlanGroupContentSummary = {
  bookCount: number;
  lectureCount: number;
  customCount: number;
  adHocCount: number;
  totalContentCount: number;
  contentNames: string[];
};

// =============================================
// 플랜 그룹 백업 관련 타입
// =============================================

/**
 * 플랜 그룹 백업 테이블 레코드 타입
 */
export type PlanGroupBackup = {
  id: string;
  plan_group_id: string;
  student_id: string;
  tenant_id: string;
  backup_data: PlanGroupBackupData;
  deleted_by: string | null;
  created_at: string;
  restored_at: string | null;
  restored_by: string | null;
};

/**
 * 백업 데이터 내부 구조
 */
export type PlanGroupBackupData = {
  plan_group: {
    id: string;
    name: string | null;
    plan_purpose: string | null;
    scheduler_type: string | null;
    scheduler_options: SchedulerOptions | null;
    period_start: string;
    period_end: string;
    target_date: string | null;
    block_set_id: string | null;
    status: string;
    planner_id?: string | null;
    created_at: string;
    updated_at: string;
  };
  contents: Array<{
    content_type: string;
    content_id: string;
    start_range: number | null;
    end_range: number | null;
    display_order: number | null;
  }>;
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason: string | null;
  }>;
  academy_schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name: string | null;
    subject: string | null;
  }>;
  plans: Array<{
    plan_date: string;
    block_index: number | null;
    content_type: string;
    content_id: string | null;
    chapter: string | null;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    completed_amount: number | null;
    is_reschedulable: boolean | null;
    start_time: string | null;
    end_time: string | null;
    status?: string;
  }>;
  progress: Array<{
    plan_id: string;
    content_id: string;
    progress_percentage: number;
    completed_pages: number | null;
    total_pages: number | null;
  }>;
  deleted_at: string;
  deleted_by: string;
};

/**
 * 삭제된 플랜 그룹 정보 (목록 조회용)
 */
export type DeletedPlanGroupInfo = {
  id: string;
  planGroupId: string;
  name: string | null;
  planPurpose: string | null;
  periodStart: string;
  periodEnd: string;
  status: string;
  deletedAt: string;
  planCount: number;
  contentCount: number;
  isRestored: boolean;
  plannerId?: string | null;
};

/**
 * 플랜 그룹 복원 결과
 */
export type RestorePlanGroupResult = {
  success: boolean;
  groupId?: string;
  restoredPlansCount?: number;
  error?: string;
};

/**
 * 삭제된 플랜 그룹 목록 조회 옵션
 */
export type GetDeletedPlanGroupsOptions = {
  studentId: string;
  tenantId?: string;
  plannerId?: string;
  offset?: number;
  limit?: number;
  includeRestored?: boolean;
};

// Re-export types for convenience
export type {
  PlanGroup,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
  SchedulerOptions,
  SubjectConstraints,
  AdditionalPeriodReallocation,
  NonStudyTimeBlock,
  DailyScheduleInfo,
  PlanContentWithDetails,
  ExclusionType,
  ContentSlot,
  SupabaseClient,
};
