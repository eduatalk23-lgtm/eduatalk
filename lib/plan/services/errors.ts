/**
 * 플랜 생성 서비스 레이어 통합 에러 시스템
 *
 * Phase 4: 안정화 - 에러 처리 통일
 * - 모든 서비스에서 일관된 에러 타입 사용
 * - 에러 컨텍스트 전파
 * - 상세한 디버깅 정보 포함
 *
 * @module lib/plan/services/errors
 */

import {
  PlanGroupError,
  PlanGroupErrorCodes,
  type PlanGroupErrorCode,
} from "@/lib/errors/planGroupErrors";
import type { PlanGenerationFailureReason } from "@/lib/errors/planGenerationErrors";

/**
 * 서비스 레이어 에러 코드
 */
export const ServiceErrorCodes = {
  // 콘텐츠 해석 서비스
  CONTENT_RESOLUTION_FAILED: "CONTENT_RESOLUTION_FAILED",
  CONTENT_ID_MAPPING_FAILED: "CONTENT_ID_MAPPING_FAILED",
  CONTENT_METADATA_LOAD_FAILED: "CONTENT_METADATA_LOAD_FAILED",
  CONTENT_DURATION_LOAD_FAILED: "CONTENT_DURATION_LOAD_FAILED",
  CONTENT_CHAPTER_LOAD_FAILED: "CONTENT_CHAPTER_LOAD_FAILED",
  MASTER_CONTENT_COPY_FAILED: "MASTER_CONTENT_COPY_FAILED",

  // 스케줄 생성 서비스
  SCHEDULE_GENERATION_FAILED: "SCHEDULE_GENERATION_FAILED",
  NO_AVAILABLE_DATES: "NO_AVAILABLE_DATES",
  CONTENT_ALLOCATION_FAILED: "CONTENT_ALLOCATION_FAILED",

  // 시간 할당 서비스
  TIME_ALLOCATION_FAILED: "TIME_ALLOCATION_FAILED",
  INSUFFICIENT_TIME_SLOTS: "INSUFFICIENT_TIME_SLOTS",

  // 저장 서비스
  PLAN_PERSISTENCE_FAILED: "PLAN_PERSISTENCE_FAILED",
  PLAN_DELETE_FAILED: "PLAN_DELETE_FAILED",
  PLAN_INSERT_FAILED: "PLAN_INSERT_FAILED",

  // 오케스트레이터
  ORCHESTRATION_FAILED: "ORCHESTRATION_FAILED",
  SERVICE_CHAIN_FAILED: "SERVICE_CHAIN_FAILED",

  // 클라이언트 관련
  CLIENT_CREATION_FAILED: "CLIENT_CREATION_FAILED",
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",

  // 데이터 관련
  INVALID_INPUT: "INVALID_INPUT",
  DATA_VALIDATION_FAILED: "DATA_VALIDATION_FAILED",
} as const;

export type ServiceErrorCode =
  (typeof ServiceErrorCodes)[keyof typeof ServiceErrorCodes];

/**
 * 에러 발생 서비스 식별자
 */
export type ServiceSource =
  | "ContentResolutionService"
  | "ScheduleGenerationService"
  | "TimeAllocationService"
  | "PlanPersistenceService"
  | "PlanGenerationOrchestrator"
  | "ServiceAdapter"
  | "Unknown";

/**
 * 에러 컨텍스트 타입
 * 디버깅 및 모니터링에 필요한 정보를 담습니다.
 */
export type ServiceErrorContext = {
  /** 에러 발생 서비스 */
  source: ServiceSource;
  /** 에러 발생 메서드 */
  method?: string;
  /** 작업 식별자 (플랜 그룹 ID 등) */
  operationId?: string;
  /** 학생 ID */
  studentId?: string;
  /** 테넌트 ID */
  tenantId?: string;
  /** 타임스탬프 */
  timestamp: string;
  /** 실행 시간 (ms) */
  duration?: number;
  /** 이전 에러 (체인된 에러) */
  cause?: ServiceError | Error;
  /** 추가 데이터 */
  metadata?: Record<string, unknown>;
};

/**
 * 서비스 레이어 통합 에러 클래스
 *
 * 모든 서비스에서 이 에러 클래스를 사용하여 일관된 에러 처리를 합니다.
 */
export class ServiceError extends Error {
  public readonly code: ServiceErrorCode | PlanGroupErrorCode;
  public readonly userMessage: string;
  public readonly recoverable: boolean;
  public readonly context: ServiceErrorContext;
  public readonly failureReason?: PlanGenerationFailureReason;

