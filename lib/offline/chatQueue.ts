/**
 * Chat Message Offline Queue
 *
 * 오프라인 상태에서 전송된 채팅 메시지를 큐에 저장하고
 * 온라인 복귀 시 순차적으로 전송합니다.
 */

import {
  saveOfflineAction,
  deleteOfflineAction,
  getAllPendingActions,
  type OfflineAction,
} from "./storage";
import { logActionDebug, logActionError, logActionWarn } from "@/lib/utils/serverActionLogger";
import {
  isOnline,
  addNetworkStatusListener,
  isNetworkError,
} from "./networkStatus";

// 재시도 설정
const MAX_RETRY_COUNT = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;

/** 채팅 메시지 큐 아이템 */
export interface ChatMessageQueueItem {
  id: string;
  roomId: string;
  content: string;
  replyToId: string | null;
  tempId: string;
  createdAt: number;
  retryCount: number;
}

/** 메시지 전송 함수 타입 */
type MessageSender = (
  roomId: string,
  content: string,
  replyToId: string | null
) => Promise<{ success: boolean; error?: string; data?: { id: string } }>;

let messageSender: MessageSender | null = null;
let isProcessing = false;

/** 큐 상태 리스너 */
type ChatQueueStatusListener = (pendingCount: number, isProcessing: boolean) => void;
const queueStatusListeners = new Set<ChatQueueStatusListener>();

/**
 * 메시지 전송 함수 등록
 */
export function registerMessageSender(sender: MessageSender): void {
  messageSender = sender;
}

/**
 * 큐 상태 리스너 등록
 */
export function addChatQueueStatusListener(
  listener: ChatQueueStatusListener
): () => void {
  queueStatusListeners.add(listener);

  // 초기 상태 전달
  getChatQueueCount().then((count) => {
    listener(count, isProcessing);
  });

  return () => {
    queueStatusListeners.delete(listener);
  };
}

/**
 * 큐 상태 변경 알림
 */
async function notifyQueueStatus(): Promise<void> {
  const count = await getChatQueueCount();
  queueStatusListeners.forEach((listener) => {
    listener(count, isProcessing);
  });
}

/**
 * 채팅 메시지 큐 개수 조회
 */
export async function getChatQueueCount(): Promise<number> {
  const actions = await getAllPendingActions();
  return actions.filter((a) => a.type === "SEND_CHAT_MESSAGE").length;
}

/**
 * 특정 방의 대기 메시지 조회
 */
export async function getChatQueueForRoom(
  roomId: string
): Promise<ChatMessageQueueItem[]> {
  const actions = await getAllPendingActions();
  return actions
    .filter(
      (a) =>
        a.type === "SEND_CHAT_MESSAGE" &&
        a.payload.roomId === roomId
    )
    .map((a) => ({
      id: a.id,
      roomId: a.payload.roomId as string,
      content: a.payload.content as string,
      replyToId: (a.payload.replyToId as string | null) ?? null,
      tempId: a.payload.tempId as string,
      createdAt: a.createdAt,
      retryCount: a.retryCount,
    }));
}

/**
 * 채팅 메시지를 큐에 추가
 * @returns tempId 낙관적 업데이트용 임시 ID
 */
export async function enqueueChatMessage(
  roomId: string,
  content: string,
  replyToId?: string | null
): Promise<string> {
  const tempId = `temp-offline-${Date.now()}`;

  const action: OfflineAction = {
    id: crypto.randomUUID(),
    type: "SEND_CHAT_MESSAGE",
    planId: roomId, // roomId를 planId 필드에 저장 (호환성)
    payload: {
      roomId,
      content,
      replyToId: replyToId ?? null,
      tempId,
    },
    timestamp: new Date().toISOString(),
    retryCount: 0,
    lastAttempt: null,
    createdAt: Date.now(),
  };

  await saveOfflineAction(action);
  await notifyQueueStatus();

  logActionDebug(
    "ChatQueue.enqueueChatMessage",
    `Message queued for room ${roomId} (tempId: ${tempId})`
  );

  // 온라인이면 즉시 처리 시도
  if (isOnline()) {
    processChatQueue().catch((err) =>
      logActionError(
        "ChatQueue.enqueueChatMessage",
        err instanceof Error ? err.message : String(err)
      )
    );
  }

  return tempId;
}

/**
 * 지수 백오프 딜레이 계산
 */
