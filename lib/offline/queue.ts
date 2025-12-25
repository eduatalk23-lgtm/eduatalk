/**
 * Offline Queue Manager
 *
 * 오프라인 작업을 큐에 저장하고 온라인 복귀 시 순차 처리합니다.
 */

import {
  saveOfflineAction,
  deleteOfflineAction,
  getAllPendingActions,
  cleanupOldActions,
  type OfflineAction,
  type OfflineActionType,
} from "./storage";
import {
  isOnline,
  addNetworkStatusListener,
  isNetworkError,
} from "./networkStatus";

// 재시도 설정
const MAX_RETRY_COUNT = 5;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

type ActionExecutor = (action: OfflineAction) => Promise<{ success: boolean; error?: string }>;

let actionExecutors: Map<OfflineActionType, ActionExecutor> = new Map();
let isProcessing = false;
let processingPromise: Promise<void> | null = null;

// 큐 상태 변경 리스너
type QueueStatusListener = (pendingCount: number, isProcessing: boolean) => void;
const queueStatusListeners: Set<QueueStatusListener> = new Set();

/**
 * 액션 실행기 등록
 */
export function registerActionExecutor(
  type: OfflineActionType,
  executor: ActionExecutor
): void {
  actionExecutors.set(type, executor);
}

/**
 * 큐 상태 리스너 등록
 */
export function addQueueStatusListener(listener: QueueStatusListener): () => void {
  queueStatusListeners.add(listener);

  // 초기 상태 전달
  getAllPendingActions().then((actions) => {
    listener(actions.length, isProcessing);
  });

  return () => {
    queueStatusListeners.delete(listener);
  };
}

/**
 * 큐 상태 변경 알림
 */
async function notifyQueueStatus(): Promise<void> {
  const actions = await getAllPendingActions();
  queueStatusListeners.forEach((listener) => {
    listener(actions.length, isProcessing);
  });
}

/**
 * 액션을 큐에 추가
 */
export async function enqueueAction(
  type: OfflineActionType,
  planId: string,
  payload: Record<string, unknown> = {}
): Promise<string> {
  const action: OfflineAction = {
    id: crypto.randomUUID(),
    type,
    planId,
    payload,
    timestamp: new Date().toISOString(),
    retryCount: 0,
    lastAttempt: null,
    createdAt: Date.now(),
  };

  await saveOfflineAction(action);
  await notifyQueueStatus();

  // 온라인이면 즉시 처리 시도
  if (isOnline()) {
    // 비동기로 처리 (await하지 않음)
    processQueue().catch(console.error);
  }

  return action.id;
}

/**
 * 지수 백오프 딜레이 계산
 */
function calculateRetryDelay(retryCount: number): number {
  const delay = Math.min(
    BASE_RETRY_DELAY_MS * Math.pow(2, retryCount),
    MAX_RETRY_DELAY_MS
  );
  // 지터 추가 (0-50% 랜덤)
  return delay + Math.random() * delay * 0.5;
}

/**
 * 단일 액션 처리
 */
async function processAction(action: OfflineAction): Promise<boolean> {
  const executor = actionExecutors.get(action.type);
  if (!executor) {
    console.error(`[OfflineQueue] 알 수 없는 액션 타입: ${action.type}`);
    await deleteOfflineAction(action.id);
    return true; // 처리 완료로 간주 (실행기가 없으면 삭제)
  }

  try {
    const result = await executor(action);

    if (result.success) {
      await deleteOfflineAction(action.id);
      console.log(`[OfflineQueue] 액션 처리 성공: ${action.type} (${action.planId})`);
      return true;
    }

    // 실패했지만 네트워크 오류가 아닌 경우 (비즈니스 로직 오류)
    // 재시도하지 않고 삭제
    if (!isNetworkError(new Error(result.error))) {
      console.warn(`[OfflineQueue] 비즈니스 오류로 액션 삭제: ${result.error}`);
      await deleteOfflineAction(action.id);
      return true;
    }

    // 네트워크 오류 - 재시도
    return false;
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn(`[OfflineQueue] 네트워크 오류, 재시도 예정: ${action.type}`);
      return false;
    }

    // 알 수 없는 오류 - 삭제
    console.error(`[OfflineQueue] 알 수 없는 오류로 액션 삭제:`, error);
    await deleteOfflineAction(action.id);
    return true;
  }
}

