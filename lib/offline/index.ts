/**
 * Offline Support Module
 *
 * 네트워크 오류 시 학습 데이터를 보호하는 오프라인 큐 시스템입니다.
 *
 * @example
 * // 오프라인 지원 타이머 액션 사용
 * import {
 *   startPlanOfflineAware,
 *   pausePlanOfflineAware,
 *   resumePlanOfflineAware,
 *   completePlanOfflineAware,
 * } from "@/lib/offline";
 *
 * const result = await startPlanOfflineAware(planId);
 * if (result.queued) {
 *   // 오프라인으로 큐에 저장됨 - UI에 동기화 대기 표시
 *   showSyncPendingIndicator();
 * } else if (result.success) {
 *   // 즉시 성공
 *   updateUIWithResult(result.result);
 * }
 *
 * @example
 * // 큐 상태 모니터링
 * import { useOfflineQueue } from "@/lib/offline";
 *
 * function SyncStatusIndicator() {
 *   const { pendingCount, isProcessing, isOnline } = useOfflineQueue();
 *
 *   if (!isOnline) {
 *     return <Badge variant="warning">오프라인</Badge>;
 *   }
 *
 *   if (pendingCount > 0) {
 *     return <Badge variant="info">동기화 중 ({pendingCount})</Badge>;
 *   }
 *
 *   return null;
 * }
 */

// Storage
export {
  type OfflineAction,
  type OfflineActionType,
  isIndexedDBSupported,
  getPendingActionCount,
} from "./storage";

// Network Status
export {
  isOnline,
  addNetworkStatusListener,
  initNetworkStatusListeners,
  cleanupNetworkStatusListeners,
  waitForOnline,
  isNetworkError,
} from "./networkStatus";

// Queue
export {
  enqueueAction,
  registerActionExecutor,
  addQueueStatusListener,
  processQueue,
  initQueueProcessor,
  hasPendingActionsForPlan,
  getLastActionTypeForPlan,
} from "./queue";

// Timer Actions
export {
  startPlanOfflineAware,
  pausePlanOfflineAware,
  resumePlanOfflineAware,
  completePlanOfflineAware,
  hasPendingOfflineActions,
  getExpectedTimerState,
  type OfflineAwareResult,
} from "./timerActions";

// React Hook
export { useOfflineQueue } from "./useOfflineQueue";
