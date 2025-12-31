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
