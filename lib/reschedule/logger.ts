/**
 * 재조정 모듈 로깅 유틸리티
 * 
 * 구조화된 로깅을 제공하여 디버깅 및 모니터링을 용이하게 합니다.
 * 프로덕션에서는 로그 레벨에 따라 출력을 제어합니다.
 * 
 * @module lib/reschedule/logger
 */

// ============================================
// 로그 레벨
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * 현재 로그 레벨 (환경 변수로 설정 가능)
 * 개발 환경에서는 debug, 프로덕션에서는 warn 권장
 */
const CURRENT_LOG_LEVEL: LogLevel = 
  (process.env.RESCHEDULE_LOG_LEVEL as LogLevel) || 
  (process.env.NODE_ENV === 'production' ? 'warn' : 'debug');

// ============================================
// 로거 함수
// ============================================

interface LogContext {
  /** 로그 발생 모듈 */
  module: string;
  /** 함수 또는 작업 이름 */
  action?: string;
  /** 관련 ID (groupId 등) */
  id?: string;
  /** 추가 데이터 */
  data?: Record<string, unknown>;
  /** 에러 객체 */
  error?: Error;
  /** 실행 시간 (ms) */
  duration?: number;
}

/**
 * 로그 메시지 포맷팅
 */
function formatLogMessage(level: LogLevel, message: string, context: LogContext): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [reschedule/${context.module}]`;
  
  let formatted = `${prefix} ${message}`;
  
  if (context.action) {
    formatted += ` action=${context.action}`;
  }
  if (context.id) {
    formatted += ` id=${context.id}`;
  }
  if (context.duration !== undefined) {
    formatted += ` duration=${context.duration}ms`;
  }
  
  return formatted;
}

/**
 * 로그 레벨 체크
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[CURRENT_LOG_LEVEL];
}

/**
 * 재조정 로거
 */
export const rescheduleLogger = {
  /**
   * 디버그 로그 (개발용)
   */
  debug(message: string, context: Omit<LogContext, 'module'> & { module?: string }) {
    if (!shouldLog('debug')) return;
    console.debug(formatLogMessage('debug', message, { module: 'general', ...context }));
    if (context.data) {
      console.debug('  Data:', JSON.stringify(context.data, null, 2));
    }
  },

  /**
   * 정보 로그
   */
  info(message: string, context: Omit<LogContext, 'module'> & { module?: string }) {
    if (!shouldLog('info')) return;
    console.log(formatLogMessage('info', message, { module: 'general', ...context }));
    if (context.data) {
      console.log('  Data:', JSON.stringify(context.data, null, 2));
    }
  },

  /**
   * 경고 로그
   */
  warn(message: string, context: Omit<LogContext, 'module'> & { module?: string }) {
    if (!shouldLog('warn')) return;
    console.warn(formatLogMessage('warn', message, { module: 'general', ...context }));
    if (context.data) {
      console.warn('  Data:', JSON.stringify(context.data, null, 2));
    }
  },

  /**
   * 에러 로그
   */
  error(message: string, context: Omit<LogContext, 'module'> & { module?: string }) {
    if (!shouldLog('error')) return;
    console.error(formatLogMessage('error', message, { module: 'general', ...context }));
    if (context.error) {
      console.error('  Error:', context.error.message);
      console.error('  Stack:', context.error.stack);
    }
    if (context.data) {
      console.error('  Data:', JSON.stringify(context.data, null, 2));
    }
  },

  /**
   * 성능 측정 헬퍼
   * @returns stop 함수를 호출하면 duration 반환
   */
  startTimer(): () => number {
    const start = performance.now();
    return () => Math.round(performance.now() - start);
  },
};

// 모듈별 로거 프리셋
export const previewCacheLogger = {
  debug: (message: string, context: Omit<LogContext, 'module'> = {}) => 
    rescheduleLogger.debug(message, { ...context, module: 'previewCache' }),
  info: (message: string, context: Omit<LogContext, 'module'> = {}) => 
    rescheduleLogger.info(message, { ...context, module: 'previewCache' }),
  warn: (message: string, context: Omit<LogContext, 'module'> = {}) => 
    rescheduleLogger.warn(message, { ...context, module: 'previewCache' }),
  error: (message: string, context: Omit<LogContext, 'module'> = {}) => 
    rescheduleLogger.error(message, { ...context, module: 'previewCache' }),
};

export const transactionLogger = {
  debug: (message: string, context: Omit<LogContext, 'module'> = {}) => 
    rescheduleLogger.debug(message, { ...context, module: 'transaction' }),
  info: (message: string, context: Omit<LogContext, 'module'> = {}) => 
    rescheduleLogger.info(message, { ...context, module: 'transaction' }),
  warn: (message: string, context: Omit<LogContext, 'module'> = {}) => 
    rescheduleLogger.warn(message, { ...context, module: 'transaction' }),
  error: (message: string, context: Omit<LogContext, 'module'> = {}) => 
    rescheduleLogger.error(message, { ...context, module: 'transaction' }),
};
