"use client";

import { useState, useEffect } from "react";
import { useInterval } from "./useInterval";

export type UsePlanTimerOptions = {
  /** 서버에서 계산된 초기 경과 시간 (초) */
  initialDuration: number;
  /** 서버 기준 초기 실행 상태 */
  isInitiallyRunning: boolean;
  /** 타이머가 일시정지되었는지 여부 */
  isPaused?: boolean;
  /** 타이머가 완료되었는지 여부 */
  isCompleted?: boolean;
};

export type UsePlanTimerReturn = {
  /** 현재 경과 시간 (초) */
  seconds: number;
  /** 타이머가 실행 중인지 여부 */
  isRunning: boolean;
  /** 타이머 시작 */
  start: () => void;
  /** 타이머 일시정지 */
  pause: () => void;
  /** 타이머 재개 */
  resume: () => void;
  /** 타이머 정지 (완료) */
  stop: () => void;
  /** 타이머 리셋 (초기값으로 되돌림) */
  reset: (newInitialDuration: number, newIsInitiallyRunning: boolean) => void;
};

/**
 * 플랜 타이머를 관리하는 공통 훅
 * 
 * 클라이언트에서만 동작하며, 서버와의 통신은 호출하는 컴포넌트에서 처리합니다.
 * 
 * @param options 타이머 옵션
 * @returns 타이머 상태 및 제어 함수
 */
export function usePlanTimer({
  initialDuration,
  isInitiallyRunning,
  isPaused = false,
  isCompleted = false,
}: UsePlanTimerOptions): UsePlanTimerReturn {
  const [seconds, setSeconds] = useState(initialDuration);
  const [isRunning, setIsRunning] = useState(isInitiallyRunning && !isPaused && !isCompleted);

  // 초기값이 변경되면 (예: 서버에서 새로 받은 데이터) 상태 업데이트
  useEffect(() => {
    setSeconds(initialDuration);
    setIsRunning(isInitiallyRunning && !isPaused && !isCompleted);
  }, [initialDuration, isInitiallyRunning, isPaused, isCompleted]);

  // 타이머 실행 (1초마다 증가)
  useInterval(
    () => {
      if (isRunning && !isPaused && !isCompleted) {
        setSeconds((prev) => prev + 1);
      }
    },
    isRunning && !isPaused && !isCompleted ? 1000 : null
  );

  const start = () => {
    setIsRunning(true);
  };

  const pause = () => {
    setIsRunning(false);
  };

  const resume = () => {
    setIsRunning(true);
  };

  const stop = () => {
    setIsRunning(false);
  };

  const reset = (newInitialDuration: number, newIsInitiallyRunning: boolean) => {
    setSeconds(newInitialDuration);
    setIsRunning(newIsInitiallyRunning && !isPaused && !isCompleted);
  };

  return {
    seconds,
    isRunning,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}

