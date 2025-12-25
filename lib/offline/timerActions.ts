/**
 * Offline-Aware Timer Actions
 *
 * 네트워크 오류 시 오프라인 큐에 저장하고 복귀 시 자동 동기화합니다.
 */

import {
  startPlan,
  pausePlan,
  resumePlan,
  completePlan,
} from "@/lib/domains/today/actions/timer";
import type { PlanRecordPayload } from "@/lib/domains/today/types";
import {
  enqueueAction,
  registerActionExecutor,
  hasPendingActionsForPlan,
  getLastActionTypeForPlan,
} from "./queue";
import { isOnline, isNetworkError } from "./networkStatus";
import type { OfflineAction, OfflineActionType } from "./storage";

// 액션 실행기 등록
registerActionExecutor("START_PLAN", async (action) => {
  const result = await startPlan(action.planId, action.timestamp);
  return { success: result.success, error: result.error };
});

registerActionExecutor("PAUSE_PLAN", async (action) => {
  const result = await pausePlan(action.planId, action.timestamp);
  return { success: result.success, error: result.error };
});

registerActionExecutor("RESUME_PLAN", async (action) => {
  const result = await resumePlan(action.planId, action.timestamp);
  return { success: result.success, error: result.error };
});

registerActionExecutor("COMPLETE_PLAN", async (action) => {
  const payload = action.payload as PlanRecordPayload;
  const result = await completePlan(action.planId, payload);
  return { success: result.success, error: result.error };
});

export type OfflineAwareResult<T> = {
  /** 성공 여부 (오프라인 큐잉 포함) */
  success: boolean;
  /** 오프라인 큐에 저장됨 */
  queued: boolean;
  /** 큐 액션 ID (큐잉된 경우) */
  queuedActionId?: string;
  /** 원본 결과 (즉시 실행된 경우) */
  result?: T;
  /** 에러 메시지 */
  error?: string;
};

/**
 * 오프라인 지원 플랜 시작
 */
