/**
 * 통합 플랜 서비스 모듈
 *
 * lib/plan/services와 lib/domains/plan/services의 핵심 서비스들을
 * 통합하여 제공합니다.
 *
 * @module lib/plan/shared
 */

// ============================================
// 서비스 클래스
// ============================================

// PlanPersistenceService
export {
  PlanPersistenceService,
  PlanPersistenceServiceWithContext,
  getPlanPersistenceService,
  createPlanPersistenceService,
  createPlanServiceContext,
  PlanPersistenceErrorCodes,
  type PlanPersistenceErrorCode,
} from "./PlanPersistenceService";

// ContentResolutionService
export {
  ContentResolutionService,
  ContentResolutionServiceWithContext,
  getContentResolutionService,
  createContentResolutionService,
  ContentResolutionErrorCodes,
  type ContentResolutionErrorCode,
} from "./ContentResolutionService";

// ============================================
// 타입 정의
// ============================================

export type {
  // 기본 타입
  SupabaseAnyClient,
  DetailIdMap,
  ContentChapterMap,

  // 서비스 컨텍스트
  ServiceContext,
  PlanServiceContext,

  // 서비스 결과
  ServiceResult,

  // PlanPersistenceService 타입
  GeneratePlanPayload,
  PlanInsertError,
  PlanInsertResult,
  BatchInsertOptions,
  PlanPersistenceInput,
  PlanPersistenceOutput,
  IPlanPersistenceService,

  // ContentResolutionService 타입
  ContentResolutionInput,
  ContentResolutionContextInput,
  ResolvedContent,
  ContentCopyFailure,
  ContentResolutionResult,
  ContentResolutionOutput,
  IContentResolutionService,

  // 스케줄 타입
  ScheduledPlan,
  ScheduleGenerationInput,
  ScheduleGenerationOutput,
  TimeAllocationInput,
  TimeAllocationOutput,
  IScheduleGenerationService,
  ITimeAllocationService,

  // 검증 타입
  ValidationError,
  ValidationWarning,
  ValidationResult,

  // 플랜 생성 오케스트레이터 타입
  PlanGenerationOrchestratorInput,
  PlanGenerationOrchestratorOutput,
  IPlanGenerationOrchestrator,

  // 플랜 생성 결과
  GeneratePlansResult,

  // Re-exported 타입
  ContentIdMap,
  ContentMetadataMap,
  ContentDurationMap,
  PlanPayloadBase,
  DayType,
  DateMetadataMap,
  DateAvailableTimeRangesMap,
  ContentType,
  PlanContent,
} from "./types";
