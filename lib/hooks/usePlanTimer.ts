"use client";

/**
 * UI-only consumption hook for plan timer
 * 
 * 스토어를 구독하여 타이머 상태를 읽어옵니다.
 * 이 훅 자체는 interval을 생성하지 않습니다.
 */

import { useEffect } from "react";
import { usePlanTimerStore } from "@/lib/store/planTimerStore";
import type { TimerStatus } from "@/lib/store/planTimerStore";

export type UsePlanTimerOptions = {
  /** 플랜 ID */
  planId: string;
  /** 서버에서 계산된 초기 상태 */
  status: TimerStatus;
  /** 서버에서 계산된 누적 시간 (초) */
  accumulatedSeconds: number;
  /** 마지막 시작 시각 (UTC ISO 타임스탬프) */
  startedAt: string | null;
  /** 서버 현재 시간 (밀리초) */
  serverNow: number;
  /** 타이머가 완료되었는지 여부 */
  isCompleted?: boolean;
};

export type UsePlanTimerReturn = {
  /** 현재 경과 시간 (초) */
  seconds: number;
  /** 타이머가 실행 중인지 여부 */
  isRunning: boolean;
  /** 타이머 상태 */
  status: TimerStatus;
};

/**
 * 플랜 타이머를 구독하는 훅
 * 
 * 스토어에서 타이머 상태를 읽어오며, 초기화는 자동으로 수행됩니다.
 * 
 * @param options 타이머 옵션
 * @returns 타이머 상태
 */
export function usePlanTimer({
  planId,
  status,
  accumulatedSeconds,
  startedAt,
  serverNow,
  isCompleted = false,
}: UsePlanTimerOptions): UsePlanTimerReturn {
  const store = usePlanTimerStore();
  const timer = store.timers.get(planId);

  // 초기화 또는 상태 동기화
  useEffect(() => {
    // 완료된 경우 타이머 제거
    if (isCompleted || status === "COMPLETED") {
      store.removeTimer(planId);
      return;
    }

    // 타이머가 없거나 상태가 변경된 경우 초기화
    if (!timer || timer.status !== status) {
      store.initPlanTimer(planId, {
        status,
        accumulatedSeconds,
        startedAt,
        serverNow,
      });
    } else {
      // 상태가 같아도 서버 데이터가 변경되었을 수 있으므로 동기화
      const currentSeconds = timer.seconds;
      const expectedSeconds = accumulatedSeconds;

      // 차이가 크면 (예: 5초 이상) 동기화
      if (Math.abs(currentSeconds - expectedSeconds) > 5) {
        store.syncNow(planId, serverNow);
      }
    }
  }, [planId, status, accumulatedSeconds, startedAt, serverNow, isCompleted, timer, store]);

  // 컴포넌트 언마운트 시 타이머 제거 (선택사항 - 여러 탭에서 사용 중이면 제거하지 않음)
  // useEffect(() => {
  //   return () => {
  //     // 타이머는 여러 컴포넌트에서 사용될 수 있으므로 제거하지 않음
  //   };
  // }, [planId, store]);

  return {
    seconds: timer?.seconds ?? accumulatedSeconds,
    isRunning: timer?.isRunning ?? (status === "RUNNING"),
    status: timer?.status ?? status,
  };
}
