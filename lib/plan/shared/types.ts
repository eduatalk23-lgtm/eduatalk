/**
 * 통합 플랜 서비스 타입 정의
 *
 * lib/plan/services/types.ts와 lib/domains/plan/services/types.ts를 통합합니다.
 * 모든 플랜 관련 서비스에서 공유되는 타입을 정의합니다.
 *
 * @module lib/plan/shared/types
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContentIdMap,
  ContentMetadataMap,
  ContentDurationMap,
  PlanPayloadBase,
  DayType,
  DateMetadataMap,
  DateAvailableTimeRangesMap,
} from "@/lib/types/plan-generation";
import type { ContentType, PlanContent } from "@/lib/types/plan";

// ============================================
// 기본 타입 정의
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseAnyClient = SupabaseClient<any>;

/**
 * Detail ID 매핑 (마스터 → 학생)
 */
export type DetailIdMap = Map<string, string>;

/**
 * 콘텐츠별 챕터 정보 맵
 */
export type ContentChapterMap = Map<string, string | null>;

// ============================================
// 서비스 컨텍스트 타입
// ============================================

/**
 * 간단한 서비스 컨텍스트 (lib/plan/services 호환)
 *
 * 단순한 작업에 사용됩니다.
 */
export interface ServiceContext {
  /** 학생 ID */
  studentId: string;
  /** 테넌트 ID */
  tenantId: string;
  /** 사용자 ID */
  userId: string;
  /** 역할 */
  role: "student" | "admin" | "consultant";
  /** 캠프 모드 여부 */
  isCampMode: boolean;
}

/**
 * 확장된 플랜 서비스 컨텍스트 (lib/domains/plan/services 호환)
 *
 * Supabase 클라이언트를 포함한 고급 작업에 사용됩니다.
 */
export interface PlanServiceContext {
  /** Supabase 클라이언트 (학생 데이터 조회용) */
  queryClient: SupabaseAnyClient;
  /** Supabase 클라이언트 (마스터 데이터 조회용) */
  masterQueryClient: SupabaseAnyClient;
  /** 학생 ID */
  studentId: string;
  /** 테넌트 ID */
  tenantId: string;
  /** 플랜 그룹 ID */
  groupId: string;
  /** 캠프 모드 여부 */
  isCampMode: boolean;
}

// ============================================
// 서비스 결과 타입
// ============================================

/**
 * 서비스 실행 결과
 */
export interface ServiceResult<T> {
  /** 성공 여부 */
  success: boolean;
  /** 결과 데이터 */
  data?: T;
  /** 에러 메시지 */
  error?: string;
  /** 에러 코드 */
  errorCode?: string;
}

// ============================================
// PlanPersistenceService 타입
// ============================================

/**
 * 플랜 페이로드 (DB 저장용)
 *
 * PlanPayloadBase와 호환되도록 chapter, start_time, end_time 등은
 * required 필드로 정의합니다.
 */
export interface GeneratePlanPayload {
  plan_group_id: string;
  student_id: string;
  tenant_id: string;
  plan_date: string;
  block_index: number;
  content_type: ContentType;
  content_id: string;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  chapter: string | null;
  start_time: string | null;
  end_time: string | null;
  day_type: DayType;
  week: number | null;
  day: number | null;
  is_partial: boolean;
  is_continued: boolean;
  plan_number: number | null;
  is_reschedulable: boolean;
  subject_type?: "strategy" | "weakness" | null;
  content_title: string | null;
  content_subject: string | null;
  content_subject_category: string | null;
  content_category: string | null;
  sequence: number | null;
  // 1730 Timetable 추가 필드
  cycle_day_number?: number | null;
  // 가상 플랜 필드
  is_virtual?: boolean;
  slot_index?: number;
  virtual_subject_category?: string;
  virtual_description?: string;
}

/**
 * 플랜 삽입 에러
 */
export interface PlanInsertError {
  /** 배치 인덱스 */
  batchIndex: number;
  /** 에러 메시지 */
  message: string;
  /** 원본 에러 */
  originalError?: unknown;
}

/**
 * 플랜 삽입 결과
 */
export interface PlanInsertResult {
  /** 성공 여부 */
  success: boolean;
  /** 삽입된 플랜 ID 목록 */
  insertedIds: string[];
  /** 삽입된 플랜 수 */
  insertedCount: number;
  /** 에러 목록 */
  errors: PlanInsertError[];
}

/**
 * 배치 삽입 옵션
 */
export interface BatchInsertOptions {
  /** 배치 크기 (기본값: 100) */
  batchSize?: number;
  /** 실패 시 롤백 여부 (기본값: true) */
  rollbackOnFailure?: boolean;
}

/**
 * 플랜 저장 서비스 입력 (Singleton 버전)
 */
export interface PlanPersistenceInput {
  plans: Array<
    PlanPayloadBase & {
      content_id: string;
      content_title?: string | null;
      content_subject?: string | null;
      content_subject_category?: string | null;
      content_category?: string | null;
    }
  >;
  planGroupId: string;
  context: ServiceContext;
  options?: {
    deleteExisting?: boolean;
    batchSize?: number;
    rollbackOnFailure?: boolean;
  };
}

