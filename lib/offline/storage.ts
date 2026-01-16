/**
 * IndexedDB Storage for Offline Queue
 *
 * 오프라인 작업을 IndexedDB에 영구 저장하여 브라우저를 닫아도 유지됩니다.
 */

import { logActionDebug, logActionError } from "@/lib/utils/serverActionLogger";

const DB_NAME = "timelevelup_offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_actions";

export type OfflineActionType =
  | "START_PLAN"
  | "PAUSE_PLAN"
  | "RESUME_PLAN"
  | "COMPLETE_PLAN"
  | "SEND_CHAT_MESSAGE";

export type OfflineAction = {
  /** 고유 ID (UUID) */
  id: string;
  /** 액션 타입 */
  type: OfflineActionType;
  /** 플랜 ID */
  planId: string;
  /** 액션별 페이로드 */
  payload: Record<string, unknown>;
  /** 클라이언트에서 생성한 타임스탬프 */
  timestamp: string;
  /** 재시도 횟수 */
  retryCount: number;
  /** 마지막 시도 시각 */
  lastAttempt: number | null;
  /** 생성 시각 */
  createdAt: number;
};

let dbInstance: IDBDatabase | null = null;

/**
 * IndexedDB 연결
 */
async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      logActionError("OfflineStorage.getDB", `DB 열기 실패: ${request.error?.message || "unknown"}`);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // 연결이 끊어졌을 때 재연결 처리
      dbInstance.onclose = () => {
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // pending_actions 스토어 생성
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("planId", "planId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }
    };
  });
}

/**
 * 오프라인 액션 저장
 */
export async function saveOfflineAction(action: OfflineAction): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.put(action);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        logActionError("OfflineStorage.saveOfflineAction", `액션 저장 실패: ${request.error?.message || "unknown"}`);
        reject(request.error);
      };
    });
  } catch (error) {
    logActionError("OfflineStorage.saveOfflineAction", `액션 저장 중 예외: ${error instanceof Error ? error.message : "unknown"}`);
    throw error;
  }
}

/**
 * 특정 액션 삭제
 */
export async function deleteOfflineAction(actionId: string): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(actionId);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        logActionError("OfflineStorage.deleteOfflineAction", `액션 삭제 실패: ${request.error?.message || "unknown"}`);
        reject(request.error);
      };
    });
  } catch (error) {
    logActionError("OfflineStorage.deleteOfflineAction", `액션 삭제 중 예외: ${error instanceof Error ? error.message : "unknown"}`);
    throw error;
  }
}

/**
 * 모든 대기 중인 액션 조회 (생성 시각 순)
 */
export async function getAllPendingActions(): Promise<OfflineAction[]> {
  try {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("createdAt");

    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        logActionError("OfflineStorage.getAllPendingActions", `액션 조회 실패: ${request.error?.message || "unknown"}`);
        reject(request.error);
      };
    });
  } catch (error) {
    logActionError("OfflineStorage.getAllPendingActions", `액션 조회 중 예외: ${error instanceof Error ? error.message : "unknown"}`);
    return [];
  }
}

/**
 * 특정 플랜의 대기 중인 액션 조회
 */
export async function getPendingActionsForPlan(
  planId: string
): Promise<OfflineAction[]> {
  try {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("planId");

    return new Promise((resolve, reject) => {
      const request = index.getAll(planId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        logActionError("OfflineStorage.getPendingActionsForPlan", `플랜 액션 조회 실패: ${request.error?.message || "unknown"}`);
        reject(request.error);
      };
    });
  } catch (error) {
    logActionError("OfflineStorage.getPendingActionsForPlan", `플랜 액션 조회 중 예외: ${error instanceof Error ? error.message : "unknown"}`);
    return [];
  }
}

/**
 * 특정 플랜의 모든 대기 중인 액션 삭제
 */
export async function deletePendingActionsForPlan(
  planId: string
): Promise<void> {
  try {
    const actions = await getPendingActionsForPlan(planId);
    await Promise.all(actions.map((action) => deleteOfflineAction(action.id)));
  } catch (error) {
    logActionError("OfflineStorage.deletePendingActionsForPlan", `플랜 액션 삭제 중 예외: ${error instanceof Error ? error.message : "unknown"}`);
    throw error;
  }
}

/**
 * 오래된 액션 정리 (24시간 이상 경과)
 */
export async function cleanupOldActions(): Promise<number> {
  try {
    const actions = await getAllPendingActions();
    const now = Date.now();
    const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24시간

    let deletedCount = 0;
    for (const action of actions) {
      if (now - action.createdAt > MAX_AGE_MS) {
        await deleteOfflineAction(action.id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logActionDebug("OfflineStorage.cleanupOldActions", `${deletedCount}개의 오래된 액션 정리됨`);
    }

    return deletedCount;
  } catch (error) {
    logActionError("OfflineStorage.cleanupOldActions", `오래된 액션 정리 중 예외: ${error instanceof Error ? error.message : "unknown"}`);
    return 0;
  }
}

/**
 * IndexedDB 지원 여부 확인
 */
export function isIndexedDBSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

/**
 * 대기 중인 액션 개수 조회
 */
export async function getPendingActionCount(): Promise<number> {
  try {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        logActionError("OfflineStorage.getPendingActionCount", `액션 개수 조회 실패: ${request.error?.message || "unknown"}`);
        reject(request.error);
      };
    });
  } catch (error) {
    logActionError("OfflineStorage.getPendingActionCount", `액션 개수 조회 중 예외: ${error instanceof Error ? error.message : "unknown"}`);
    return 0;
  }
}