  constructor(
    message: string,
    code: ServiceErrorCode | PlanGroupErrorCode,
    context: Partial<ServiceErrorContext> & { source: ServiceSource },
    options?: {
      userMessage?: string;
      recoverable?: boolean;
      failureReason?: PlanGenerationFailureReason;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = "ServiceError";

    this.code = code;
    this.userMessage =
      options?.userMessage ?? getDefaultUserMessage(code);
    this.recoverable = options?.recoverable ?? false;
    this.failureReason = options?.failureReason;

    this.context = {
      ...context,
      timestamp: context.timestamp ?? new Date().toISOString(),
      cause: options?.cause,
    };

    // Error 클래스의 stack trace를 올바르게 유지
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ServiceError);
    }
  }

  /**
   * PlanGroupError로 변환
   */
  toPlanGroupError(): PlanGroupError {
    return new PlanGroupError(
      this.message,
      this.code,
      this.userMessage,
      this.recoverable,
      {
        ...this.context,
        metadata: this.context.metadata,
      },
      this.failureReason
    );
  }

  /**
   * 직렬화 가능한 객체로 변환 (로깅용)
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      userMessage: this.userMessage,
      recoverable: this.recoverable,
      context: {
        ...this.context,
        cause: this.context.cause
          ? {
              name: this.context.cause.name,
              message: this.context.cause.message,
            }
          : undefined,
      },
      failureReason: this.failureReason,
      stack: this.stack,
    };
  }
}

/**
 * 에러 코드에 따른 기본 사용자 메시지
 */
function getDefaultUserMessage(
  code: ServiceErrorCode | PlanGroupErrorCode
): string {
  const messages: Partial<Record<ServiceErrorCode | PlanGroupErrorCode, string>> = {
    // 서비스 레이어 에러
    [ServiceErrorCodes.CONTENT_RESOLUTION_FAILED]:
      "콘텐츠 정보를 불러오는 데 실패했습니다.",
    [ServiceErrorCodes.CONTENT_ID_MAPPING_FAILED]:
      "콘텐츠 ID 매핑에 실패했습니다.",
    [ServiceErrorCodes.CONTENT_METADATA_LOAD_FAILED]:
      "콘텐츠 메타데이터 로딩에 실패했습니다.",
    [ServiceErrorCodes.CONTENT_DURATION_LOAD_FAILED]:
      "콘텐츠 소요시간 계산에 실패했습니다.",
    [ServiceErrorCodes.CONTENT_CHAPTER_LOAD_FAILED]:
      "챕터 정보 로딩에 실패했습니다.",
    [ServiceErrorCodes.MASTER_CONTENT_COPY_FAILED]:
      "마스터 콘텐츠 복사에 실패했습니다.",
    [ServiceErrorCodes.SCHEDULE_GENERATION_FAILED]:
      "스케줄 생성에 실패했습니다.",
    [ServiceErrorCodes.NO_AVAILABLE_DATES]:
      "학습 가능한 날짜가 없습니다.",
    [ServiceErrorCodes.CONTENT_ALLOCATION_FAILED]:
      "콘텐츠 배정에 실패했습니다.",
    [ServiceErrorCodes.TIME_ALLOCATION_FAILED]:
      "시간 할당에 실패했습니다.",
    [ServiceErrorCodes.INSUFFICIENT_TIME_SLOTS]:
      "학습 시간이 부족합니다.",
    [ServiceErrorCodes.PLAN_PERSISTENCE_FAILED]:
      "플랜 저장에 실패했습니다.",
    [ServiceErrorCodes.PLAN_DELETE_FAILED]:
      "기존 플랜 삭제에 실패했습니다.",
    [ServiceErrorCodes.PLAN_INSERT_FAILED]:
      "플랜 저장에 실패했습니다.",
    [ServiceErrorCodes.ORCHESTRATION_FAILED]:
      "플랜 생성 프로세스에 실패했습니다.",
    [ServiceErrorCodes.SERVICE_CHAIN_FAILED]:
      "서비스 처리 중 오류가 발생했습니다.",
    [ServiceErrorCodes.CLIENT_CREATION_FAILED]:
      "데이터베이스 연결에 실패했습니다.",
    [ServiceErrorCodes.AUTHENTICATION_FAILED]:
      "인증에 실패했습니다.",
    [ServiceErrorCodes.INVALID_INPUT]:
      "입력값이 올바르지 않습니다.",
    [ServiceErrorCodes.DATA_VALIDATION_FAILED]:
      "데이터 검증에 실패했습니다.",
  };

  return messages[code] ?? "플랜 생성 중 오류가 발생했습니다.";
}

