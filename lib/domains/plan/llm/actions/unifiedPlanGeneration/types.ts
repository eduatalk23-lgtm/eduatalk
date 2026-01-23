/**
 * Unified Plan Generation Pipeline - Type Definitions
 *
 * 관리자 영역에서 AI 콜드스타트를 활용한 학습 플랜 생성 파이프라인의 타입 정의입니다.
 *
 * 파이프라인 흐름:
 * Stage 1: 입력 검증 → Stage 2: 콘텐츠 해결 → Stage 3: 스케줄러 컨텍스트 빌딩
 * → Stage 4: 스케줄 생성 → Stage 5: 검증/조정 → Stage 6: DB 저장 → Stage 7: 마크다운 출력
 */

import type { ScheduledPlan, ContentInfo } from "@/lib/plan/scheduler";
import type { RecommendationItem } from "@/lib/domains/plan/llm/actions/coldStart/types";
import type { OverlapValidationResult } from "@/lib/scheduler/types";

// ============================================================================
// 상수 정의
// ============================================================================

export const PLAN_PURPOSES = ["내신대비", "모의고사", "수능", "기타"] as const;
export type PlanPurpose = (typeof PLAN_PURPOSES)[number];

export const STUDENT_LEVELS = ["high", "medium", "low"] as const;
export type StudentLevel = (typeof STUDENT_LEVELS)[number];

