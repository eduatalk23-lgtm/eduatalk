/**
 * Singleton Timer Store
 *
 * 하나의 interval만 유지하여 모든 플랜 타이머를 관리합니다.
 * Drift-free 알고리즘을 사용하여 정확한 시간 계산을 보장합니다.
 */

import { create } from "zustand";
import {
  calculateDriftFreeSeconds,
  validateTimerTransition,
  canPerformAction,
  type TimerStatus,
  type TimerAction,
} from "@/lib/utils/timerUtils";

// 외부에서 사용할 수 있도록 re-export
export type { TimerStatus, TimerAction } from "@/lib/utils/timerUtils";
export { canPerformAction } from "@/lib/utils/timerUtils";

export type PlanTimerData = {
  /** 현재 표시되는 시간 (초) */
  seconds: number;
  /** 타이머가 실행 중인지 여부 */
  isRunning: boolean;
  /** 마지막 시작 시각 (밀리초, 서버 시간 기준) - drift 보정 시 변경될 수 있음 */
  startedAt: number | null;
  /** 원본 시작 시각 (밀리초, 서버 시간 기준) - syncNow에서도 변경되지 않음 */
  originalStartedAt: number | null;
  /** 시작 시점의 누적 시간 (초) */
  baseAccumulated: number;
  /** 서버 시간과 클라이언트 시간의 차이 (밀리초) */
  timeOffset: number;
  /** 타이머 상태 */
  status: TimerStatus;
  /** interval ID */
  intervalId: NodeJS.Timeout | null;
  /** 참조 카운트 (여러 컴포넌트에서 사용 중인지 추적) */
  refCount: number;
};

type PlanTimerStore = {
  /** planId를 키로 하는 타이머 데이터 맵 */
  timers: Map<string, PlanTimerData>;
  /** Visibility API 상태 */
  isVisible: boolean;
  /** 탭이 다시 보이게 된 시점의 타임스탬프 (서버 동기화 트리거용) */
  visibilityChangeTimestamp: number | null;
  /** 초기화 */
  initPlanTimer: (
    planId: string,
    options: {
      status: TimerStatus;
      accumulatedSeconds: number;
      startedAt: string | null;
      serverNow: number;
    }
  ) => void;
  /** 타이머 시작 */
  startTimer: (planId: string, serverNow: number, startedAt: string) => void;
  /** 타이머 일시정지 */
  pauseTimer: (planId: string, accumulatedSeconds: number) => void;
  /** 타이머 정지 (완료) */
  stopTimer: (planId: string, accumulatedSeconds: number) => void;
  /** 현재 시간으로 동기화 */
  syncNow: (planId: string, serverNow: number) => void;
  /** 타이머의 seconds만 업데이트 (interval 내부에서 사용) */
  updateTimerSeconds: (planId: string, seconds: number) => void;
  /** 타이머 참조 증가 (컴포넌트 마운트 시) */
  addTimerRef: (planId: string) => void;
  /** 타이머 참조 감소 (컴포넌트 언마운트 시) */
  removeTimerRef: (planId: string) => void;
  /** 타이머 제거 (참조 카운트가 0일 때만 실제로 제거) */
  removeTimer: (planId: string) => void;
  /** 모든 타이머 정리 */
  clearAll: () => void;
};

// Global interval 관리 (모든 타이머가 하나의 interval을 공유)
let globalIntervalId: NodeJS.Timeout | null = null;
let isGlobalIntervalRunning = false;

/**
 * 모든 활성 타이머 업데이트
 *
 * @param getStore Zustand store의 get 함수
 */
function updateAllTimers(getStore: () => PlanTimerStore) {
  const store = getStore();
  const now = Date.now();
  let hasActiveTimers = false;
  const updates: Array<{ planId: string; seconds: number }> = [];

  store.timers.forEach((timer, planId) => {
    if (timer.status === "RUNNING" && timer.isRunning && store.isVisible) {
      const newSeconds = calculateDriftFreeSeconds(
        timer.startedAt,
        timer.baseAccumulated,
        timer.timeOffset,
        now
      );

      // 상태가 변경된 경우에만 업데이트
      if (newSeconds !== timer.seconds) {
        updates.push({ planId, seconds: newSeconds });
      }
      hasActiveTimers = true;
    }
  });

  // 업데이트가 있으면 store의 updateTimerSeconds 메서드 사용
  if (updates.length > 0) {
    updates.forEach(({ planId, seconds }) => {
      store.updateTimerSeconds(planId, seconds);
    });
  }

  // 활성 타이머가 없으면 global interval 정지
  if (!hasActiveTimers && globalIntervalId) {
    stopGlobalInterval();
  }
}

/**
 * Global interval 시작
 */
function startGlobalInterval(getStore: () => PlanTimerStore) {
  if (isGlobalIntervalRunning) {
    return;
  }

  isGlobalIntervalRunning = true;
  globalIntervalId = setInterval(() => {
    updateAllTimers(getStore);
  }, 1000);
}

/**
 * Global interval 정지
 */