function calculateRetryDelay(retryCount: number): number {
  const delay = Math.min(
    BASE_RETRY_DELAY_MS * Math.pow(2, retryCount),
    MAX_RETRY_DELAY_MS
  );
  // 지터 추가 (0-30% 랜덤)
  return delay + Math.random() * delay * 0.3;
}

/**
 * 단일 메시지 처리
 */
async function processMessage(action: OfflineAction): Promise<boolean> {
  if (!messageSender) {
    logActionError("ChatQueue.processMessage", "Message sender not registered");
    return false;
  }

  const { roomId, content, replyToId } = action.payload as {
    roomId: string;
    content: string;
    replyToId: string | null;
  };

  try {
    const result = await messageSender(roomId, content, replyToId);

    if (result.success) {
      await deleteOfflineAction(action.id);
      logActionDebug(
        "ChatQueue.processMessage",
        `Message sent successfully: ${action.id}`
      );
      return true;
    }

    // 실패했지만 네트워크 오류가 아닌 경우 (비즈니스 로직 오류)
    if (!isNetworkError(new Error(result.error))) {
      logActionWarn(
        "ChatQueue.processMessage",
        `Business error, removing message: ${result.error}`
      );
      await deleteOfflineAction(action.id);
      return true;
    }

    // 네트워크 오류 - 재시도
    return false;
  } catch (error) {
    if (isNetworkError(error)) {
      logActionWarn(
        "ChatQueue.processMessage",
        `Network error, will retry: ${action.id}`
      );
      return false;
    }

    // 알 수 없는 오류 - 삭제
    logActionError(
      "ChatQueue.processMessage",
      `Unknown error, removing message: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    await deleteOfflineAction(action.id);
    return true;
  }
}

/**
 * 채팅 메시지 큐 처리
 */
export async function processChatQueue(): Promise<void> {
  // 이미 처리 중이면 스킵
  if (isProcessing) {
    return;
  }

  // 오프라인이면 처리하지 않음
  if (!isOnline()) {
    return;
  }

  isProcessing = true;
  await notifyQueueStatus();

  try {
    const actions = await getAllPendingActions();
    const chatActions = actions.filter((a) => a.type === "SEND_CHAT_MESSAGE");

    if (chatActions.length === 0) {
      return;
    }

    logActionDebug(
      "ChatQueue.processChatQueue",
      `Processing ${chatActions.length} queued messages`
    );

    // 순서대로 처리 (같은 방의 메시지는 순서 유지 필요)
    for (const action of chatActions) {
      // 오프라인이 되면 중단
      if (!isOnline()) {
        logActionDebug("ChatQueue.processChatQueue", "Offline, stopping");
        break;
      }

      // 최대 재시도 횟수 초과
      if (action.retryCount >= MAX_RETRY_COUNT) {
        logActionWarn(
          "ChatQueue.processChatQueue",
          `Max retry exceeded, removing: ${action.id}`
        );
        await deleteOfflineAction(action.id);
        continue;
      }

      // 재시도 딜레이 확인
      if (action.lastAttempt) {
        const timeSinceLastAttempt = Date.now() - action.lastAttempt;
        const requiredDelay = calculateRetryDelay(action.retryCount);

        if (timeSinceLastAttempt < requiredDelay) {
          continue;
        }
      }

      // 메시지 처리 시도
      const success = await processMessage(action);

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
    logActionError(
      "ChatQueue.processChatQueue",
      `Queue processing error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    isProcessing = false;
    await notifyQueueStatus();
  }
}

/**
 * 특정 메시지 삭제 (취소)
 */
export async function removeChatQueueItem(actionId: string): Promise<void> {
  await deleteOfflineAction(actionId);
  await notifyQueueStatus();
}

/**
 * 채팅 큐 프로세서 초기화
 */
export function initChatQueueProcessor(): () => void {
  const unsubscribe = addNetworkStatusListener((online) => {
    if (online) {
      logActionDebug("ChatQueue.initChatQueueProcessor", "Online, processing queue");
      processChatQueue().catch((err) =>
        logActionError(
          "ChatQueue.initChatQueueProcessor",
          err instanceof Error ? err.message : String(err)
        )
      );
    }
  });

  // 초기 로드 시 처리
  if (isOnline()) {
    processChatQueue().catch((err) =>
      logActionError(
        "ChatQueue.initChatQueueProcessor",
        err instanceof Error ? err.message : String(err)
      )
    );
  }

  return unsubscribe;
}
