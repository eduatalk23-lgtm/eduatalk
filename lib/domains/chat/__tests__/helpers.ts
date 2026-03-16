/**
 * Chat 테스트 헬퍼 — 메시지/페이지 팩토리
 */

import type { ChatMessageWithSender, ChatUserType, ChatMessageType } from "../types";
import type { CacheMessage, MessagesPage, InfiniteMessagesCache } from "../cacheTypes";

let msgCounter = 0;

/**
 * 테스트용 메시지 생성
 * created_at은 기본적으로 호출 순서대로 10초 간격으로 증가
 */
export function makeMessage(
  overrides: Partial<CacheMessage> & { id?: string; created_at?: string } = {}
): CacheMessage {
  msgCounter++;
  const id = overrides.id ?? `msg-${msgCounter}`;
  const baseTime = new Date("2026-03-16T10:00:00Z");
  baseTime.setSeconds(baseTime.getSeconds() + msgCounter * 10);

  return {
    id,
    room_id: "room-1",
    sender_id: "user-A",
    sender_type: "student" as ChatUserType,
    message_type: "text" as ChatMessageType,
    content: `Message ${msgCounter}`,
    reply_to_id: null,
    is_deleted: false,
    deleted_at: null,
    created_at: overrides.created_at ?? baseTime.toISOString(),
    updated_at: overrides.created_at ?? baseTime.toISOString(),
    sender_name: "User A",
    sender_profile_url: null,
    metadata: null,
    sender: {
      userId: overrides.sender_id ?? "user-A",
      name: "User A",
      userType: "student" as ChatUserType,
    },
    ...overrides,
  };
}

/**
 * 여러 메시지를 시간 순서대로 한번에 생성
 * 같은 sender, interval초 간격
 */
export function makeMessages(
  count: number,
  overrides: Partial<CacheMessage> = {},
  options: { intervalSeconds?: number; baseTime?: string } = {}
): CacheMessage[] {
  const interval = options.intervalSeconds ?? 10;
  const base = new Date(options.baseTime ?? "2026-03-16T10:00:00Z");

  return Array.from({ length: count }, (_, i) => {
    const time = new Date(base.getTime() + i * interval * 1000);
    return makeMessage({
      id: `msg-${Date.now()}-${i}`,
      created_at: time.toISOString(),
      ...overrides,
    });
  });
}

/**
 * 테스트용 메시지 페이지 생성
 */
export function makePage(
  messages: CacheMessage[],
  overrides: { hasMore?: boolean; readCounts?: Record<string, number> } = {}
): MessagesPage {
  const readCounts: Record<string, number> = overrides.readCounts ?? {};
  for (const msg of messages) {
    if (msg.readCount !== undefined) {
      readCounts[msg.id] = msg.readCount;
    }
  }
  return {
    messages,
    readCounts,
    hasMore: overrides.hasMore ?? false,
  };
}

/**
 * 테스트용 InfiniteQuery 캐시 구조 생성
 * pages: [newest, ..., oldest] 순서
 */
export function makeCache(pages: MessagesPage[]): InfiniteMessagesCache {
  return {
    pages,
    pageParams: pages.map((_, i) => (i === 0 ? undefined : `cursor-${i}`)),
  };
}

/**
 * allMessages 병합 알고리즘 (useChatRoomLogic에서 추출)
 * 테스트 가능하도록 순수 함수로 구현
 */
export function mergePages(pages: MessagesPage[]): CacheMessage[] {
  const result: CacheMessage[] = [];
  const seenIndex = new Map<string, number>();

  // pages: [newest(0), ..., oldest(N)] → oldest→newest 순회
  for (let i = pages.length - 1; i >= 0; i--) {
    const page = pages[i];
    const messages = page?.messages;
    const readCounts = page?.readCounts;
    if (messages) {
      for (let j = 0; j < messages.length; j++) {
        const msg = messages[j] as CacheMessage;
        const rc = msg.readCount ?? readCounts?.[msg.id];
        const processed =
          rc !== undefined && rc !== msg.readCount
            ? { ...msg, readCount: rc }
            : msg;

        const existingIdx = seenIndex.get(msg.id);
        if (existingIdx !== undefined) {
          result[existingIdx] = processed;
        } else {
          seenIndex.set(msg.id, result.length);
          result.push(processed);
        }
      }
    }
  }
  return result;
}

/**
 * prepend 감지 알고리즘 (ChatRoom에서 추출)
 * 테스트 가능하도록 순수 함수로 구현
 */
export function detectPrepend(
  prevMessages: CacheMessage[],
  newMessages: CacheMessage[],
  prevPrependedCount: number
): { prependedCount: number; firstItemIndex: number } {
  const FIRST_ITEM_INDEX_BASE = 10_000;
  let prependedCount = prevPrependedCount;

  const prevFirstId = prevMessages[0]?.id;

  if (
    newMessages.length > 0 &&
    prevFirstId &&
    newMessages[0]?.id !== prevFirstId
  ) {
    const anchorIdx = newMessages.findIndex((m) => m.id === prevFirstId);
    if (anchorIdx > 0) {
      prependedCount += anchorIdx;
    } else if (anchorIdx === -1 && newMessages.length > prevMessages.length) {
      prependedCount += newMessages.length - prevMessages.length;
    }
  }

  return {
    prependedCount,
    firstItemIndex: FIRST_ITEM_INDEX_BASE - prependedCount,
  };
}

/** 테스트 간 카운터 초기화 */
export function resetCounter(): void {
  msgCounter = 0;
}
