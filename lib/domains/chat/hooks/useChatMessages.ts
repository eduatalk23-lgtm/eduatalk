"use client";

/**
 * useChatMessages - 채팅 메시지 쿼리 + 병합 + 그룹핑 훅
 *
 * 무한스크롤 쿼리, IndexedDB 캐시 시딩/쓰기, allMessages 병합,
 * 그룹핑 동결(Prepend 경계), readCounts Map 관리를 담당합니다.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { chatMessagesQueryOptions } from "@/lib/query-options/chatMessages";
import {
  chatRoomDetailQueryOptions,
  chatPinnedQueryOptions,
  chatAnnouncementQueryOptions,
  chatPermissionsQueryOptions,
} from "@/lib/query-options/chatRoom";
import { getChatNotificationPrefs } from "@/lib/domains/student/actions/notifications";
import {
  type InfiniteMessagesCache,
  type CacheMessage,
  decrementReadCountsForReceipt,
} from "@/lib/domains/chat/cacheTypes";
import {
  processMessagesWithGrouping,
} from "@/lib/domains/chat/messageGrouping";
import { chatKeys } from "../queryKeys";
import { cacheMessages, getCachedMessages, setCachedRoomState } from "../localCache";
import type {
  ChatMessageWithGrouping,
  PinnedMessageWithContent,
  AnnouncementInfo,
} from "@/lib/domains/chat/types";

export interface UseChatMessagesOptions {
  roomId: string;
  userId: string;
}

export interface UseChatMessagesReturn {
  // Room data
  roomData: ReturnType<typeof useQuery<ReturnType<typeof chatRoomDetailQueryOptions> extends { queryFn: infer F } ? Awaited<ReturnType<F extends (...args: unknown[]) => unknown ? F : never>> : never>>["data"];
  chatPrefs: ReturnType<typeof useQuery>["data"];
  chatPrefsRef: RefObject<ReturnType<typeof useQuery>["data"]>;
  initialLastReadAtRef: RefObject<string | null>;

  // Pinned / permissions / announcement
  pinnedMessages: PinnedMessageWithContent[];
  permissionsData: { canPin: boolean; canSetAnnouncement: boolean } | undefined;
  announcementData: AnnouncementInfo | null | undefined;
  pinnedMessageIds: Set<string>;

  // Messages
  messagesWithGrouping: ChatMessageWithGrouping[];
  readCountsMapRef: RefObject<Map<string, number>>;

  // Infinite query status
  isLoading: boolean;
  error: Error | null;
  fetchStatus: "fetching" | "paused" | "idle";
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchPreviousPage: () => Promise<unknown>;
  hasPreviousPage: boolean;
  isFetchingPreviousPage: boolean;
  refetch: () => Promise<unknown>;

  // Read receipt buffering
  readReceiptTrackRef: RefObject<Map<string, string>>;
  readReceiptBufferRef: RefObject<Array<{ readAt: string; prevReadAt: string }>>;
  readReceiptFlushTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
}

export function useChatMessages({
  roomId,
  userId,
}: UseChatMessagesOptions): UseChatMessagesReturn {
  const queryClient = useQueryClient();

  // ============================================
  // Queries
  // ============================================

  // 채팅방 정보 조회 (SSR prefetch 활용)
  const { data: roomData } = useQuery(chatRoomDetailQueryOptions(roomId));

  // 채팅 알림 설정 (소리/진동/읽음확인)
  const { data: chatPrefs } = useQuery({
    queryKey: chatKeys.notificationPrefs(),
    queryFn: () => getChatNotificationPrefs(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const chatPrefsRef = useRef(chatPrefs);
  chatPrefsRef.current = chatPrefs;

  // "여기까지 읽었습니다" 구분선용: 진입 시 last_read_at 1회 캡처
  const initialLastReadAtRef = useRef<string | null>(null);
  const lastReadCapturedRoomIdRef = useRef<string | null>(null);
  if (
    roomData?.members &&
    lastReadCapturedRoomIdRef.current !== roomId
  ) {
    const myMembership = roomData.members.find((m) => m.user_id === userId);
    initialLastReadAtRef.current = myMembership?.last_read_at ?? null;
    lastReadCapturedRoomIdRef.current = roomId;
  }

  // 고정 메시지 목록 조회 (SSR prefetch 활용)
  const { data: pinnedMessages = [] } = useQuery(chatPinnedQueryOptions(roomId));

  // 고정/공지 권한 확인 (1 RPC로 통합, SSR prefetch 활용, staleTime 5분)
  const { data: permissionsData } = useQuery(chatPermissionsQueryOptions(roomId));

  // 공지 조회 (SSR prefetch 활용)
  const { data: announcementData } = useQuery(chatAnnouncementQueryOptions(roomId));

  // 고정된 메시지 ID Set (빠른 조회용)
  const pinnedMessageIds = useMemo(
    () => new Set(pinnedMessages.map((p: PinnedMessageWithContent) => p.message_id)),
    [pinnedMessages]
  );

  // ============================================
  // Local-First: IndexedDB 캐시 시딩
  // ============================================
  useEffect(() => {
    const existing = queryClient.getQueryData(chatKeys.messages(roomId));
    if (existing) return;

    getCachedMessages(roomId, 200)
      .then((cached) => {
        if (cached.length === 0) return;
        const current = queryClient.getQueryData(chatKeys.messages(roomId));
        if (current) return;
        queryClient.setQueryData<InfiniteMessagesCache>(
          chatKeys.messages(roomId),
          {
            pages: [{
              messages: cached,
              readCounts: {},
              hasMore: true,
              hasNewer: false,
            }],
            pageParams: [undefined],
          }
        );
      })
      .catch(() => {});
  }, [roomId, queryClient]);

  // 메시지 목록 조회 (무한 스크롤)
  const {
    data: messagesData,
    isLoading,
    error,
    fetchStatus,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    fetchPreviousPage,
    hasPreviousPage,
    isFetchingPreviousPage,
    refetch,
  } = useInfiniteQuery(chatMessagesQueryOptions(roomId));

  // ============================================
  // Data Transformations
  // ============================================

  // READ_RECEIPT 실시간 갱신용
  const READ_RECEIPT_TRACK_MAX = 500;
  const readReceiptTrackRef = useRef(new Map<string, string>());

  // READ_RECEIPT 버퍼
  const readReceiptBufferRef = useRef<Array<{ readAt: string; prevReadAt: string }>>([]);
  const readReceiptFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // roomData 로드 후: readCount가 없는 낙관적 메시지만 보정
  useEffect(() => {
    if (!roomData?.members || !userId) return;

    const activeOtherMembers = roomData.members.filter(
      (m) => m.user_id !== userId && !m.left_at
    ).length;
    if (activeOtherMembers <= 0) return;

    queryClient.setQueryData<InfiniteMessagesCache>(
      chatKeys.messages(roomId),
      (old) => {
        if (!old?.pages?.length) return old;

        let changed = false;
        const pages = old.pages.map((page) => {
          let pageChanged = false;
          const messages = page.messages.map((m) => {
            if (
              m.sender_id === userId &&
              m.readCount === undefined &&
              !(m.id in page.readCounts) &&
              !m.is_deleted
            ) {
              pageChanged = true;
              return { ...m, readCount: activeOtherMembers };
            }
            return m;
          });
          if (!pageChanged) return page;
          changed = true;
          const readCounts = { ...page.readCounts };
          for (const msg of messages) {
            if (msg.sender_id === userId && msg.readCount !== undefined && !(msg.id in readCounts)) {
              readCounts[msg.id] = msg.readCount;
            }
          }
          return { ...page, messages, readCounts };
        });
        return changed ? { ...old, pages } : old;
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomData?.members]);

  // readCountsMap: READ_RECEIPT 수신 시 allMessages 재계산 없이 Map만 업데이트
  const readCountsMapRef = useRef(new Map<string, number>());

  const allMessages = useMemo(() => {
    if (!messagesData?.pages) return [];

    const pages = messagesData.pages;
    const result: CacheMessage[] = [];
    const rcMap = new Map<string, number>();

    const seenIndex = new Map<string, number>();
    for (let i = pages.length - 1; i >= 0; i--) {
      const page = pages[i];
      const messages = page?.messages;
      const readCounts = page?.readCounts;
      if (messages) {
        for (let j = 0; j < messages.length; j++) {
          const msg = messages[j] as CacheMessage;

          const rc = msg.readCount ?? readCounts?.[msg.id];
          if (rc !== undefined) {
            rcMap.set(msg.id, rc);
          }

          const existingIdx = seenIndex.get(msg.id);
          if (existingIdx !== undefined) {
            result[existingIdx] = msg;
            const newerRc = msg.readCount ?? readCounts?.[msg.id];
            if (newerRc !== undefined) rcMap.set(msg.id, newerRc);
          } else {
            seenIndex.set(msg.id, result.length);
            result.push(msg);
          }
        }
      }
    }

    readCountsMapRef.current = rcMap;
    return result;
  }, [messagesData?.pages]);

  // 그룹핑 동결 (Prepend 경계 메시지 높이 안정화)
  const prevAllMessagesRef = useRef<typeof allMessages>([]);
  const prevGroupedRef = useRef<ChatMessageWithGrouping[]>([]);
  const pendingGroupCorrectionRef = useRef(false);
  const [groupingEpoch, setGroupingEpoch] = useState(0);

  // 자정 경과 시 날짜 구분선 재계산
  const [dateKey, setDateKey] = useState(() => new Date().toDateString());
  useEffect(() => {
    const checkMidnight = () => {
      const today = new Date().toDateString();
      if (today !== dateKey) {
        setDateKey(today);
        prevAllMessagesRef.current = [];
        prevGroupedRef.current = [];
      }
    };
    const timer = setInterval(checkMidnight, 60_000);
    return () => clearInterval(timer);
  }, [dateKey]);

  const groupingOptions = {
    lastReadAt: initialLastReadAtRef.current,
    currentUserId: userId,
  };

  const messagesWithGrouping = useMemo(() => {
    if (allMessages.length === 0) {
      prevAllMessagesRef.current = [];
      prevGroupedRef.current = [];
      return [];
    }

    const prevGrouped = prevGroupedRef.current;
    const freshResult = processMessagesWithGrouping(allMessages, groupingOptions);

    if (prevGrouped.length > 0) {
      const prevById = new Map<string, ChatMessageWithGrouping>();
      for (const g of prevGrouped) prevById.set(g.id, g);

      const prev = prevAllMessagesRef.current;
      const isPrepend = prev.length > 0 && prev[0]?.id !== allMessages[0]?.id;
      const boundaryId = isPrepend ? prev[0]?.id : null;
      if (boundaryId) pendingGroupCorrectionRef.current = true;

      const result = freshResult.map((fresh) => {
        const old = prevById.get(fresh.id);
        if (!old) return fresh;

        if (boundaryId && fresh.id === boundaryId) {
          return old.status === fresh.status
            ? old
            : { ...old, status: fresh.status };
        }

        const groupingSame =
          old.grouping.showName === fresh.grouping.showName &&
          old.grouping.showTime === fresh.grouping.showTime &&
          old.grouping.isGrouped === fresh.grouping.isGrouped &&
          old.grouping.showDateDivider === fresh.grouping.showDateDivider &&
          old.grouping.showUnreadDivider === fresh.grouping.showUnreadDivider;
        const statusSame = old.status === fresh.status;

        if (groupingSame && statusSame) return old;
        if (groupingSame) {
          return { ...old, ...(!statusSame && { status: fresh.status }) };
        }
        return fresh;
      });

      prevAllMessagesRef.current = allMessages;
      prevGroupedRef.current = result;
      return result;
    }

    prevAllMessagesRef.current = allMessages;
    prevGroupedRef.current = freshResult;
    return freshResult;
  }, [allMessages, dateKey, groupingEpoch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prepend 경계 그룹핑 동결 후 복원 (rAF x3)
  useEffect(() => {
    if (!pendingGroupCorrectionRef.current) return;
    let frameCount = 0;
    const tick = () => {
      frameCount++;
      if (frameCount >= 3) {
        pendingGroupCorrectionRef.current = false;
        setGroupingEpoch((v) => v + 1);
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }, [allMessages]);

  // ============================================
  // Local-First: 서버 데이터 → IDB 캐시 쓰기 (1초 debounce)
  // ============================================
  useEffect(() => {
    if (!messagesData?.pages?.length) return;
    const timer = setTimeout(() => {
      const allMsgs = messagesData.pages.flatMap((p) => p.messages);
      if (allMsgs.length > 0) {
        cacheMessages(roomId, allMsgs).catch(() => {});
        const newest = allMsgs[allMsgs.length - 1];
        if (newest) {
          setCachedRoomState(roomId, {
            lastSyncTimestamp: newest.created_at,
            updatedAt: Date.now(),
          }).catch(() => {});
        }
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [messagesData, roomId]);

  return {
    roomData,
    chatPrefs,
    chatPrefsRef,
    initialLastReadAtRef,
    pinnedMessages,
    permissionsData,
    announcementData,
    pinnedMessageIds,
    messagesWithGrouping,
    readCountsMapRef,
    isLoading,
    error: error as Error | null,
    fetchStatus,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    fetchPreviousPage,
    hasPreviousPage: hasPreviousPage ?? false,
    isFetchingPreviousPage,
    refetch,
    readReceiptTrackRef,
    readReceiptBufferRef,
    readReceiptFlushTimerRef,
  };
}
