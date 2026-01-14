/**
 * 간단한 Server Action 로깅 유틸리티
 *
 * 기존 console.log/warn/error를 대체하는 간단한 래퍼입니다.
 * 프로덕션에서는 debug 로그가 출력되지 않습니다.
 *
 * @module lib/utils/serverActionLogger
 */

const isDev = process.env.NODE_ENV === "development";

/**
 * 디버그 로그 (개발 환경 전용)
 */
export function logActionDebug(action: string, message: string): void {
  if (isDev) {
    console.debug(`[${action}] ${message}`);
  }
}

/**
 * 경고 로그
 */
export function logActionWarn(action: string, message: string): void {
  console.warn(`[${action}] ${message}`);
}

/**
 * 에러 로그
 */
export function logActionError(action: string, message: string): void {
  console.error(`[${action}] ${message}`);
}
