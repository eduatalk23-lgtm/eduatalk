/**
 * Plan 타입 통합 Export
 * 
 * 이 파일은 모든 plan 관련 타입을 re-export하여 하위 호환성을 유지합니다.
 * 기존 코드에서 @/lib/types/plan을 import하는 경우에도 동작합니다.
 * 
 * 타입 구조:
 * - schema.ts: Supabase DB 테이블과 1:1 매핑 타입
 * - domain.ts: 비즈니스 로직 타입 (PlanGroup, Plan, PlanContent 등)
 * - input.ts: 폼 입력 및 API 요청 타입
 */

// Schema 타입 (DB 테이블 타입)
export type {
  PlanGroupRow,
  PlanGroupInsert,
  PlanGroupUpdate,
  PlanContentRow,
  PlanContentInsert,
  PlanContentUpdate,
  PlanExclusionRow,
  PlanExclusionInsert,
  PlanExclusionUpdate,
  AcademyScheduleRow,
  AcademyScheduleInsert,
  AcademyScheduleUpdate,
  StudentPlanRow,
  StudentPlanInsert,
  StudentPlanUpdate,
  CampTemplateRow,
  CampTemplateInsert,
  CampTemplateUpdate,
  CampInvitationRow,
  CampInvitationInsert,
  CampInvitationUpdate,
} from "./schema";

// Domain 타입 (비즈니스 로직 타입)
export type {
  // Enum 타입
  PlanPurpose,
  PlanType,
  CampProgramType,
  CampInvitationStatus,
  SchedulerType,
  PlanStatus,
  ExclusionType,
  ContentType,
  StudentLevel,
  // JSONB 필드 타입 (PlanGroup)
  DailyScheduleInfo,
  StudyReviewCycle,
  StudyHours,
  SelfStudyHours,
  RequiredSubject,
  SubjectConstraints,
  AdditionalPeriodReallocation,
  NonStudyTimeBlock,
  SchedulerOptions,
  TimeSettings,
  SubjectAllocation,
  // JSONB 필드 타입 (Plan)
  DurationInfo,
  ReviewInfo,
  AllocationType,
  SplitInfo,
  ReallocationInfo,
  // 주요 도메인 타입
  PlanGroup,
  Plan,
  PlanContent,
  PlanGroupItem,
  PlanExclusion,
  Academy,
  AcademySchedule,
  CampTemplate,
  CampInvitation,
  // 콘텐츠 관련 타입
  CommonContentFields,
  MasterContentFields,
  MasterBook,
  MasterLecture,
  MasterCustomContent,
  ContentMaster,
  BookDetail,
  LectureEpisode,
  ContentMasterDetail,
  // 확장 타입 (JOIN 결과)
  PlanContentWithDetails,
  MasterBookWithJoins,
  MasterLectureWithJoins,
  // 유틸리티 타입
  PlanStatusTransition,
} from "./domain";

// Input 타입 (폼 입력 및 API 요청 타입)
export type {
  PlanGroupCreationData,
  PlanContentInput,
  PlanExclusionInput,
  AcademyInput,
  AcademyScheduleInput,
  PlanGroupItemInput,
  TemplateLockedFields,
  PlanFilters,
} from "./input";

