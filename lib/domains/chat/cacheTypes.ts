/**
 * Chat Cache Type-Safe Utilities
 *
 * React Query 캐시를 안전하게 업데이트하기 위한 타입과 유틸리티 함수
 */

import type { InfiniteData } from "@tanstack/react-query";
import type {
  ChatMessageWithSender,
  MessagesWithReadStatusResult,
} from "./types";

// ============================================
// 캐시 타입 정의
// ============================================

/**
 * 낙관적 업데이트 status를 포함한 캐시 메시지 타입
 */
export type CacheMessage = ChatMessageWithSender & {
  status?: "sending" | "sent" | "error" | "queued";
  /** 본인 메시지의 읽지 않은 수 (KakaoTalk-style) */
  readCount?: number;
};

/**
 * InfiniteQuery 페이지 타입
 */
export type MessagesPage = Omit<MessagesWithReadStatusResult, "messages"> & {
  messages: CacheMessage[];
};

/**
 * InfiniteQuery 캐시 구조
 */
export type InfiniteMessagesCache = InfiniteData<MessagesPage, string | undefined>;

/**
 * 메시지 업데이터 함수 타입
 */
export type MessageUpdater = (message: CacheMessage) => CacheMessage;

/**
 * 페이지 업데이터 함수 타입
 */
export type PageUpdater = (page: MessagesPage) => MessagesPage;

// ============================================
// 타입 안전 캐시 업데이트 함수
// ============================================

/**
 * 특정 메시지를 찾아서 업데이트
 *
 * @param cache - InfiniteQuery 캐시
 * @param messageId - 업데이트할 메시지 ID
 * @param updater - 메시지 업데이트 함수
 * @returns 업데이트된 캐시 (또는 undefined)
 */
export function updateMessageInCache(
  cache: InfiniteMessagesCache | undefined,
  messageId: string,
  updater: MessageUpdater
): InfiniteMessagesCache | undefined {
  if (!cache?.pages?.length) return cache;

  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      messages: page.messages.map((m) => (m.id === messageId ? updater(m) : m)),
    })),
  };
}

/**
 * 특정 조건에 맞는 메시지를 찾아서 업데이트
 *
 * @param cache - InfiniteQuery 캐시
 * @param predicate - 메시지 찾기 조건
 * @param updater - 메시지 업데이트 함수
 * @returns 업데이트된 캐시 (또는 undefined)
 */
export function updateMessageWhere(
  cache: InfiniteMessagesCache | undefined,
  predicate: (message: CacheMessage) => boolean,
  updater: MessageUpdater
): InfiniteMessagesCache | undefined {
  if (!cache?.pages?.length) return cache;

  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      messages: page.messages.map((m) => (predicate(m) ? updater(m) : m)),
    })),
  };
}

/**
 * 첫 번째 페이지에 메시지 추가
 *
 * @param cache - InfiniteQuery 캐시
 * @param message - 추가할 메시지
 * @returns 업데이트된 캐시 (또는 undefined)
 */
export function addMessageToFirstPage(
  cache: InfiniteMessagesCache | undefined,
  message: CacheMessage
): InfiniteMessagesCache | undefined {
  // 캐시가 아직 hydration되지 않은 경우 (로딩 중 전송) 초기 페이지 구조 생성
  if (!cache?.pages?.length) {
    const readCounts: Record<string, number> = {};
    if (message.readCount !== undefined) {
      readCounts[message.id] = message.readCount;
    }
    return {
      pages: [{ messages: [message], readCounts, hasMore: false }],
      pageParams: [undefined],
    };
  }

  const firstPage = cache.pages[0];
  const updatedReadCounts =
    message.readCount !== undefined
      ? { ...firstPage.readCounts, [message.id]: message.readCount }
      : firstPage.readCounts;

  return {
    ...cache,
    pages: [
      {
        ...firstPage,
        messages: [...firstPage.messages, message],
        readCounts: updatedReadCounts,
      },
      ...cache.pages.slice(1),
    ],
  };
}

/**
 * 첫 번째 페이지의 메시지 교체 (tempId → realId)
 *
 * @param cache - InfiniteQuery 캐시
 * @param tempId - 임시 메시지 ID
 * @param realMessage - 실제 메시지 데이터
 * @returns 업데이트된 캐시 (또는 undefined)
 */
export function replaceMessageInFirstPage(
  cache: InfiniteMessagesCache | undefined,
  tempId: string,
  realMessage: Partial<CacheMessage>
): InfiniteMessagesCache | undefined {
  if (!cache?.pages?.length) return cache;

  const firstPage = cache.pages[0];
  const existingIndex = firstPage.messages.findIndex((m) => m.id === tempId);

  if (existingIndex === -1) return cache;

  const updatedMessages = [...firstPage.messages];
  const existingMessage = updatedMessages[existingIndex];
  // readCount 이관: 기존 낙관적 메시지의 readCount 보존
  // (서버 응답 realMessage에는 readCount 미포함 → 낙관적 값 우선)
  const preservedReadCount = existingMessage.readCount;
  updatedMessages[existingIndex] = {
    ...existingMessage,
    ...realMessage,
    status: "sent" as const,
    readCount: preservedReadCount,
    // sender 정보는 낙관적 업데이트에서 이미 설정됨
    sender: existingMessage.sender,
    replyTarget: existingMessage.replyTarget,
  };

  // readCounts 딕셔너리에서도 tempId → realId 이관
  const updatedReadCounts = { ...firstPage.readCounts };
  if (tempId in updatedReadCounts) {
    const realId = realMessage.id ?? updatedMessages[existingIndex].id;
    updatedReadCounts[realId] = updatedReadCounts[tempId];
    delete updatedReadCounts[tempId];
  }

  return {
    ...cache,
    pages: [
      { ...firstPage, messages: updatedMessages, readCounts: updatedReadCounts },
      ...cache.pages.slice(1),
    ],
  };
}

