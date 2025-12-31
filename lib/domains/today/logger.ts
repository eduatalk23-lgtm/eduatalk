/**
 * Today 도메인 로깅 유틸리티
 *
 * 타이머, 세션, 플랜 관련 작업의 구조화된 로깅을 제공합니다.
 * 프로덕션에서는 로그 레벨에 따라 출력을 제어합니다.
 *
 * @module lib/domains/today/logger
 */

import {
  logActionError,
  logActionWarn,
  logActionDebug,
} from "@/lib/logging/actionLogger";

// ============================================
// 로그 레벨
// ============================================

export type LogLevel = "debug" | "info" | "warn" | "error";

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
  (process.env.TODAY_LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === "production" ? "warn" : "debug");

// ============================================
// 로거 타입
// ============================================

interface LogContext {
  /** 로그 발생 모듈 */
  module: string;
  /** 함수 또는 작업 이름 */
  action?: string;
  /** 관련 ID (planId, sessionId 등) */
  id?: string;
  /** 사용자 ID */
  userId?: string;
  /** 추가 데이터 */
  data?: Record<string, unknown>;
  /** 에러 객체 */
  error?: Error;
  /** 실행 시간 (ms) */
  duration?: number;
}

// ============================================
// 로거 함수
// ============================================

/**
 * 로그 레벨 체크
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[CURRENT_LOG_LEVEL];
}

/**
 * LogContext를 metadata 객체로 변환
 */
function contextToMetadata(
  context: Omit<LogContext, "module"> & { module?: string }
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  if (context.module) metadata.module = context.module;
  if (context.action) metadata.actionDetail = context.action;
  if (context.id) metadata.id = context.id;
  if (context.duration !== undefined) metadata.duration = context.duration;
  if (context.data) metadata.data = context.data;

  return metadata;
}

/**
 * Today 도메인 로거
 */
export const todayLogger = {
  /**
   * 디버그 로그 (개발용)
   */
  debug(
    message: string,
    context: Omit<LogContext, "module"> & { module?: string } = {}
  ) {
    if (!shouldLog("debug")) return;

    const actionName = context.action ?? context.module ?? "general";
    logActionDebug(
      { domain: "today", action: actionName, userId: context.userId },
      message,
      contextToMetadata(context)
    );
  },

  /**
   * 정보 로그
   */
  info(
    message: string,
    context: Omit<LogContext, "module"> & { module?: string } = {}
  ) {
    if (!shouldLog("info")) return;

    const actionName = context.action ?? context.module ?? "general";
    logActionDebug(
      { domain: "today", action: actionName, userId: context.userId },
      message,
      contextToMetadata(context)
    );
  },

  /**
   * 경고 로그
   */
  warn(
    message: string,
    context: Omit<LogContext, "module"> & { module?: string } = {}
  ) {
    if (!shouldLog("warn")) return;

    const actionName = context.action ?? context.module ?? "general";
    logActionWarn(
      { domain: "today", action: actionName, userId: context.userId },
      message,
      contextToMetadata(context)
    );
  },

  /**
   * 에러 로그
   */
  error(
    message: string,
    context: Omit<LogContext, "module"> & { module?: string } = {}
  ) {
    if (!shouldLog("error")) return;

    const actionName = context.action ?? context.module ?? "general";
    logActionError(
      { domain: "today", action: actionName, userId: context.userId },
      context.error ?? new Error(message),
      contextToMetadata(context)
    );
  },

  /**
   * 성능 측정 헬퍼
   * @returns stop 함수를 호출하면 duration 반환
   */
  startTimer(): () => number {
    const start =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    return () =>
      Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
          start
      );
  },
};

// ============================================
// 모듈별 로거 프리셋
// ============================================

/** 타이머 액션 로거 */
export const timerLogger = {
  debug: (message: string, context: Omit<LogContext, "module"> = {}) =>
    todayLogger.debug(message, { ...context, module: "timer" }),
  info: (message: string, context: Omit<LogContext, "module"> = {}) =>
    todayLogger.info(message, { ...context, module: "timer" }),
  warn: (message: string, context: Omit<LogContext, "module"> = {}) =>
    todayLogger.warn(message, { ...context, module: "timer" }),
  error: (message: string, context: Omit<LogContext, "module"> = {}) =>
    todayLogger.error(message, { ...context, module: "timer" }),
  startTimer: () => todayLogger.startTimer(),
};

/** 세션 액션 로거 */
export const sessionLogger = {
  debug: (message: string, context: Omit<LogContext, "module"> = {}) =>
    todayLogger.debug(message, { ...context, module: "session" }),
  info: (message: string, context: Omit<LogContext, "module"> = {}) =>
    todayLogger.info(message, { ...context, module: "session" }),
  warn: (message: string, context: Omit<LogContext, "module"> = {}) =>
    todayLogger.warn(message, { ...context, module: "session" }),
  error: (message: string, context: Omit<LogContext, "module"> = {}) =>
    todayLogger.error(message, { ...context, module: "session" }),
  startTimer: () => todayLogger.startTimer(),
};

/** 플랜 액션 로거 */
export const planLogger = {
  debug: (message: string, context: Omit<LogContext, "module"> = {}) =>
    todayLogger.debug(message, { ...context, module: "plan" }),
  info: (message: string, context: Omit<LogContext, "module"> = {}) =>
    todayLogger.info(message, { ...context, module: "plan" }),
  warn: (message: string, context: Omit<LogContext, "module"> = {}) =>
    todayLogger.warn(message, { ...context, module: "plan" }),
  error: (message: string, context: Omit<LogContext, "module"> = {}) =>
    todayLogger.error(message, { ...context, module: "plan" }),
  startTimer: () => todayLogger.startTimer(),
};
