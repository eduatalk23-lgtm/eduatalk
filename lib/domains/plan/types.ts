/**
 * Plan 도메인 타입 정의
 *
 * 기존 lib/types/plan.ts를 re-export 합니다.
 * 도메인 내부에서 사용하는 추가 타입은 여기에 정의합니다.
 */

// 기존 타입 re-export
export type {
  PlanPurpose,
  PlanType,
  PlanStatus,
  SchedulerType,
  ContentType,
  ExclusionType,
  StudentLevel,
  PlanGroup,
  Plan,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
  Academy,
  DailyScheduleInfo,
  SchedulerOptions,
  StudyReviewCycle,
  StudyHours,
  SelfStudyHours,
  SubjectConstraints,
  SubjectAllocation,
  AdditionalPeriodReallocation,
  NonStudyTimeBlock,
  TimeSettings,
  DurationInfo,
  ReviewInfo,
  AllocationType,
  SplitInfo,
  ReallocationInfo,
  PlanGroupCreationData,
  PlanContentInput,
  PlanExclusionInput,
  AcademyInput,
  AcademyScheduleInput,
  PlanFilters,
  CampTemplate,
  CampInvitation,
  CampProgramType,
  CampInvitationStatus,
} from "@/lib/types/plan";

// ============================================
// 도메인 내부 추가 타입
// ============================================

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
 * 플랜 그룹 생성 결과
 */
export type PlanGroupCreateResult = {
  success: boolean;
  error?: string;
  planGroupId?: string;
  planGroup?: any; // PlanGroup
};

/**
 * 플랜 그룹 수정 결과
 */
export type PlanGroupUpdateResult = {
  success: boolean;
  error?: string;
  planGroup?: any; // PlanGroup
};

/**
 * 플랜 CUD 결과
 */
export type PlanActionResult = {
  success: boolean;
  error?: string;
  planId?: string;
};

/**
 * 플랜 목록 조회 필터
 */
export type StudentPlanFilters = {
  studentId: string;
  tenantId?: string | null;
  dateRange?: {
    start: string;
    end: string;
  };
  planDate?: string;
  contentType?: "book" | "lecture" | "custom";
  planGroupIds?: string[];
};