/**
 * 큐 처리
 */
export async function processQueue(): Promise<void> {
  // 이미 처리 중이면 기존 Promise 반환
  if (isProcessing && processingPromise) {
    return processingPromise;
  }

  // 오프라인이면 처리하지 않음
  if (!isOnline()) {
    return;
  }

  isProcessing = true;
  await notifyQueueStatus();

  processingPromise = (async () => {
    try {
      // 오래된 액션 정리
      await cleanupOldActions();

      // 모든 대기 중인 액션 조회
      const actions = await getAllPendingActions();

      if (actions.length === 0) {
        return;
      }

      console.log(`[OfflineQueue] ${actions.length}개의 대기 중인 액션 처리 시작`);

      // 같은 플랜에 대한 액션은 순서대로 처리
      // 다른 플랜의 액션은 병렬 처리 가능하지만, 단순화를 위해 순차 처리
      for (const action of actions) {
        // 오프라인이 되면 중단
        if (!isOnline()) {
          console.log("[OfflineQueue] 오프라인 전환으로 처리 중단");
          break;
        }

        // 재시도 횟수 초과 확인
        if (action.retryCount >= MAX_RETRY_COUNT) {
          console.warn(`[OfflineQueue] 최대 재시도 횟수 초과, 액션 삭제: ${action.type}`);
          await deleteOfflineAction(action.id);
          continue;
        }

        // 재시도 딜레이 확인
        if (action.lastAttempt) {
          const timeSinceLastAttempt = Date.now() - action.lastAttempt;
          const requiredDelay = calculateRetryDelay(action.retryCount);

          if (timeSinceLastAttempt < requiredDelay) {
            // 아직 딜레이 시간이 지나지 않음 - 다음 루프에서 처리
            continue;
          }
        }

        // 액션 처리 시도
        const success = await processAction(action);

        if (!success) {
          // 실패 시 재시도 카운트 증가
          const updatedAction: OfflineAction = {
            ...action,
            retryCount: action.retryCount + 1,
            lastAttempt: Date.now(),
          };
          await saveOfflineAction(updatedAction);
        }

        await notifyQueueStatus();
      }
    } catch (error) {
      console.error("[OfflineQueue] 큐 처리 중 오류:", error);
    } finally {
      isProcessing = false;
      processingPromise = null;
      await notifyQueueStatus();
    }
  })();

  return processingPromise;
}

/**
 * 네트워크 복귀 시 자동 처리 설정
 */
export function initQueueProcessor(): () => void {
  const unsubscribe = addNetworkStatusListener((online) => {
    if (online) {
      console.log("[OfflineQueue] 온라인 복귀, 큐 처리 시작");
      processQueue().catch(console.error);
    }
  });

  // 초기 로드 시 처리
  if (isOnline()) {
    processQueue().catch(console.error);
  }

  return unsubscribe;
}

/**
 * 특정 플랜의 대기 중인 액션 여부 확인
 */
export async function hasPendingActionsForPlan(planId: string): Promise<boolean> {
  const actions = await getAllPendingActions();
  return actions.some((action) => action.planId === planId);
}

/**
 * 특정 플랜의 마지막 액션 타입 조회
 */
export async function getLastActionTypeForPlan(
  planId: string
): Promise<OfflineActionType | null> {
  const actions = await getAllPendingActions();
  const planActions = actions
    .filter((action) => action.planId === planId)
    .sort((a, b) => b.createdAt - a.createdAt);

  return planActions.length > 0 ? planActions[0].type : null;
}