function stopGlobalInterval() {
  if (globalIntervalId) {
    clearInterval(globalIntervalId);
    globalIntervalId = null;
    isGlobalIntervalRunning = false;
  }
}

export const usePlanTimerStore = create<PlanTimerStore>((set, get) => {
  // Visibility API 리스너 설정
  if (typeof document !== "undefined") {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      const store = get();

      set({ isVisible });

      if (isVisible) {
        // 탭이 다시 보이면 visibilityChangeTimestamp 업데이트
        // 실제 서버 동기화는 usePlanTimer 훅에서 처리 (서버에서 정확한 시간을 받아옴)
        set({ visibilityChangeTimestamp: Date.now() });
        startGlobalInterval(get);
      } else {
        // 탭이 숨겨지면 interval 정지
        stopGlobalInterval();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 초기 상태 설정
    set({ isVisible: document.visibilityState === "visible" });
  }

  return {
    timers: new Map(),
    isVisible:
      typeof document !== "undefined"
        ? document.visibilityState === "visible"
        : true,
    visibilityChangeTimestamp: null,

    initPlanTimer: (planId, options) => {
      const { status, accumulatedSeconds, startedAt, serverNow } = options;
      const now = Date.now();
      const timeOffset = serverNow - now;

      const startedAtMs = startedAt ? new Date(startedAt).getTime() : null;

      const timerData: PlanTimerData = {
        seconds: accumulatedSeconds,
        isRunning: status === "RUNNING",
        startedAt: startedAtMs,
        originalStartedAt: startedAtMs, // 원본 시작 시간 보존
        baseAccumulated: accumulatedSeconds,
        timeOffset,
        status,
        intervalId: null,
        refCount: 1, // 초기화 시 참조 카운트 1
      };

      set((state) => {
        const newTimers = new Map(state.timers);
        newTimers.set(planId, timerData);

        // RUNNING 상태이고 visible이면 global interval 시작
        if (status === "RUNNING" && state.isVisible) {
          startGlobalInterval(get);
        }

        return { timers: newTimers };
      });
    },

    startTimer: (planId, serverNow, startedAt) => {
      const now = Date.now();
      const timeOffset = serverNow - now;
      const startedAtMs = new Date(startedAt).getTime();

      if (!Number.isFinite(startedAtMs)) {
        console.error("[planTimerStore] Invalid startedAt:", startedAt);
        return;
      }

      set((state) => {
        const timer = state.timers.get(planId);
        if (!timer) {
          // 타이머가 없으면 초기화 후 시작 (NOT_STARTED → RUNNING)
          const timerData: PlanTimerData = {
            seconds: 0,
            isRunning: true,
            startedAt: startedAtMs,
            originalStartedAt: startedAtMs, // 원본 시작 시간 보존
            baseAccumulated: 0,
            timeOffset,
            status: "RUNNING",
            intervalId: null,
            refCount: 1, // 초기화 시 참조 카운트 1
          };
          const newTimers = new Map(state.timers);
          newTimers.set(planId, timerData);

          if (state.isVisible) {
            startGlobalInterval(get);
          }

          return { timers: newTimers };
        }

        // 상태 전환 검증: START (NOT_STARTED → RUNNING) 또는 RESUME (PAUSED → RUNNING)
        const action: TimerAction = timer.status === "PAUSED" ? "RESUME" : "START";
        const transitionResult = validateTimerTransition(timer.status, action);

        if (!transitionResult.valid) {
          console.warn("[planTimerStore] Invalid state transition:", transitionResult.error);
          return state; // 무효한 전환은 무시
        }

        const newTimer: PlanTimerData = {
          ...timer,
          isRunning: true,
          startedAt: startedAtMs, // 서버에서 받은 실제 시작 시각 사용
          // originalStartedAt이 없으면 현재 시작 시간으로 설정 (재개 시에는 기존 값 유지)
          originalStartedAt: timer.originalStartedAt ?? startedAtMs,
          baseAccumulated: timer.seconds, // 현재 시간을 base로 설정
          timeOffset,
          status: transitionResult.nextStatus,
        };

        const newTimers = new Map(state.timers);
        newTimers.set(planId, newTimer);

        if (state.isVisible) {
          startGlobalInterval(get);
        }

        return { timers: newTimers };
      });
    },

    pauseTimer: (planId, accumulatedSeconds) => {
      set((state) => {
        const timer = state.timers.get(planId);
        if (!timer) {
          return state;
        }

        // 상태 전환 검증: PAUSE (RUNNING → PAUSED)
        const transitionResult = validateTimerTransition(timer.status, "PAUSE");

        if (!transitionResult.valid) {
          console.warn("[planTimerStore] Invalid state transition:", transitionResult.error);
          return state; // 무효한 전환은 무시
        }

        const newTimer: PlanTimerData = {
          ...timer,
          isRunning: false,
          startedAt: null,
          baseAccumulated: accumulatedSeconds,
          seconds: accumulatedSeconds,
          status: transitionResult.nextStatus,
        };

        const newTimers = new Map(state.timers);
        newTimers.set(planId, newTimer);

        // 일시정지된 타이머가 마지막이면 global interval 정지
        let hasActiveTimers = false;
        newTimers.forEach((t) => {
          if (t.status === "RUNNING" && t.isRunning) {
            hasActiveTimers = true;
          }
        });

        if (!hasActiveTimers) {
          stopGlobalInterval();
        }

        return { timers: newTimers };
      });
    },

    stopTimer: (planId, accumulatedSeconds) => {
      set((state) => {
        const timer = state.timers.get(planId);
        if (!timer) {
          return state;
        }

        // 상태 전환 검증: COMPLETE (RUNNING → COMPLETED 또는 PAUSED → COMPLETED)
        const transitionResult = validateTimerTransition(timer.status, "COMPLETE");

        if (!transitionResult.valid) {
          console.warn("[planTimerStore] Invalid state transition:", transitionResult.error);
          return state; // 무효한 전환은 무시
        }

        const newTimer: PlanTimerData = {
          ...timer,
          isRunning: false,
          startedAt: null,
          baseAccumulated: accumulatedSeconds,
          seconds: accumulatedSeconds,
          status: transitionResult.nextStatus,
        };

        const newTimers = new Map(state.timers);
        newTimers.set(planId, newTimer);

        // 완료된 타이머가 마지막이면 global interval 정지
        let hasActiveTimers = false;
        newTimers.forEach((t) => {
          if (t.status === "RUNNING" && t.isRunning) {
            hasActiveTimers = true;
          }
        });

        if (!hasActiveTimers) {
          stopGlobalInterval();
        }

        return { timers: newTimers };
      });
    },

    syncNow: (planId, serverNow) => {
      const now = Date.now();
      const timeOffset = serverNow - now;

      set((state) => {
        const timer = state.timers.get(planId);
        if (!timer || timer.status !== "RUNNING" || !timer.isRunning) {
          return state;
        }

        // Drift-free 계산으로 현재 시간 업데이트
        const newSeconds = calculateDriftFreeSeconds(
          timer.startedAt,
          timer.baseAccumulated,
          timeOffset,
          now
        );

        const newTimer: PlanTimerData = {
          ...timer,
          seconds: newSeconds,
          baseAccumulated: newSeconds, // 동기화 시점의 시간을 base로 설정
          startedAt: now + timeOffset, // 새로운 시작 시점
          timeOffset,
        };

        const newTimers = new Map(state.timers);
        newTimers.set(planId, newTimer);

        return { timers: newTimers };
      });
    },

    updateTimerSeconds: (planId, seconds) => {
      set((state) => {
        const timer = state.timers.get(planId);
        if (!timer) {
          return state;
        }

        const newTimer: PlanTimerData = {
          ...timer,
          seconds,
        };

        const newTimers = new Map(state.timers);
        newTimers.set(planId, newTimer);

        return { timers: newTimers };
      });
    },

    addTimerRef: (planId) => {
      set((state) => {
        const timer = state.timers.get(planId);
        if (!timer) {
          return state;
        }

        const newTimer: PlanTimerData = {
          ...timer,
          refCount: timer.refCount + 1,
        };

        const newTimers = new Map(state.timers);
        newTimers.set(planId, newTimer);

        return { timers: newTimers };
      });
    },

    removeTimerRef: (planId) => {
      set((state) => {
        const timer = state.timers.get(planId);
        if (!timer) {
          return state;
        }

        const newRefCount = timer.refCount - 1;

        // 참조 카운트가 0 이하가 되면 타이머 제거
        if (newRefCount <= 0) {
          const newTimers = new Map(state.timers);
          newTimers.delete(planId);

          // 타이머가 없으면 global interval 정지
          if (newTimers.size === 0) {
            stopGlobalInterval();
          }

          return { timers: newTimers };
        }

        // 참조 카운트만 감소
        const newTimer: PlanTimerData = {
          ...timer,
          refCount: newRefCount,
        };

        const newTimers = new Map(state.timers);
        newTimers.set(planId, newTimer);

        return { timers: newTimers };
      });
    },

    removeTimer: (planId) => {
      set((state) => {
        const timer = state.timers.get(planId);
        if (!timer) {
          return state;
        }

        // 참조 카운트가 0일 때만 실제로 제거
        if (timer.refCount <= 1) {
          const newTimers = new Map(state.timers);
          newTimers.delete(planId);

          // 타이머가 없으면 global interval 정지
          if (newTimers.size === 0) {
            stopGlobalInterval();
          }

          return { timers: newTimers };
        }

        // 참조가 남아있으면 참조 카운트만 감소
        const newTimer: PlanTimerData = {
          ...timer,
          refCount: timer.refCount - 1,
        };

        const newTimers = new Map(state.timers);
        newTimers.set(planId, newTimer);

        return { timers: newTimers };
      });
    },

    clearAll: () => {
      stopGlobalInterval();
      set({ timers: new Map() });
    },
  };
});
