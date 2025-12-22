/**
 * 플랜 생성 서비스 레이어 로깅 및 성능 모니터링 시스템
 *
 * Phase 4: 안정화 - 로깅 표준화 및 성능 모니터링
 * - 구조화된 로깅
 * - 성능 측정
 * - 에러 추적
 *
 * @module lib/plan/services/logging
 */

import { ServiceError, type ServiceSource } from "./errors";

/**
 * 로그 레벨
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * 로그 엔트리 타입
 */
export type LogEntry = {
  level: LogLevel;
  source: ServiceSource;
  method: string;
  message: string;
  timestamp: string;
  duration?: number;
  operationId?: string;
  studentId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
};

/**
 * 성능 메트릭 타입
 */
export type PerformanceMetric = {
  source: ServiceSource;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  operationId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * 로그 설정
 */
type LoggerConfig = {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableMetrics: boolean;
  metricsCallback?: (metric: PerformanceMetric) => void;
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * 기본 로거 설정
 */
const defaultConfig: LoggerConfig = {
  minLevel: process.env.NODE_ENV === "production" ? "info" : "debug",
  enableConsole: true,
  enableMetrics: true,
};

let config: LoggerConfig = { ...defaultConfig };

/**
 * 로거 설정 변경
 */
export function configureLogger(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * 구조화된 로그 출력
 */
function log(entry: LogEntry): void {
  if (LOG_LEVELS[entry.level] < LOG_LEVELS[config.minLevel]) {
    return;
  }

  if (!config.enableConsole) {
    return;
  }

  const prefix = `[${entry.source}${entry.method ? `.${entry.method}` : ""}]`;
  const durationStr = entry.duration !== undefined ? ` (${entry.duration}ms)` : "";

  const baseMessage = `${prefix} ${entry.message}${durationStr}`;

  // 메타데이터 포함한 상세 정보
  const details: Record<string, unknown> = {};

  if (entry.operationId) {
    details.operationId = entry.operationId;
  }
  if (entry.studentId) {
    details.studentId = entry.studentId;
  }
  if (entry.tenantId) {
    details.tenantId = entry.tenantId;
  }
  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    details.metadata = entry.metadata;
  }
  if (entry.error) {
    details.error = entry.error;
  }

  const hasDetails = Object.keys(details).length > 0;

  switch (entry.level) {
    case "debug":
      if (hasDetails) {
        console.debug(baseMessage, details);
      } else {
        console.debug(baseMessage);
      }
      break;
    case "info":
      if (hasDetails) {
        console.info(baseMessage, details);
      } else {
        console.info(baseMessage);
      }
      break;
    case "warn":
      if (hasDetails) {
        console.warn(baseMessage, details);
      } else {
        console.warn(baseMessage);
      }
      break;
    case "error":
      if (hasDetails) {
        console.error(baseMessage, details);
      } else {
        console.error(baseMessage);
      }
      break;
  }
}

/**
 * 서비스 로거 클래스
 *
 * 각 서비스에서 인스턴스를 생성하여 사용합니다.
 */
export class ServiceLogger {
  private source: ServiceSource;
  private operationId?: string;
  private studentId?: string;
  private tenantId?: string;

  constructor(
    source: ServiceSource,
    context?: {
      operationId?: string;
      studentId?: string;
      tenantId?: string;
    }
  ) {
    this.source = source;
    this.operationId = context?.operationId;
    this.studentId = context?.studentId;
    this.tenantId = context?.tenantId;
  }

  /**
   * 컨텍스트 업데이트
   */
  setContext(context: {
    operationId?: string;
    studentId?: string;
    tenantId?: string;
  }): void {
    if (context.operationId) this.operationId = context.operationId;
    if (context.studentId) this.studentId = context.studentId;
    if (context.tenantId) this.tenantId = context.tenantId;
  }

  /**
   * 디버그 로그
   */
  debug(method: string, message: string, metadata?: Record<string, unknown>): void {
    log({
      level: "debug",
      source: this.source,
      method,
      message,
      timestamp: new Date().toISOString(),
      operationId: this.operationId,
      studentId: this.studentId,
      tenantId: this.tenantId,
      metadata,
    });
  }

  /**
   * 정보 로그
   */
  info(method: string, message: string, metadata?: Record<string, unknown>): void {
    log({
      level: "info",
      source: this.source,
      method,
      message,
      timestamp: new Date().toISOString(),
      operationId: this.operationId,
      studentId: this.studentId,
      tenantId: this.tenantId,
      metadata,
    });
  }

  /**
   * 경고 로그
   */
  warn(method: string, message: string, metadata?: Record<string, unknown>): void {
    log({
      level: "warn",
      source: this.source,
      method,
      message,
      timestamp: new Date().toISOString(),
      operationId: this.operationId,
      studentId: this.studentId,
      tenantId: this.tenantId,
      metadata,
    });
  }

  /**
   * 에러 로그
   */
  error(
    method: string,
    message: string,
    error?: Error | ServiceError,
    metadata?: Record<string, unknown>
  ): void {
    const errorDetails = error
      ? {
          code: error instanceof ServiceError ? error.code : "UNKNOWN",
          message: error.message,
          stack: error.stack,
        }
      : undefined;

    log({
      level: "error",
      source: this.source,
      method,
      message,
      timestamp: new Date().toISOString(),
      operationId: this.operationId,
      studentId: this.studentId,
      tenantId: this.tenantId,
      metadata,
      error: errorDetails,
    });
  }
}

/**
 * 성능 측정기 클래스
 *
 * 메서드 실행 시간을 측정하고 메트릭을 수집합니다.
 */
export class PerformanceTracker {
  private metrics: PerformanceMetric[] = [];
  private activeOperations: Map<string, PerformanceMetric> = new Map();

  /**
   * 작업 시작
   */
  start(
    source: ServiceSource,
    method: string,
    operationId?: string,
    metadata?: Record<string, unknown>
  ): string {
    const trackingId = `${source}.${method}.${Date.now()}.${Math.random().toString(36).slice(2, 9)}`;

    const metric: PerformanceMetric = {
      source,
      method,
      startTime: performance.now(),
      success: false,
      operationId,
      metadata,
    };

    this.activeOperations.set(trackingId, metric);
    return trackingId;
  }

  /**
   * 작업 종료
   */
  end(trackingId: string, success: boolean, metadata?: Record<string, unknown>): void {
    const metric = this.activeOperations.get(trackingId);

    if (!metric) {
      console.warn(`[PerformanceTracker] 알 수 없는 tracking ID: ${trackingId}`);
      return;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.success = success;

    if (metadata) {
      metric.metadata = { ...metric.metadata, ...metadata };
    }

    this.metrics.push(metric);
    this.activeOperations.delete(trackingId);

    // 콜백 호출
    if (config.enableMetrics && config.metricsCallback) {
      config.metricsCallback(metric);
    }

    // 느린 작업 경고 (1초 이상)
    if (metric.duration > 1000) {
      console.warn(
        `[PerformanceTracker] 느린 작업 감지: ${metric.source}.${metric.method} - ${metric.duration.toFixed(2)}ms`
      );
    }
  }

  /**
   * 현재까지의 메트릭 조회
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * 특정 서비스의 메트릭 조회
   */
  getMetricsBySource(source: ServiceSource): PerformanceMetric[] {
    return this.metrics.filter((m) => m.source === source);
  }

  /**
   * 평균 실행 시간 계산
   */
  getAverageDuration(source: ServiceSource, method?: string): number | null {
    const filtered = this.metrics.filter(
      (m) =>
        m.source === source &&
        (method ? m.method === method : true) &&
        m.duration !== undefined
    );

    if (filtered.length === 0) return null;

    const total = filtered.reduce((sum, m) => sum + (m.duration ?? 0), 0);
    return total / filtered.length;
  }

  /**
   * 성공률 계산
   */
  getSuccessRate(source: ServiceSource, method?: string): number | null {
    const filtered = this.metrics.filter(
      (m) => m.source === source && (method ? m.method === method : true)
    );

    if (filtered.length === 0) return null;

    const successCount = filtered.filter((m) => m.success).length;
    return successCount / filtered.length;
  }

  /**
   * 메트릭 초기화
   */
  clear(): void {
    this.metrics = [];
    this.activeOperations.clear();
  }

  /**
   * 요약 보고서 생성
   */
  getSummary(): Record<string, {
    count: number;
    successCount: number;
    failureCount: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
  }> {
    const summary: Record<string, {
      count: number;
      successCount: number;
      failureCount: number;
      avgDuration: number;
      minDuration: number;
      maxDuration: number;
    }> = {};

    for (const metric of this.metrics) {
      const key = `${metric.source}.${metric.method}`;

      if (!summary[key]) {
        summary[key] = {
          count: 0,
          successCount: 0,
          failureCount: 0,
          avgDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
        };
      }

      const entry = summary[key];
      entry.count++;

      if (metric.success) {
        entry.successCount++;
      } else {
        entry.failureCount++;
      }

      if (metric.duration !== undefined) {
        entry.minDuration = Math.min(entry.minDuration, metric.duration);
        entry.maxDuration = Math.max(entry.maxDuration, metric.duration);
        // Running average 계산
        entry.avgDuration =
          entry.avgDuration + (metric.duration - entry.avgDuration) / entry.count;
      }
    }

    // Infinity를 0으로 변환
    for (const key in summary) {
      if (summary[key].minDuration === Infinity) {
        summary[key].minDuration = 0;
      }
    }

    return summary;
  }
}

// 전역 성능 추적기 인스턴스
export const globalPerformanceTracker = new PerformanceTracker();

/**
 * 성능 측정 데코레이터 함수
 *
 * 비동기 함수의 실행 시간을 자동으로 측정합니다.
 */
export function withPerformanceTracking<T extends unknown[], R>(
  source: ServiceSource,
  method: string,
  fn: (...args: T) => Promise<R>,
  options?: {
    operationIdExtractor?: (...args: T) => string | undefined;
    metadataExtractor?: (...args: T) => Record<string, unknown> | undefined;
  }
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const operationId = options?.operationIdExtractor?.(...args);
    const metadata = options?.metadataExtractor?.(...args);
    const trackingId = globalPerformanceTracker.start(
      source,
      method,
      operationId,
      metadata
    );

    try {
      const result = await fn(...args);
      globalPerformanceTracker.end(trackingId, true);
      return result;
    } catch (error) {
      globalPerformanceTracker.end(trackingId, false, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

/**
 * 서비스별 로거 인스턴스 생성 헬퍼
 */
export function createServiceLogger(
  source: ServiceSource,
  context?: {
    operationId?: string;
    studentId?: string;
    tenantId?: string;
  }
): ServiceLogger {
  return new ServiceLogger(source, context);
}
