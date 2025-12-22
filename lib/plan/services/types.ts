/**
 * 플랜 생성 서비스 레이어 타입 정의
 *
 * Phase 2에서 사용할 서비스 인터페이스를 정의합니다.
 * 기존 코드에 영향을 주지 않고 새 구조를 준비합니다.
 *
 * @module lib/plan/services/types
 */

import type {
  ContentIdMap,
  ContentMetadataMap,
  ContentDurationMap,
  DateMetadataMap,
  DateAvailableTimeRangesMap,
  PlanPayloadBase,
  DayType,
} from "@/lib/types/plan-generation";
import type { ContentType } from "@/lib/types/plan";

// 로컬 타입 정의 (기존 함수 시그니처와 호환)
export type DetailIdMap = Map<string, string>;
export type ContentChapterMap = Map<string, string | null>;

// 스케줄된 플랜 (스케줄러 출력 - scheduler.ts와 호환)
export type ScheduledPlan = {
  plan_date: string;
  block_index: number;
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  chapter?: string | null;
  is_reschedulable: boolean;
  start_time?: string;
  end_time?: string;
  subject_type?: "strategy" | "weakness" | null;
  // 서비스 레이어에서 추가되는 필드
  date?: string;
  start_range?: number;
  end_range?: number;
  estimated_duration?: number;
  is_review?: boolean;
  day_type?: DayType;
  week_number?: number;
};

// ============================================
// 서비스 공통 타입
// ============================================

/**
 * 서비스 실행 결과
 */
export type ServiceResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
};

/**
 * 서비스 컨텍스트 (모든 서비스에서 공유)
 */
export type ServiceContext = {
  studentId: string;
  tenantId: string;
  userId: string;
  role: "student" | "admin" | "consultant";
  isCampMode: boolean;
};

// ============================================
// ContentResolutionService
// ============================================

/**
 * 콘텐츠 해석 서비스 입력
 */
export type ContentResolutionInput = {
  contents: Array<{
    content_id: string;
    content_type: ContentType;
    start_detail_id?: string | null;
    end_detail_id?: string | null;
    start_range?: number | null;
    end_range?: number | null;
  }>;
  context: ServiceContext;
};

/**
 * 콘텐츠 해석 서비스 출력
 */
export type ContentResolutionOutput = {
  contentIdMap: ContentIdMap;
  detailIdMap: DetailIdMap;
  contentMetadataMap: ContentMetadataMap;
  contentDurationMap: ContentDurationMap;
  chapterMap: ContentChapterMap;
};

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
  ): Promise<ServiceResult<{ contentIdMap: ContentIdMap; detailIdMap: DetailIdMap }>>;
}

// ============================================
// ScheduleGenerationService
// ============================================

/**
 * 스케줄 생성 서비스 입력
 */
export type ScheduleGenerationInput = {
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
};

/**
 * 스케줄 생성 서비스 출력
 */
export type ScheduleGenerationOutput = {
  scheduledPlans: ScheduledPlan[];
  weekDatesMap: Map<number, string[]>;
};

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

// ============================================
// TimeAllocationService
// ============================================

/**
 * 시간 할당 서비스 입력
 */
export type TimeAllocationInput = {
  scheduledPlans: ScheduledPlan[];
  dateTimeRanges: DateAvailableTimeRangesMap;
  contentDurationMap: ContentDurationMap;
};

/**
 * 시간 할당 서비스 출력
 */
export type TimeAllocationOutput = {
  allocatedPlans: Array<
    PlanPayloadBase & {
      content_id: string;
      date: string;
    }
  >;
  unallocatedPlans: ScheduledPlan[];
};

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
// PlanPersistenceService
// ============================================

/**
 * 플랜 저장 서비스 입력
 */
export type PlanPersistenceInput = {
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
  };
};

/**
 * 플랜 저장 서비스 출력
 */
export type PlanPersistenceOutput = {
  savedCount: number;
  deletedCount: number;
};

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

// ============================================
// PlanGenerationOrchestrator
// ============================================

/**
 * 플랜 생성 오케스트레이터 입력
 */
export type PlanGenerationOrchestratorInput = {
  planGroupId: string;
  context: ServiceContext;
  options?: {
    regenerate?: boolean;
    previewOnly?: boolean;
  };
};

/**
 * 플랜 생성 오케스트레이터 출력
 */
export type PlanGenerationOrchestratorOutput = {
  success: boolean;
  savedCount?: number;
  previewPlans?: PlanPayloadBase[];
  errors?: string[];
};

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

  /**
   * 플랜 미리보기
   */
  preview(
    input: Omit<PlanGenerationOrchestratorInput, "options">
  ): Promise<ServiceResult<{ previewPlans: PlanPayloadBase[] }>>;
}