export const SUBJECT_TYPES = ["strategy", "weakness"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const DISTRIBUTION_STRATEGIES = [
  "even",
  "front_loaded",
  "back_loaded",
] as const;
export type DistributionStrategy = (typeof DISTRIBUTION_STRATEGIES)[number];

export const DIFFICULTY_LEVELS = ["개념", "기본", "심화"] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const CONTENT_TYPES = ["book", "lecture"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

// ============================================================================
// 입력 타입 (Stage 1)
// ============================================================================

/**
 * 시간 범위 설정
 */
export interface TimeRange {
  start: string; // HH:mm
  end: string; // HH:mm
}

/**
 * 학원 일정 입력
 */
export interface AcademyScheduleInput {
  dayOfWeek: number; // 0-6 (일-토)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  name?: string;
  subject?: string;
}

/**
 * 제외일 입력
 */
export interface ExclusionInput {
  date: string; // YYYY-MM-DD
  reason?: string;
}

/**
 * 콘텐츠 선택 (AI 추천) 옵션
 */
export interface ContentSelectionInput {
  subjectCategory: string;
  subject?: string;
  difficulty?: DifficultyLevel;
  contentType?: ContentType;
  maxResults?: number;
}

/**
 * 1730 Timetable 설정
 */
export interface TimetableSettings {
  studyDays: number; // 1-7, 기본: 6
  reviewDays: number; // 0-3, 기본: 1
  studentLevel: StudentLevel;
  subjectType: SubjectType;
  weeklyDays?: 2 | 3 | 4; // strategy일 때 필수
  distributionStrategy?: DistributionStrategy; // 기본: even
}

/**
 * 생성 옵션
 */
export interface GenerationOptions {
  saveToDb?: boolean;
  generateMarkdown?: boolean;
  dryRun?: boolean;
}

/**
 * Unified Plan Generation 입력 (Raw)
 */
export interface UnifiedPlanGenerationInput {
  // 기본 정보
  studentId: string;
  tenantId: string;
  planName: string;
  planPurpose: PlanPurpose;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD

  // 시간 설정
  timeSettings: {
    studyHours: TimeRange;
    lunchTime?: TimeRange;
  };
  academySchedules?: AcademyScheduleInput[];
  exclusions?: ExclusionInput[];

  // 콘텐츠 선택 (AI 추천)
  contentSelection: ContentSelectionInput;

  // 1730 Timetable 설정
  timetableSettings: TimetableSettings;

  // 생성 옵션
  generationOptions?: GenerationOptions;

  // Phase 3: 플래너 연계 필드
  /** 연결할 플래너 ID (없으면 자동 생성) */
  plannerId?: string | null;
  /** 생성 모드 (DB CHECK 제약조건: wizard, content_based, template, camp, free_learning) */
  creationMode?: "wizard" | "content_based" | "template" | "camp" | "free_learning";
  /** 플래너 검증 모드 (기본값: "auto_create") */
  plannerValidationMode?: "warn" | "strict" | "auto_create";
}

/**
 * 검증된 입력 (Stage 1 출력)
 */
export interface ValidatedPlanInput {
  studentId: string;
  tenantId: string;
  planName: string;
  planPurpose: PlanPurpose;
  periodStart: string;
  periodEnd: string;
  timeSettings: {
    studyHours: TimeRange;
    lunchTime?: TimeRange;
  };
  academySchedules: AcademyScheduleInput[];
  exclusions: ExclusionInput[];
  contentSelection: ContentSelectionInput;
  timetableSettings: Required<Omit<TimetableSettings, "weeklyDays">> &
    Pick<TimetableSettings, "weeklyDays">;
  generationOptions: Required<GenerationOptions>;
  // 계산된 메타데이터
  totalDays: number;
  availableDays: number;

  // Phase 3: 플래너 연계 필드
  /** 연결할 플래너 ID (없으면 자동 생성) */
  plannerId?: string | null;
  /** 생성 모드 (DB CHECK 제약조건: wizard, content_based, template, camp, free_learning) */
  creationMode?: "wizard" | "content_based" | "template" | "camp" | "free_learning";
  /** 플래너 검증 모드 (기본값: "auto_create") */
  plannerValidationMode?: "warn" | "strict" | "auto_create";
}

// ============================================================================
// 콘텐츠 해결 (Stage 2)
// ============================================================================

/**
 * 해결된 콘텐츠 아이템
 */
export interface ResolvedContentItem {
  id: string;
  title: string;
  contentType: ContentType;
  totalRange: number;
  startRange: number;
  endRange: number;
  author?: string;
  publisher?: string;
  subject?: string;
  subjectCategory?: string;
  chapters?: Array<{
    title: string;
    startRange: number;
    endRange: number;
  }>;
  source: "ai_recommendation" | "db_cache";
  matchScore?: number;
  reason?: string;
  /** 평균 에피소드 시간 (분) - 강의 콘텐츠용 */
  averageEpisodeDurationMinutes?: number;
}

/**
 * 콘텐츠 해결 결과 (Stage 2 출력)
 */
export interface ContentResolutionResult {
  items: ResolvedContentItem[];
  strategy: "ai_recommendation" | "db_fallback";
  newlySaved: number;
  aiRecommendations?: RecommendationItem[];
}

// ============================================================================
// 스케줄러 컨텍스트 (Stage 3)
// ============================================================================

/**
 * 스케줄러 컨텍스트 빌드 결과 (Stage 3 출력)
 */
export interface SchedulerContextResult {
  contents: ContentInfo[];
  blocks: Array<{
    id: string;
    day_of_week: number;
    block_index: number;
    start_time: string;
    end_time: string;
    duration_minutes: number;
  }>;
  exclusions: Array<{
    id: string;
    exclusion_date: string;
    exclusion_type: string;
    reason: string | null;
  }>;
  academySchedules: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    subject: string | null;
  }>;
  subjectTypeMap: Map<string, SubjectType>;
  periodStart: string;
  periodEnd: string;
}

// ============================================================================
// 스케줄 생성 (Stage 4)
// ============================================================================

/**
 * 스케줄 생성 결과 (Stage 4 출력)
 */
export interface ScheduleGenerationResult {
  plans: ScheduledPlan[];
  cycleDays: Array<{
    date: string;
    dayType: "study" | "review" | "exclusion";
    cycleDayNumber: number;
  }>;
  failureReasons: Array<{
    code: string;
    message: string;
    context?: Record<string, unknown>;
  }>;
}

// ============================================================================
// 검증 및 조정 (Stage 5)
// ============================================================================

/**
 * 검증 경고
 */
export interface ValidationWarning {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  context?: Record<string, unknown>;
}

/**
 * 검증 및 조정 결과 (Stage 5 출력)
 */
export interface ValidationResult {
  isValid: boolean;
  plans: ScheduledPlan[];
  overlapValidation?: OverlapValidationResult;
  warnings: ValidationWarning[];
  autoAdjustedCount: number;
  unadjustablePlans: Array<{
    plan: ScheduledPlan;
    reason: string;
  }>;
}

// ============================================================================
// DB 저장 (Stage 6)
// ============================================================================

/**
 * Plan Group 정보
 */
export interface PlanGroupInfo {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  planCount: number;
}

/**
 * 저장 결과 (Stage 6 출력)
 */
export interface PersistenceResult {
  planGroup: PlanGroupInfo;
  savedPlanCount: number;
  savedContentIds: string[];
}

// ============================================================================
// 마크다운 출력 (Stage 7)
// ============================================================================

/**
 * 주간 스케줄 정보
 */
export interface WeeklySchedule {
  weekNumber: number;
  startDate: string;
  endDate: string;
  plans: Array<{
    date: string;
    dayOfWeek: string;
    startTime?: string;
    endTime?: string;
    contentTitle: string;
    rangeStart: number;
    rangeEnd: number;
    dayType: "study" | "review" | "exclusion" | null;
  }>;
}

/**
 * 마크다운 출력 데이터
 */
export interface MarkdownExportData {
  planName: string;
  periodStart: string;
  periodEnd: string;
  purpose: string;
  totalPlanCount: number;
  contents: Array<{
    title: string;
    contentType: string;
    range: string;
    source: string;
  }>;
  weeklySchedules: WeeklySchedule[];
  statistics: {
    totalStudyDays: number;
    totalAmount: number;
    dailyAverage: number;
  };
}

// ============================================================================
// 파이프라인 통합 타입
// ============================================================================

// P2-1: 공통 에러 타입 re-export
export type {
  PipelineErrorStage,
  PipelineErrorCode,
  PipelineWarning as CommonPipelineWarning,
  PipelineResultBase,
} from "@/lib/domains/plan/llm/types";

export {
  PIPELINE_ERROR_CODES,
  PIPELINE_ERROR_STAGES,
  createPipelineError,
  createPipelineWarning,
  extractErrorMessage,
} from "@/lib/domains/plan/llm/types";

/**
 * 파이프라인 실패 단계 (Unified 전용)
 *
 * @deprecated 공통 PipelineErrorStage 사용 권장
 */
export type PipelineFailureStage =
  | "validation"
  | "content_resolution"
  | "scheduler_context"
  | "schedule_generation"
  | "validation_adjustment"
  | "persistence"
  | "markdown_export";

/**
 * 파이프라인 성공 결과
 */
export interface UnifiedPlanGenerationSuccessOutput {
  success: true;
  planGroup?: PlanGroupInfo;
  plans: ScheduledPlan[];
  aiRecommendations?: {
    strategy: string;
    items: ResolvedContentItem[];
    newlySaved: number;
  };
  markdown?: string;
  validation: {
    warnings: ValidationWarning[];
    autoAdjustedCount: number;
    overlapValidation?: OverlapValidationResult;
  };
  // P2-1: 공통 필드 추가
  warnings?: import("@/lib/domains/plan/llm/types").PipelineWarning[];
}

/**
 * 파이프라인 실패 결과
 */
export interface UnifiedPlanGenerationFailureOutput {
  success: false;
  error: string;
  failedAt: PipelineFailureStage;
  details?: Record<string, unknown>;
  // P2-1: 에러 코드 추가
  errorCode?: import("@/lib/domains/plan/llm/types").PipelineErrorCode;
}

/**
 * 파이프라인 결과 (Union Type)
 */
export type UnifiedPlanGenerationOutput =
  | UnifiedPlanGenerationSuccessOutput
  | UnifiedPlanGenerationFailureOutput;

// ============================================================================
// 유틸리티 타입
// ============================================================================

/**
 * Stage 결과 Wrapper
 */
export type StageResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: Record<string, unknown> };

/**
 * 파이프라인 컨텍스트 (내부용)
 */
export interface PipelineContext {
  input: ValidatedPlanInput;
  contentResolution?: ContentResolutionResult;
  /** 콘텐츠별 에피소드 시간 맵 (Stage 5 검증용) */
  contentDurations?: Map<string, number>;
  schedulerContext?: SchedulerContextResult;
  scheduleGeneration?: ScheduleGenerationResult;
  validation?: ValidationResult;
  persistence?: PersistenceResult;
}