/**
 * 일반 Error를 ServiceError로 변환
 */
export function toServiceError(
  error: unknown,
  source: ServiceSource,
  options?: {
    code?: ServiceErrorCode;
    method?: string;
    operationId?: string;
    studentId?: string;
    tenantId?: string;
    metadata?: Record<string, unknown>;
  }
): ServiceError {
  // 이미 ServiceError인 경우
  if (error instanceof ServiceError) {
    // context 업데이트가 필요하면 새 인스턴스 생성
    if (options?.operationId || options?.studentId || options?.tenantId) {
      return new ServiceError(error.message, error.code, {
        ...error.context,
        operationId: options.operationId ?? error.context.operationId,
        studentId: options.studentId ?? error.context.studentId,
        tenantId: options.tenantId ?? error.context.tenantId,
      });
    }
    return error;
  }

  // PlanGroupError인 경우
  if (error instanceof PlanGroupError) {
    return new ServiceError(
      error.message,
      error.code as ServiceErrorCode | PlanGroupErrorCode,
      {
        source,
        method: options?.method,
        operationId: options?.operationId,
        studentId: options?.studentId,
        tenantId: options?.tenantId,
        timestamp: new Date().toISOString(),
        metadata: {
          ...(error.context ?? {}),
          ...options?.metadata,
        },
      },
      {
        userMessage: error.userMessage,
        recoverable: error.recoverable,
        failureReason: Array.isArray(error.failureReason)
          ? error.failureReason[0]
          : error.failureReason,
        cause: error,
      }
    );
  }

  // 일반 Error인 경우
  if (error instanceof Error) {
    return new ServiceError(
      error.message,
      options?.code ?? ServiceErrorCodes.ORCHESTRATION_FAILED,
      {
        source,
        method: options?.method,
        operationId: options?.operationId,
        studentId: options?.studentId,
        tenantId: options?.tenantId,
        timestamp: new Date().toISOString(),
        metadata: options?.metadata,
      },
      {
        cause: error,
      }
    );
  }

  // 알 수 없는 에러 타입
  return new ServiceError(
    String(error),
    options?.code ?? ServiceErrorCodes.ORCHESTRATION_FAILED,
    {
      source,
      method: options?.method,
      operationId: options?.operationId,
      studentId: options?.studentId,
      tenantId: options?.tenantId,
      timestamp: new Date().toISOString(),
      metadata: { originalError: error, ...options?.metadata },
    }
  );
}

/**
 * ServiceResult의 에러를 ServiceError로 변환
 */
export function createServiceErrorFromResult<T>(
  result: { success: false; error?: string; errorCode?: string },
  source: ServiceSource,
  options?: {
    method?: string;
    operationId?: string;
    studentId?: string;
    tenantId?: string;
    metadata?: Record<string, unknown>;
  }
): ServiceError {
  return new ServiceError(
    result.error ?? "알 수 없는 오류",
    (result.errorCode as ServiceErrorCode) ?? ServiceErrorCodes.ORCHESTRATION_FAILED,
    {
      source,
      method: options?.method,
      operationId: options?.operationId,
      studentId: options?.studentId,
      tenantId: options?.tenantId,
      timestamp: new Date().toISOString(),
      metadata: options?.metadata,
    }
  );
}

/**
 * 에러 체인 추적
 * 에러의 원인 체인을 배열로 반환합니다.
 */
export function getErrorChain(error: ServiceError): Array<{
  source: ServiceSource;
  code: string;
  message: string;
}> {
  const chain: Array<{
    source: ServiceSource;
    code: string;
    message: string;
  }> = [];

  let current: Error | undefined = error;

  while (current) {
    if (current instanceof ServiceError) {
      chain.push({
        source: current.context.source,
        code: current.code,
        message: current.message,
      });
      current = current.context.cause;
    } else {
      chain.push({
        source: "Unknown",
        code: "UNKNOWN",
        message: current.message,
      });
      break;
    }
  }

  return chain;
}

/**
 * 에러가 복구 가능한지 확인
 */
export function isRecoverableServiceError(error: unknown): boolean {
  if (error instanceof ServiceError) {
    return error.recoverable;
  }
  if (error instanceof PlanGroupError) {
    return error.recoverable;
  }
  return false;
}