/**
 * 플랜 저장 서비스 출력
 */
export interface PlanPersistenceOutput {
  savedCount: number;
  deletedCount: number;
}

// ============================================
// ContentResolutionService 타입
// ============================================

/**
 * 콘텐츠 해석 입력 (Singleton 버전)
 */
export interface ContentResolutionInput {
  contents: Array<{
    content_id: string;
    content_type: ContentType;
    start_detail_id?: string | null;
    end_detail_id?: string | null;
    start_range?: number | null;
    end_range?: number | null;
  }>;
  context: ServiceContext;
}

/**
 * 콘텐츠 해석 입력 (Context 버전)
 */
export interface ContentResolutionContextInput {
  /** plan_contents 배열 */
  contents: PlanContent[];
  /** 서비스 컨텍스트 */
  context: PlanServiceContext;
}

/**
 * 해석된 콘텐츠 정보
 */
export interface ResolvedContent {
  /** 원본 plan_contents의 content_id */
  originalContentId: string;
  /** 해석된 콘텐츠 ID (마스터 또는 학생 콘텐츠) */
  resolvedContentId: string;
  /** 학생 콘텐츠 ID (실제 사용할 ID) */
  studentContentId: string;
  /** 콘텐츠 타입 */
  contentType: ContentType;
  /** 마스터 콘텐츠에서 복사되었는지 여부 */
  isCopiedFromMaster: boolean;
  /** 복사 실패 이유 (있는 경우) */
  copyFailureReason?: string;
}

/**
 * 콘텐츠 복사 실패 정보
 */
export interface ContentCopyFailure {
  /** 원본 콘텐츠 ID */
  contentId: string;
  /** 콘텐츠 타입 */
  contentType: ContentType;
  /** 실패 이유 */
  reason: string;
}

/**
 * 콘텐츠 해석 결과 (Context 버전)
 */
export interface ContentResolutionResult {
  /** 해석된 콘텐츠 목록 */
  resolvedContents: ResolvedContent[];
  /** 콘텐츠 ID 매핑 (원본 → 학생) */
  contentIdMap: ContentIdMap;
  /** 상세 ID 매핑 (마스터 → 학생) - detail/episode */
  detailIdMap: DetailIdMap;
  /** 복사 실패 콘텐츠 */
  copyFailures: ContentCopyFailure[];
  /** 콘텐츠 메타데이터 맵 */
  metadataMap: ContentMetadataMap;
  /** 콘텐츠 소요시간 맵 */
  durationMap: ContentDurationMap;
  /** 챕터 정보 맵 */
  chapterMap: ContentChapterMap;
}

/**
 * 콘텐츠 해석 출력 (Singleton 버전)
 */
export interface ContentResolutionOutput {
  contentIdMap: ContentIdMap;
  detailIdMap: DetailIdMap;
  contentMetadataMap: ContentMetadataMap;
  contentDurationMap: ContentDurationMap;
  chapterMap: ContentChapterMap;
}

// ============================================
// 스케줄 생성 서비스 타입
// ============================================

/**
 * 스케줄된 플랜
 */
export interface ScheduledPlan {
  plan_date: string;
  block_index: number;
  content_type: ContentType;
  content_id: string;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  chapter?: string | null;
  is_reschedulable: boolean;
  start_time?: string;
  end_time?: string;
  subject_type?: "strategy" | "weakness" | null;
  date?: string;
  start_range?: number;
  end_range?: number;
  estimated_duration?: number;
  is_review?: boolean;
  day_type?: DayType;
  week_number?: number;
}

/**
 * 스케줄 생성 입력
 */
export interface ScheduleGenerationInput {
  contents: Array<{
    content_id: string;
    content_type: ContentType;
    start_range: number;
    end_range: number;
    estimated_duration: number;
    display_order: number;
  }>;
  availableDates: string[];
  dateMetadataMap: DateMetadataMap;
  options: {
    study_days: number;
    review_days: number;
    use1730Timetable?: boolean;
    weak_subject_focus?: "low" | "medium" | "high";
  };
}

/**
 * 스케줄 생성 출력
 */
export interface ScheduleGenerationOutput {
  scheduledPlans: ScheduledPlan[];
  weekDatesMap: Map<number, string[]>;
}

/**
 * 시간 할당 입력
 */
export interface TimeAllocationInput {
  scheduledPlans: ScheduledPlan[];
  dateTimeRanges: DateAvailableTimeRangesMap;
  contentDurationMap: ContentDurationMap;
}

/**
 * 시간 할당 출력
 */
export interface TimeAllocationOutput {
  allocatedPlans: Array<
    PlanPayloadBase & {
      content_id: string;
      date: string;
    }
  >;
  unallocatedPlans: ScheduledPlan[];
}

// ============================================
// 검증 서비스 타입
// ============================================