/**
 * 특정 메시지 제거
 *
 * @param cache - InfiniteQuery 캐시
 * @param messageId - 제거할 메시지 ID
 * @returns 업데이트된 캐시 (또는 undefined)
 */
export function removeMessageFromCache(
  cache: InfiniteMessagesCache | undefined,
  messageId: string
): InfiniteMessagesCache | undefined {
  if (!cache?.pages?.length) return cache;

  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      messages: page.messages.filter((m) => m.id !== messageId),
    })),
  };
}

/**
 * 모든 페이지에 업데이터 적용
 *
 * @param cache - InfiniteQuery 캐시
 * @param updater - 페이지 업데이트 함수
 * @returns 업데이트된 캐시 (또는 undefined)
 */
export function updateAllPages(
  cache: InfiniteMessagesCache | undefined,
  updater: PageUpdater
): InfiniteMessagesCache | undefined {
  if (!cache?.pages?.length) return cache;

  return {
    ...cache,
    pages: cache.pages.map(updater),
  };
}

/**
 * 첫 번째 페이지 업데이트
 *
 * @param cache - InfiniteQuery 캐시
 * @param updater - 페이지 업데이트 함수
 * @returns 업데이트된 캐시 (또는 undefined)
 */
export function updateFirstPage(
  cache: InfiniteMessagesCache | undefined,
  updater: PageUpdater
): InfiniteMessagesCache | undefined {
  if (!cache?.pages?.length) return cache;

  const firstPage = cache.pages[0];
  return {
    ...cache,
    pages: [updater(firstPage), ...cache.pages.slice(1)],
  };
}

// ============================================
// 읽음 카운트 헬퍼
// ============================================

/**
 * READ_RECEIPT 수신 시 해당 reader가 읽은 메시지들의 readCount를 감소
 *
 * @param cache - InfiniteQuery 캐시
 * @param senderId - 현재 사용자 ID (본인 메시지만 대상)
 * @param readAt - reader가 읽은 시각
 * @param prevReadAt - 해당 reader의 이전 읽음 시각
 * @returns 업데이트된 캐시 (또는 undefined, 변경 없으면 원본 반환)
 */
export function decrementReadCountsForReceipt(
  cache: InfiniteMessagesCache | undefined,
  senderId: string,
  readAt: string,
  prevReadAt: string
): InfiniteMessagesCache | undefined {
  if (!cache?.pages?.length) return cache;

  let hasChanges = false;

  const updatedPages = cache.pages.map((page) => {
    // 빠른 스킵: 본인 메시지가 없는 페이지 건너뛰기
    const hasOwnMessages = page.messages.some((m) => m.sender_id === senderId);
    if (!hasOwnMessages) return page;

    let pageChanged = false;
    const updatedMessages = page.messages.map((m) => {
      // 빈도순 필터: sender → readCount 존재 → 시간 범위 (가장 비싼 비교 마지막)
      if (
        m.sender_id !== senderId ||
        m.readCount === undefined ||
        m.readCount <= 0
      ) return m;

      if (m.created_at > prevReadAt && m.created_at <= readAt) {
        pageChanged = true;
        return { ...m, readCount: m.readCount - 1 };
      }
      return m;
    });

    if (pageChanged) {
      hasChanges = true;
      const updatedReadCounts = { ...page.readCounts };
      for (let i = 0; i < updatedMessages.length; i++) {
        const msg = updatedMessages[i];
        if (msg !== page.messages[i] && msg.readCount !== undefined) {
          updatedReadCounts[msg.id] = msg.readCount;
        }
      }
      return { ...page, messages: updatedMessages, readCounts: updatedReadCounts };
    }
    return page;
  });

  if (!hasChanges) return cache;

  return { ...cache, pages: updatedPages };
}

// ============================================
// 메시지 찾기 헬퍼
// ============================================

/**
 * 캐시에서 특정 메시지 찾기
 *
 * @param cache - InfiniteQuery 캐시
 * @param messageId - 메시지 ID
 * @returns 메시지 (또는 undefined)
 */
export function findMessageInCache(
  cache: InfiniteMessagesCache | undefined,
  messageId: string
): CacheMessage | undefined {
  if (!cache?.pages) return undefined;

  for (const page of cache.pages) {
    const message = page.messages.find((m) => m.id === messageId);
    if (message) return message;
  }

  return undefined;
}

/**
 * 캐시에서 조건에 맞는 첫 번째 메시지 찾기
 *
 * @param cache - InfiniteQuery 캐시
 * @param predicate - 찾기 조건
 * @returns 메시지 (또는 undefined)
 */
export function findMessageWhere(
  cache: InfiniteMessagesCache | undefined,
  predicate: (message: CacheMessage) => boolean
): CacheMessage | undefined {
  if (!cache?.pages) return undefined;

  for (const page of cache.pages) {
    const message = page.messages.find(predicate);
    if (message) return message;
  }

  return undefined;
}
