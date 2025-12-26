/**
 * 플랜 생성 서비스 모듈
 *
 * 플랜 생성 관련 서비스들을 통합 export합니다.
 *
 * @module lib/domains/plan/services
 */

// 서비스 클래스
export {
  ContentResolutionService,
  createContentResolutionService,
} from "./contentResolutionService";

export {
  PlanPayloadBuilder,
  createPlanPayloadBuilder,
} from "./planPayloadBuilder";

export {
  PlanValidationService,
  createPlanValidationService,
} from "./planValidationService";

export {
  PlanPersistenceService,
  createPlanPersistenceService,
} from "./planPersistenceService";

// 타입
export type {
  // 서비스 컨텍스트
  PlanServiceContext,
  SupabaseAnyClient,

  // ContentResolutionService 타입
  ContentResolutionInput,
  ResolvedContent,
  ContentResolutionResult,
  ContentCopyFailure,

  // PlanPayloadBuilder 타입
  DailyScheduleItem,
  PayloadBuildInput,
  PayloadBuildResult,

  // PlanValidationService 타입
  ValidationError,
  ValidationWarning,
  ValidationResult,

  // PlanPersistenceService 타입
  PlanInsertResult,
  PlanInsertError,
  BatchInsertOptions,

  // 최종 결과 타입
  GeneratePlansResult,

  // 재export된 타입
  ContentIdMap,
  ContentMetadataMap,
  ContentDurationMap,
  DetailIdMap,
  ContentChapterMap,
  GeneratePlanPayload,
  DayType,
  PlanContent,
  ContentType,
} from "./types";
