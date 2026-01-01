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
  PlanMode,
  DayType,
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

// 유틸리티 함수 및 타입
export {
  canStartLearning,
  isVirtualPlan,
  isPlanCompleted,
} from "./utils";
export type { LearningStartInfo } from "./utils";

// Timezone 타입 (달력 기반 플랜 생성 시스템)
export type {
  // 타임존 상태 및 기본 타입
  TimezoneStatus,
  Timezone,
  TimezoneWithContents,
  CreateTimezoneInput,
  TimezoneFilters,
  // 콘텐츠 스케줄러 타입
  ContentSchedulerMode,
  ContentSchedulerOptions,
  ContentGenerationStatus,
  PlanContentWithScheduler,
  // 달력 뷰 타입
  AvailableDate,
  TimeSlot,
  AllocatedContent,
  TimezoneCalendarData,
  // 플랜 미리보기 타입
  PlanPreview,
  AddContentInput,
  // 복습 그룹 타입
  ReviewGroup,
  ReviewSourcePlan,
  // 보조 타입
  DailyScheduleInfo as TimezoneDailyScheduleInfo,
  ExclusionInput,
  AcademyScheduleInput as TimezoneAcademyScheduleInput,
  AcademyScheduleInfo,
  StudentPlanSummary,
} from "./timezone";

// Completion 타입 (간단 완료 모드)
export type {
  CompletionMode,
  SimpleCompletionData,
  TimerCompletionData,
  CompletionInfo,
  StudentPlanPermissions,
} from "./completion";
export {
  DEFAULT_STUDENT_PERMISSIONS,
  getCompletionInfo,
  getAdHocCompletionInfo,
  isCompleted,
  isAdHocCompleted,
  getCompletedAt,
  parseStudentPermissions,
} from "./completion";

// Content-based PlanGroup 타입 (4단계 간소화 플로우)
export type {
  // 기본 타입
  StudyType,
  CreationMode,
  RangeUnit,
  // 템플릿 상속 설정
  InheritedTemplateSettings,
  // 콘텐츠별 플랜그룹 생성
  CreateContentPlanGroupInput,
  GeneratedPlan,
  ContentPlanGroupResult,
  ContentPlanGroupSummary,
  // 미리보기
  PlanPreviewItem,
  ContentPlanGroupPreview,
  // 9개 제한 관리
  ContentPlanGroupCount,
  // 확장된 PlanGroup 타입
  ContentBasedPlanGroup,
  // 액션 파라미터
  GetTemplateSettingsParams,
  PreviewContentPlanGroupParams,
} from "./contentPlanGroup";

// View 타입 (다중 뷰 시스템)
export type {
  ViewType,
  SlotType,
  MatrixTimeSlot,
  TimeSlotRow,
  PlanView,
  PlanViewRow,
  ViewSettings,
  DayOfWeek,
  MatrixCell,
  MatrixPlanItem,
  MatrixViewData,
  ViewContextState,
  ViewContextActions,
  ViewContextValue,
} from "./views";
export {
  VIEW_TYPE_CONFIG,
  DEFAULT_VIEW_SETTINGS,
  toMatrixTimeSlot,
  toPlanView,
} from "./views";
