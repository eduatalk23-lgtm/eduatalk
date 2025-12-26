/**
 * 구조화된 Server Action 로깅 유틸리티
 *
 * Server Actions에서 일관된 로깅 패턴을 제공합니다.
 * - 에러 로깅 (컨텍스트 정보 포함)
 * - 성공 로깅 (감사 추적용)
 * - 성능 측정
 */

export interface ActionContext {
  /** 액션이 속한 도메인 (예: 'plan', 'attendance', 'camp') */
  domain: string;
  /** 액션 이름 (예: 'createPlan', 'updateAttendance') */
  action: string;
  /** 테넌트 ID (multi-tenancy 환경) */
  tenantId?: string;
  /** 사용자 ID */
  userId?: string;
  /** 요청 상관 ID (트레이싱용) */
  correlationId?: string;
}

export interface LogMetadata {
  [key: string]: unknown;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  domain: string;
  action: string;
  message: string;
  tenantId?: string;
  userId?: string;
  correlationId?: string;
  metadata?: LogMetadata;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
}

/**
 * 로그 엔트리를 JSON 형식으로 출력
 */
function writeLog(entry: LogEntry): void {
  const output = JSON.stringify(entry);

  switch (entry.level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.debug(output);
      }
      break;
    default:
      console.log(output);
  }
}

/**
 * 기본 로그 엔트리 생성
 */
function createLogEntry(
  level: LogLevel,
  context: ActionContext,
  message: string,
  metadata?: LogMetadata
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    domain: context.domain,
    action: context.action,
    message,
    ...(context.tenantId && { tenantId: context.tenantId }),
    ...(context.userId && { userId: context.userId }),
    ...(context.correlationId && { correlationId: context.correlationId }),
    ...(metadata && { metadata }),
  };
}

/**
 * Server Action 에러 로깅
 *
 * @example
 * try {
 *   await updatePlan(id, data);
 * } catch (error) {
 *   logActionError(
 *     { domain: 'plan', action: 'updatePlan', tenantId, userId },
 *     error,
 *     { planId: id }
 *   );
 *   return { success: false, error: 'Failed to update plan' };
 * }
 */
export function logActionError(
  context: ActionContext,
  error: unknown,
  metadata?: LogMetadata
): void {
  const errorInfo =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        }
      : {
          name: 'UnknownError',
          message: String(error),
        };

  const entry = createLogEntry('error', context, `Action failed: ${errorInfo.message}`, metadata);
  entry.error = errorInfo;

  writeLog(entry);
}

/**
 * Server Action 성공 로깅 (감사 추적용)
 *
 * @example
 * const result = await createPlan(data);
 * logActionSuccess(
 *   { domain: 'plan', action: 'createPlan', tenantId, userId },
 *   { planId: result.id }
 * );
 */
export function logActionSuccess(
  context: ActionContext,
  metadata?: LogMetadata
): void {
  const entry = createLogEntry('info', context, 'Action completed successfully', metadata);
  writeLog(entry);
}

/**
 * Server Action 경고 로깅
 */
export function logActionWarn(
  context: ActionContext,
  message: string,
  metadata?: LogMetadata
): void {
  const entry = createLogEntry('warn', context, message, metadata);
  writeLog(entry);
}

/**
 * Server Action 디버그 로깅 (개발 환경 전용)
 */
export function logActionDebug(
  context: ActionContext,
  message: string,
  metadata?: LogMetadata
): void {
  const entry = createLogEntry('debug', context, message, metadata);
  writeLog(entry);
}

/**
 * 액션 실행 시간 측정 래퍼
 *
 * @example
 * const result = await withActionTiming(
 *   { domain: 'plan', action: 'getPlans', tenantId },
 *   async () => fetchPlans(filters)
 * );
 */
export async function withActionTiming<T>(
  context: ActionContext,
  fn: () => Promise<T>,
  options?: {
    /** 이 시간(ms)을 초과하면 경고 로그 출력 */
    warnThresholdMs?: number;
    /** 성공 시에도 로그 출력 여부 */
    logSuccess?: boolean;
  }
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await fn();
    const duration = Math.round(performance.now() - startTime);

    if (options?.warnThresholdMs && duration > options.warnThresholdMs) {
      logActionWarn(context, `Action took ${duration}ms (threshold: ${options.warnThresholdMs}ms)`, {
        duration,
      });
    } else if (options?.logSuccess) {
      const entry = createLogEntry('info', context, 'Action completed', { duration });
      entry.duration = duration;
      writeLog(entry);
    }

    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    logActionError(context, error, { duration });
    throw error;
  }
}

/**
 * 액션 컨텍스트 생성 헬퍼
 */
export function createActionContext(
  domain: string,
  action: string,
  options?: Partial<Omit<ActionContext, 'domain' | 'action'>>
): ActionContext {
  return {
    domain,
    action,
    ...options,
    correlationId: options?.correlationId ?? generateCorrelationId(),
  };
}

/**
 * 상관 ID 생성
 */
export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}