export async function startPlanOfflineAware(
  planId: string
): Promise<OfflineAwareResult<Awaited<ReturnType<typeof startPlan>>>> {
  const timestamp = new Date().toISOString();

  // 오프라인이면 큐에 저장
  if (!isOnline()) {
    const actionId = await enqueueAction("START_PLAN", planId, { timestamp });
    return {
      success: true,
      queued: true,
      queuedActionId: actionId,
    };
  }

  try {
    const result = await startPlan(planId, timestamp);

    if (!result.success && isNetworkError(new Error(result.error))) {
      // 네트워크 오류 - 큐에 저장
      const actionId = await enqueueAction("START_PLAN", planId, { timestamp });
      return {
        success: true,
        queued: true,
        queuedActionId: actionId,
      };
    }

    return {
      success: result.success,
      queued: false,
      result,
      error: result.error,
    };
  } catch (error) {
    if (isNetworkError(error)) {
      const actionId = await enqueueAction("START_PLAN", planId, { timestamp });
      return {
        success: true,
        queued: true,
        queuedActionId: actionId,
      };
    }

    return {
      success: false,
      queued: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 오프라인 지원 플랜 일시정지
 */
export async function pausePlanOfflineAware(
  planId: string
): Promise<OfflineAwareResult<Awaited<ReturnType<typeof pausePlan>>>> {
  const timestamp = new Date().toISOString();

  if (!isOnline()) {
    const actionId = await enqueueAction("PAUSE_PLAN", planId, { timestamp });
    return {
      success: true,
      queued: true,
      queuedActionId: actionId,
    };
  }

  try {
    const result = await pausePlan(planId, timestamp);

    if (!result.success && isNetworkError(new Error(result.error))) {
      const actionId = await enqueueAction("PAUSE_PLAN", planId, { timestamp });
      return {
        success: true,
        queued: true,
        queuedActionId: actionId,
      };
    }

    return {
      success: result.success,
      queued: false,
      result,
      error: result.error,
    };
  } catch (error) {
    if (isNetworkError(error)) {
      const actionId = await enqueueAction("PAUSE_PLAN", planId, { timestamp });
      return {
        success: true,
        queued: true,
        queuedActionId: actionId,
      };
    }

    return {
      success: false,
      queued: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 오프라인 지원 플랜 재개
 */
export async function resumePlanOfflineAware(
  planId: string
): Promise<OfflineAwareResult<Awaited<ReturnType<typeof resumePlan>>>> {
  const timestamp = new Date().toISOString();

  if (!isOnline()) {
    const actionId = await enqueueAction("RESUME_PLAN", planId, { timestamp });
    return {
      success: true,
      queued: true,
      queuedActionId: actionId,
    };
  }

  try {
    const result = await resumePlan(planId, timestamp);

    if (!result.success && isNetworkError(new Error(result.error))) {
      const actionId = await enqueueAction("RESUME_PLAN", planId, { timestamp });
      return {
        success: true,
        queued: true,
        queuedActionId: actionId,
      };
    }

    return {
      success: result.success,
      queued: false,
      result,
      error: result.error,
    };
  } catch (error) {
    if (isNetworkError(error)) {
      const actionId = await enqueueAction("RESUME_PLAN", planId, { timestamp });
      return {
        success: true,
        queued: true,
        queuedActionId: actionId,
      };
    }

    return {
      success: false,
      queued: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 오프라인 지원 플랜 완료
 *
 * 완료 액션은 중요도가 높으므로 항상 큐에 저장하고 동기화합니다.
 */
export async function completePlanOfflineAware(
  planId: string,
  payload: PlanRecordPayload
): Promise<OfflineAwareResult<Awaited<ReturnType<typeof completePlan>>>> {
  const timestamp = new Date().toISOString();

  if (!isOnline()) {
    const actionId = await enqueueAction("COMPLETE_PLAN", planId, {
      ...payload,
      timestamp,
    });
    return {
      success: true,
      queued: true,
      queuedActionId: actionId,
    };
  }

  try {
    const result = await completePlan(planId, payload);

    if (!result.success && isNetworkError(new Error(result.error))) {
      const actionId = await enqueueAction("COMPLETE_PLAN", planId, {
        ...payload,
        timestamp,
      });
      return {
        success: true,
        queued: true,
        queuedActionId: actionId,
      };
    }

    return {
      success: result.success,
      queued: false,
      result,
      error: result.error,
    };
  } catch (error) {
    if (isNetworkError(error)) {
      const actionId = await enqueueAction("COMPLETE_PLAN", planId, {
        ...payload,
        timestamp,
      });
      return {
        success: true,
        queued: true,
        queuedActionId: actionId,
      };
    }

    return {
      success: false,
      queued: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 특정 플랜에 대기 중인 오프라인 액션이 있는지 확인
 */
export async function hasPendingOfflineActions(planId: string): Promise<boolean> {
  return hasPendingActionsForPlan(planId);
}

/**
 * 특정 플랜의 예상 상태 조회 (오프라인 액션 고려)
 *
 * 오프라인 큐에 있는 마지막 액션을 기준으로 예상 상태를 반환합니다.
 */
export async function getExpectedTimerState(
  planId: string,
  currentState: "NOT_STARTED" | "RUNNING" | "PAUSED" | "COMPLETED"
): Promise<"NOT_STARTED" | "RUNNING" | "PAUSED" | "COMPLETED"> {
  const lastAction = await getLastActionTypeForPlan(planId);

  if (!lastAction) {
    return currentState;
  }

  switch (lastAction) {
    case "START_PLAN":
    case "RESUME_PLAN":
      return "RUNNING";
    case "PAUSE_PLAN":
      return "PAUSED";
    case "COMPLETE_PLAN":
      return "COMPLETED";
    default:
      return currentState;
  }
}
