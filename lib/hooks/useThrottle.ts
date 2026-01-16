"use client";

/**
 * useThrottle Hook
 *
 * 함수 호출을 지정된 간격으로 제한합니다.
 * - leading: 첫 번째 호출 즉시 실행
 * - trailing: 마지막 호출 지연 실행
 *
 * @example
 * ```tsx
 * const throttledSave = useThrottle(
 *   () => saveData(),
 *   3000, // 3초마다 최대 1회
 *   { leading: true, trailing: true }
 * );
 * ```
 */

import { useCallback, useRef, useEffect } from "react";

interface ThrottleOptions {
  /** 첫 호출 즉시 실행 (기본: true) */
  leading?: boolean;
  /** 마지막 호출 지연 실행 (기본: true) */
  trailing?: boolean;
}

/**
 * 쓰로틀된 함수를 반환하는 훅
 *
 * @param callback 쓰로틀할 함수
 * @param delay 쓰로틀 간격 (밀리초)
 * @param options leading/trailing 옵션
 * @returns 쓰로틀된 함수
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number,
  options: ThrottleOptions = {}
): (...args: Parameters<T>) => void {
  const { leading = true, trailing = true } = options;

  // 마지막 실행 시간
  const lastExecutedRef = useRef<number>(0);
  // 대기 중인 trailing 호출 타이머
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 마지막 호출 인자 (trailing 실행용)
  const lastArgsRef = useRef<Parameters<T> | null>(null);
  // 콜백 참조 (최신 상태 유지)
  const callbackRef = useRef(callback);

  // 콜백 업데이트
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 정리
  useEffect(() => {
    return () => {
      if (trailingTimerRef.current) {
        clearTimeout(trailingTimerRef.current);
      }
    };
  }, []);

  const throttledFn = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecutedRef.current;

      // 이전 trailing 타이머 취소
      if (trailingTimerRef.current) {
        clearTimeout(trailingTimerRef.current);
        trailingTimerRef.current = null;
      }

      // 인자 저장 (trailing 실행용)
      lastArgsRef.current = args;

      // 첫 호출이거나 딜레이가 지났으면 즉시 실행 (leading)
      if (timeSinceLastExecution >= delay) {
        if (leading) {
          lastExecutedRef.current = now;
          callbackRef.current(...args);
        } else if (trailing) {
          // leading이 false이면 trailing으로 예약
          trailingTimerRef.current = setTimeout(() => {
            lastExecutedRef.current = Date.now();
            if (lastArgsRef.current) {
              callbackRef.current(...lastArgsRef.current);
            }
            trailingTimerRef.current = null;
          }, delay);
        }
      } else if (trailing) {
        // 딜레이 내 호출 - trailing 예약
        const remainingTime = delay - timeSinceLastExecution;
        trailingTimerRef.current = setTimeout(() => {
          lastExecutedRef.current = Date.now();
          if (lastArgsRef.current) {
            callbackRef.current(...lastArgsRef.current);
          }
          trailingTimerRef.current = null;
        }, remainingTime);
      }
    },
    [delay, leading, trailing]
  );

  return throttledFn;
}

/**
 * 쓰로틀된 콜백을 반환하는 훅 (useDebouncedCallback과 유사한 API)
 *
 * @param callback 쓰로틀할 함수
 * @param delay 쓰로틀 간격 (밀리초)
 * @param options leading/trailing 옵션
 * @returns 쓰로틀된 함수
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number,
  options?: ThrottleOptions
): (...args: Parameters<T>) => void {
  return useThrottle(callback, delay, options);
}
