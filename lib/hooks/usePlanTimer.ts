"use client";

/**
 * UI-only consumption hook for plan timer
 *
 * 스토어를 구독하여 타이머 상태를 읽어옵니다.
 * 이 훅 자체는 interval을 생성하지 않습니다.
 *
 * 최적화: selector 패턴을 사용하여 특정 planId의 타이머만 구독합니다.
 *
 * 동기화 전략:
 * 1. Visibility 변경 시 즉시 동기화
 * 2. RUNNING 상태에서 5분마다 주기적 동기화
 * 3. 서버-클라이언트 시간 차이가 큰 경우 동기화
 */

import { useEffect, useRef, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePlanTimerStore } from "@/lib/store/planTimerStore";
import type { TimerStatus } from "@/lib/store/planTimerStore";
import { getServerTime, syncTimerProgress } from "@/lib/domains/today";

// 주기적 동기화 간격 (5분)
const PERIODIC_SYNC_INTERVAL_MS = 5 * 60 * 1000;
// 시간 차이 임계값 (2초 이상이면 동기화)
const SYNC_THRESHOLD_SECONDS = 2;

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
  // Selector 패턴: 특정 planId의 타이머만 구독하여 불필요한 리렌더링 방지
  // Map 구조이므로 특정 키의 값만 추출하여 구독
  const timer = usePlanTimerStore(
    useShallow((state) => {
      const timerData = state.timers.get(planId);
      // timerData가 없으면 undefined 반환 (shallow equality 체크)
      if (!timerData) return undefined;
      // timerData의 필요한 필드만 반환하여 불필요한 리렌더링 방지
      return {
        seconds: timerData.seconds,
        isRunning: timerData.isRunning,
        status: timerData.status,
      };
    })
  );

  // 스토어 액션은 selector 없이 직접 접근 (액션은 변경되지 않으므로)
  const initPlanTimer = usePlanTimerStore((state) => state.initPlanTimer);
  const removeTimer = usePlanTimerStore((state) => state.removeTimer);
  const syncNow = usePlanTimerStore((state) => state.syncNow);

  // visibility 변경 감지를 위한 구독
  const visibilityChangeTimestamp = usePlanTimerStore(
    (state) => state.visibilityChangeTimestamp
  );

  // Debounce를 위한 ref
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastVisibilityTimestampRef = useRef<number | null>(null);
  // 주기적 동기화를 위한 ref
  const periodicSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPeriodicSyncRef = useRef<number>(Date.now());

  // 참조 카운팅: 컴포넌트 마운트 시 참조 증가
  useEffect(() => {
    const addTimerRef = usePlanTimerStore.getState().addTimerRef;
    addTimerRef(planId);

    // 언마운트 시 참조 감소
    return () => {
      const removeTimerRef = usePlanTimerStore.getState().removeTimerRef;
      removeTimerRef(planId);
    };
  }, [planId]);

  // Visibility 변경 시 서버에서 정확한 시간을 가져와 동기화
  useEffect(() => {
    // 첫 마운트 시에는 동기화 불필요
    if (visibilityChangeTimestamp === null) {
      return;
    }

    // 같은 타임스탬프에 대해 중복 동기화 방지
    if (lastVisibilityTimestampRef.current === visibilityChangeTimestamp) {
      return;
    }
    lastVisibilityTimestampRef.current = visibilityChangeTimestamp;

    // 현재 타이머가 RUNNING 상태인 경우에만 서버 동기화
    const currentTimer = usePlanTimerStore.getState().timers.get(planId);
    if (!currentTimer || currentTimer.status !== "RUNNING" || !currentTimer.isRunning) {
      return;
    }

    // 서버에서 정확한 시간을 가져와 동기화
    const syncWithServer = async () => {
      try {
        const { serverNow } = await getServerTime();
        syncNow(planId, serverNow);

        // 탭이 숨겨질 때 (visibilityChangeTimestamp가 있으면) DB에도 저장
        // 브라우저 종료/새로고침 시 데이터 손실 방지
        const timer = usePlanTimerStore.getState().timers.get(planId);
        if (timer && timer.seconds > 0) {
          await syncTimerProgress(planId, timer.seconds);
        }
      } catch (error) {
        // 서버 요청 실패 시 기존 offset 사용하여 폴백
        console.warn("[usePlanTimer] 서버 시간 동기화 실패, 로컬 시간 사용:", error);
        const now = Date.now();
        const fallbackServerNow = now + (currentTimer.timeOffset || 0);
        syncNow(planId, fallbackServerNow);
      }
    };

    syncWithServer();
  }, [planId, visibilityChangeTimestamp, syncNow]);

  // 주기적 동기화: RUNNING 상태에서 5분마다 서버와 동기화
  useEffect(() => {
    // 현재 타이머가 RUNNING 상태인지 확인
    const currentTimer = usePlanTimerStore.getState().timers.get(planId);
    const isRunning = currentTimer?.status === "RUNNING" && currentTimer?.isRunning;

    // RUNNING 상태가 아니면 interval 정리
    if (!isRunning) {
      if (periodicSyncIntervalRef.current) {
        clearInterval(periodicSyncIntervalRef.current);
        periodicSyncIntervalRef.current = null;
      }
      return;
    }

    // 이미 interval이 있으면 중복 생성 방지
    if (periodicSyncIntervalRef.current) {
      return;
    }

    // 주기적 동기화 설정
    periodicSyncIntervalRef.current = setInterval(async () => {
      const timer = usePlanTimerStore.getState().timers.get(planId);
      if (!timer || timer.status !== "RUNNING" || !timer.isRunning) {
        // 더 이상 RUNNING 상태가 아니면 interval 정리
        if (periodicSyncIntervalRef.current) {
          clearInterval(periodicSyncIntervalRef.current);
          periodicSyncIntervalRef.current = null;
        }
        return;
      }

      try {
        // 서버 시간 동기화
        const { serverNow } = await getServerTime();
        syncNow(planId, serverNow);
        lastPeriodicSyncRef.current = Date.now();

        // DB에 학습 시간 저장 (데이터 손실 방지)
        const currentSeconds = timer.seconds;
        if (currentSeconds > 0) {
          await syncTimerProgress(planId, currentSeconds);
        }
      } catch (error) {
        console.warn("[usePlanTimer] 주기적 동기화 실패:", error);
      }
    }, PERIODIC_SYNC_INTERVAL_MS);

    // Cleanup
    return () => {
      if (periodicSyncIntervalRef.current) {
        clearInterval(periodicSyncIntervalRef.current);
        periodicSyncIntervalRef.current = null;
      }
    };
  }, [planId, timer?.status, timer?.isRunning, syncNow]);

  // 초기화 또는 상태 동기화
  useEffect(() => {
    // 완료된 경우 타이머 제거하고 더 이상 실행하지 않음
    if (isCompleted || status === "COMPLETED") {
      // 기존 timeout 정리
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      removeTimer(planId);
      return;
    }

    // 현재 타이머 상태 확인 (effect 실행 시점의 값)
    // timer는 이미 selector로 구독 중이지만, 전체 타이머 데이터가 필요하므로 스토어에서 직접 조회
    const currentTimer = usePlanTimerStore.getState().timers.get(planId);

    // 타이머가 없거나 상태가 변경된 경우 즉시 초기화 (debounce 없음)
    if (!currentTimer || currentTimer.status !== status) {
      // 기존 timeout 정리
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      initPlanTimer(planId, {
        status,
        accumulatedSeconds,
        startedAt,
        serverNow,
      });
      return;
    }

    // 상태가 같아도 서버 데이터가 변경되었을 수 있으므로 동기화
    // 동기화 체크는 debounce 처리 (300ms)
    const currentSeconds = currentTimer.seconds;
    const expectedSeconds = accumulatedSeconds;

    // 기존 timeout 정리
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // 차이가 크면 (SYNC_THRESHOLD_SECONDS 이상) debounce 후 동기화
    if (Math.abs(currentSeconds - expectedSeconds) > SYNC_THRESHOLD_SECONDS) {
      syncTimeoutRef.current = setTimeout(() => {
        syncNow(planId, serverNow);
        syncTimeoutRef.current = null;
      }, 300);
    }

    // Cleanup: 컴포넌트 언마운트 또는 의존성 변경 시 timeout 정리
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
     
  }, [planId, status, accumulatedSeconds, startedAt, serverNow, isCompleted, initPlanTimer, removeTimer, syncNow]);

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
