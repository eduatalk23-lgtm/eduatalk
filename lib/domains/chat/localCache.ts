/**
 * Local-First 채팅 메시지 캐시 (IndexedDB)
 *
 * 채팅방별 최근 메시지를 브라우저에 캐시하여
 * 재진입 시 서버 응답 없이 즉시 렌더링.
 *
 * SWR 패턴: 캐시 먼저 표시 → 서버 데이터 도착 시 교체
 *
 * 기존 timelevelup_offline DB와 충돌 방지를 위해 별도 DB 사용.
 */

import type { CacheMessage } from "./cacheTypes";

// ============================================
// 상수
// ============================================

const DB_NAME = "timelevelup_chat_cache";
const DB_VERSION = 1;
const STORE_MESSAGES = "messages";
const STORE_ROOM_STATE = "room_state";

/** 채팅방당 최대 캐시 메시지 수 */
const MAX_CACHED_PER_ROOM = 200;
/** 최대 캐시 채팅방 수 (LRU 정리) */
const MAX_ROOMS = 20;

// ============================================
// 타입
// ============================================

export interface CachedRoomState {
  roomId: string;
  /** 최신 캐시 메시지의 ISO 타임스탬프 */
  lastSyncTimestamp: string;
  /** 스크롤 복원용 앵커 메시지 ID */
  anchorMessageId: string | null;
  /** LRU 정렬용 (Date.now()) */
  updatedAt: number;
}

// ============================================
// DB 연결
// ============================================

let dbPromise: Promise<IDBDatabase> | null = null;

function openChatCacheDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // messages 스토어: room_id + created_at 복합 인덱스로 범위 조회
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const msgStore = db.createObjectStore(STORE_MESSAGES, { keyPath: "id" });
        msgStore.createIndex("room_time", ["room_id", "created_at"], { unique: false });
        msgStore.createIndex("room_id", "room_id", { unique: false });
      }

      // room_state 스토어: 채팅방별 동기화 상태
      if (!db.objectStoreNames.contains(STORE_ROOM_STATE)) {
        db.createObjectStore(STORE_ROOM_STATE, { keyPath: "roomId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

// ============================================
// 메시지 캐시 CRUD
// ============================================

/**
 * 메시지를 IndexedDB에 캐시 (upsert)
 * 기존 메시지가 있으면 덮어씀 (서버 데이터가 최신)
 */
export async function cacheMessages(
  roomId: string,
  messages: CacheMessage[]
): Promise<void> {
  if (messages.length === 0) return;

  const db = await openChatCacheDB();
  const tx = db.transaction(STORE_MESSAGES, "readwrite");
  const store = tx.objectStore(STORE_MESSAGES);

  for (const msg of messages) {
    // status 필드는 캐시하지 않음 (transient state)
    const { status, readCount, ...rest } = msg;
    void status;
    void readCount;
    store.put(rest);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 채팅방당 최대 개수 초과 시 오래된 메시지 정리
  await evictExcessMessages(roomId);
}

/**
 * 채팅방의 캐시된 메시지 조회 (created_at 오름차순)
 */
export async function getCachedMessages(
  roomId: string,
  limit: number = MAX_CACHED_PER_ROOM
): Promise<CacheMessage[]> {
  const db = await openChatCacheDB();
  const tx = db.transaction(STORE_MESSAGES, "readonly");
  const store = tx.objectStore(STORE_MESSAGES);
  const index = store.index("room_time");

  // room_id 범위 내에서 created_at 오름차순 조회
  const range = IDBKeyRange.bound(
    [roomId, ""],
    [roomId, "\uffff"]
  );

  return new Promise<CacheMessage[]>((resolve, reject) => {
    const results: CacheMessage[] = [];
    const request = index.openCursor(range, "prev"); // 최신부터 역순

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value as CacheMessage);
        cursor.continue();
      } else {
        // 시간 오름차순으로 반환
        resolve(results.reverse());
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// Room State CRUD
// ============================================

export async function getCachedRoomState(
  roomId: string
): Promise<CachedRoomState | null> {
  const db = await openChatCacheDB();
  const tx = db.transaction(STORE_ROOM_STATE, "readonly");
  const store = tx.objectStore(STORE_ROOM_STATE);

  return new Promise<CachedRoomState | null>((resolve, reject) => {
    const request = store.get(roomId);
    request.onsuccess = () => resolve((request.result as CachedRoomState) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function setCachedRoomState(
  roomId: string,
  state: Partial<Omit<CachedRoomState, "roomId">>
): Promise<void> {
  const db = await openChatCacheDB();
  const tx = db.transaction(STORE_ROOM_STATE, "readwrite");
  const store = tx.objectStore(STORE_ROOM_STATE);

  // 기존 상태와 병합
  const existing = await new Promise<CachedRoomState | undefined>((resolve) => {
    const req = store.get(roomId);
    req.onsuccess = () => resolve(req.result as CachedRoomState | undefined);
    req.onerror = () => resolve(undefined);
  });

  const merged: CachedRoomState = {
    roomId,
    lastSyncTimestamp: existing?.lastSyncTimestamp ?? "",
    anchorMessageId: existing?.anchorMessageId ?? null,
    updatedAt: Date.now(),
    ...existing,
    ...state,
  };

  store.put(merged);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================
// 정리 (Eviction)
// ============================================

/**
 * 채팅방당 MAX_CACHED_PER_ROOM 초과 메시지 정리 (가장 오래된 것부터 삭제)
 */
async function evictExcessMessages(roomId: string): Promise<void> {
  const db = await openChatCacheDB();
  const tx = db.transaction(STORE_MESSAGES, "readwrite");
  const store = tx.objectStore(STORE_MESSAGES);
  const index = store.index("room_time");

  const range = IDBKeyRange.bound([roomId, ""], [roomId, "\uffff"]);

  // 전체 개수 확인
  const count = await new Promise<number>((resolve, reject) => {
    const req = index.count(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (count <= MAX_CACHED_PER_ROOM) return;

  // 오래된 것부터 삭제
  const deleteCount = count - MAX_CACHED_PER_ROOM;
  let deleted = 0;

  await new Promise<void>((resolve, reject) => {
    const request = index.openCursor(range, "next"); // 오래된 순
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && deleted < deleteCount) {
        cursor.delete();
        deleted++;
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * 오래된 채팅방 캐시 정리 (LRU, maxRooms 초과 시)
 */
export async function evictOldRooms(maxRooms: number = MAX_ROOMS): Promise<void> {
  const db = await openChatCacheDB();

  // 모든 room state 조회
  const states = await new Promise<CachedRoomState[]>((resolve, reject) => {
    const tx = db.transaction(STORE_ROOM_STATE, "readonly");
    const store = tx.objectStore(STORE_ROOM_STATE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as CachedRoomState[]);
    req.onerror = () => reject(req.error);
  });

  if (states.length <= maxRooms) return;

  // LRU: updatedAt 기준 오래된 순 정렬 → 초과분 삭제
  states.sort((a, b) => a.updatedAt - b.updatedAt);
  const toEvict = states.slice(0, states.length - maxRooms);

  for (const state of toEvict) {
    await evictRoom(state.roomId);
  }
}

/**
 * 특정 채팅방의 캐시 전체 삭제
 */
export async function evictRoom(roomId: string): Promise<void> {
  const db = await openChatCacheDB();
  const tx = db.transaction([STORE_MESSAGES, STORE_ROOM_STATE], "readwrite");

  // 메시지 삭제
  const msgStore = tx.objectStore(STORE_MESSAGES);
  const msgIndex = msgStore.index("room_id");
  const range = IDBKeyRange.only(roomId);

  await new Promise<void>((resolve, reject) => {
    const request = msgIndex.openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });

  // room state 삭제
  tx.objectStore(STORE_ROOM_STATE).delete(roomId);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