/**
 * 검증 에러
 */
export interface ValidationError {
  /** 에러 코드 */
  code: string;
  /** 에러 메시지 */
  message: string;
  /** 관련 필드 */
  field?: string;
  /** 관련 콘텐츠 ID */
  contentId?: string;
}

/**
 * 검증 경고
 */
export interface ValidationWarning {
  /** 경고 코드 */
  code: string;
  /** 경고 메시지 */
  message: string;
  /** 관련 필드 */
  field?: string;
  /** 관련 콘텐츠 ID */
  contentId?: string;
}

/**
 * 검증 결과
 */
export interface ValidationResult {
  /** 검증 통과 여부 */
  isValid: boolean;
  /** 에러 목록 */
  errors: ValidationError[];
  /** 경고 목록 */
  warnings: ValidationWarning[];
}

// ============================================
// 서비스 인터페이스
// ============================================

/**
 * 플랜 저장 서비스 인터페이스
 */
export interface IPlanPersistenceService {
  /**
   * 플랜을 데이터베이스에 저장
   */
  savePlans(
    input: PlanPersistenceInput
  ): Promise<ServiceResult<PlanPersistenceOutput>>;

  /**
   * 기존 플랜 삭제
   */
  deleteExistingPlans(
    planGroupId: string,
    context: ServiceContext
  ): Promise<ServiceResult<{ deletedCount: number }>>;
}

/**
 * 콘텐츠 해석 서비스 인터페이스
 */
export interface IContentResolutionService {
  /**
   * 콘텐츠 ID 해석 및 모든 메타데이터 로딩
   */
  resolve(
    input: ContentResolutionInput
  ): Promise<ServiceResult<ContentResolutionOutput>>;

  /**
   * 마스터 콘텐츠를 학생 콘텐츠로 복사 (캠프 모드)
   */
  copyMasterContents(
    contentIds: string[],
    contentType: ContentType,
    context: ServiceContext
  ): Promise<
    ServiceResult<{ contentIdMap: ContentIdMap; detailIdMap: DetailIdMap }>
  >;
}

/**
 * 스케줄 생성 서비스 인터페이스
 */
export interface IScheduleGenerationService {
  /**
   * 콘텐츠를 날짜별로 분배하여 스케줄 생성
   */
  generateSchedule(
    input: ScheduleGenerationInput
  ): Promise<ServiceResult<ScheduleGenerationOutput>>;
}

/**
 * 시간 할당 서비스 인터페이스
 */
export interface ITimeAllocationService {
  /**
   * 스케줄된 플랜에 시간 슬롯 할당
   */
  allocateTime(
    input: TimeAllocationInput
  ): Promise<ServiceResult<TimeAllocationOutput>>;
}

// ============================================
// 플랜 생성 오케스트레이터 타입
// ============================================

/**
 * 플랜 생성 오케스트레이터 입력
 */
export interface PlanGenerationOrchestratorInput {
  /** 플랜 그룹 ID */
  planGroupId: string;
  /** 서비스 컨텍스트 */
  context: ServiceContext;
  /** 생성 옵션 */
  options?: {
    /** 미리보기 모드 (저장하지 않음) */
    previewOnly?: boolean;
    /** 재생성 모드 (기존 플랜 삭제 후 생성) */
    regenerate?: boolean;
  };
}

/**
 * 플랜 생성 오케스트레이터 출력
 */
export interface PlanGenerationOrchestratorOutput {
  /** 성공 여부 */
  success: boolean;
  /** 미리보기 플랜 목록 (previewOnly 모드) */
  previewPlans?: PlanPayloadBase[];
  /** 저장된 플랜 수 (저장 모드) */
  savedCount?: number;
  /** 에러 목록 */
  errors?: string[];
  /** 경고 목록 */
  warnings?: string[];
}

/**
 * 플랜 생성 오케스트레이터 인터페이스
 */
export interface IPlanGenerationOrchestrator {
  /**
   * 플랜 생성 전체 프로세스 실행
   */
  generate(
    input: PlanGenerationOrchestratorInput
  ): Promise<ServiceResult<PlanGenerationOrchestratorOutput>>;
}

// ============================================
// 플랜 생성 결과 타입
// ============================================

/**
 * 플랜 생성 최종 결과
 */
export interface GeneratePlansResult {
  /** 성공 여부 */
  success: boolean;
  /** 생성된 플랜 수 */
  count: number;
  /** 에러 메시지 (실패 시) */
  error?: string;
  /** 경고 목록 */
  warnings?: string[];
  /** 콘텐츠 복사 실패 목록 */
  contentCopyFailures?: ContentCopyFailure[];
}

// ============================================
// Re-export 기존 타입
// ============================================

export type {
  ContentIdMap,
  ContentMetadataMap,
  ContentDurationMap,
  PlanPayloadBase,
  DayType,
  DateMetadataMap,
  DateAvailableTimeRangesMap,
} from "@/lib/types/plan-generation";

export type { ContentType, PlanContent } from "@/lib/types/plan";
