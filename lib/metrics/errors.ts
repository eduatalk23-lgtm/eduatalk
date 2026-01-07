/**
 * Metrics 모듈 에러 타입 정의
 */

/**
 * Metrics 에러 코드
 */
export enum MetricsErrorCode {
  /** 데이터 조회 실패 */
  QUERY_FAILED = "METRICS_QUERY_FAILED",
  /** 데이터 변환 실패 */
  TRANSFORM_FAILED = "METRICS_TRANSFORM_FAILED",
  /** 유효하지 않은 파라미터 */
  INVALID_PARAMETER = "METRICS_INVALID_PARAMETER",
  /** 데이터 없음 */
  NO_DATA = "METRICS_NO_DATA",
  /** 알 수 없는 에러 */
  UNKNOWN = "METRICS_UNKNOWN",
}

/**
 * Metrics 에러 클래스
 * 
 * Metrics 모듈에서 발생하는 에러를 명시적으로 처리하기 위한 클래스입니다.
 */
export class MetricsError extends Error {
  constructor(
    message: string,
    public readonly code: MetricsErrorCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "MetricsError";
  }

  /**
   * 에러를 MetricsResult 형식으로 변환
   */
  toResult<T>(defaultValue: T): { success: false; error: string; code: string; details?: unknown } {
    return {
      success: false,
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

/**
 * MetricsError 생성 헬퍼 함수
 */
export function createMetricsError(
  message: string,
  code: MetricsErrorCode = MetricsErrorCode.UNKNOWN,
  details?: unknown
): MetricsError {
  return new MetricsError(message, code, details);
}

