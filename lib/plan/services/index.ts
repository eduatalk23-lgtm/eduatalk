/**
 * 플랜 생성 서비스 레이어
 *
 * Phase 2 리팩토링에서 사용할 서비스 인터페이스 및 구현체를 제공합니다.
 *
 * NOTE: ContentResolutionService와 PlanPersistenceService는
 * @/lib/plan/shared에서 re-export됩니다. 직접 import 시 shared를 권장합니다.
 *
 * @module lib/plan/services
 */

// 서비스 타입 및 인터페이스 (lib/plan/shared에서 re-export)
export type {
  // 공통
  ServiceResult,
  ServiceContext,
  // ContentResolutionService
  ContentResolutionInput,
  ContentResolutionOutput,
  IContentResolutionService,
  // ScheduleGenerationService
  ScheduleGenerationInput,
  ScheduleGenerationOutput,
  IScheduleGenerationService,
  // TimeAllocationService
  TimeAllocationInput,
  TimeAllocationOutput,
  ITimeAllocationService,
  // PlanPersistenceService
  PlanPersistenceInput,
  PlanPersistenceOutput,
  IPlanPersistenceService,
  // PlanGenerationOrchestrator
  PlanGenerationOrchestratorInput,
  PlanGenerationOrchestratorOutput,
  IPlanGenerationOrchestrator,
  // 추가 타입
  ScheduledPlan,
  ValidationError,
  ValidationWarning,
  ValidationResult,
  GeneratePlansResult,
} from "@/lib/plan/shared";

// ============================================
// 핵심 서비스 (lib/plan/shared에서 re-export)
// ============================================

export {
  ContentResolutionService,
  getContentResolutionService,
} from "@/lib/plan/shared";

export {
  PlanPersistenceService,
  getPlanPersistenceService,
} from "@/lib/plan/shared";

// ============================================
// 로컬 전용 서비스 (이 모듈에서만 제공)
// ============================================

export {
  ScheduleGenerationService,
  getScheduleGenerationService,
} from "./ScheduleGenerationService";

export {
  TimeAllocationService,
  getTimeAllocationService,
} from "./TimeAllocationService";

export {
  PlanGenerationOrchestrator,
  getPlanGenerationOrchestrator,
} from "./PlanGenerationOrchestrator";

// 서비스 어댑터 및 통합 함수
export {
  adaptContentResolution,
  adaptScheduleGeneration,
  adaptTimeAllocation,
  getAdapterConfig,
  DEFAULT_ADAPTER_CONFIG,
  type ServiceAdapterConfig,
  type ScheduleGenerationAdapterInput,
  type TimeAllocationAdapterInput,
} from "./ServiceAdapter";

export {
  generatePlansWithServices,
  canUseServiceBasedGeneration,
  type GeneratePlansWithServicesInput,
  type GeneratePlansWithServicesResult,
} from "./generatePlansWithServices";

export {
  previewPlansWithServices,
  type PreviewPlansWithServicesInput,
  type PreviewPlansWithServicesResult,
  type PreviewPlan,
} from "./previewPlansWithServices";

// Phase 5: 공통 로직 추출
export {
  preparePlanGenerationData,
  timeToMinutes,
  type PlanGenerationCommonInput,
  type PlanGenerationPreparedData,
  type PlanGenerationPreparedError,
  type PlanGenerationPreparedResult,
  type AllocatedPlanSegment,
  type DateMetadata,
  type DateAllocationResult,
  type AISchedulerOptionsOverride,
} from "./preparePlanGenerationData";

// Phase 4: 에러 및 로깅 시스템
export {
  ServiceError,
  ServiceErrorCodes,
  toServiceError,
  createServiceErrorFromResult,
  getErrorChain,
  isRecoverableServiceError,
  type ServiceErrorCode,
  type ServiceSource,
  type ServiceErrorContext,
} from "./errors";

export {
  ServiceLogger,
  PerformanceTracker,
  globalPerformanceTracker,
  createServiceLogger,
  configureLogger,
  withPerformanceTracking,
  type LogLevel,
  type LogEntry,
  type PerformanceMetric,
} from "./logging";
