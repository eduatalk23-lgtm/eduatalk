"use client";

/**
 * useChatRoomLogic - 채팅방 비즈니스 로직 훅
 *
 * ChatRoom 컴포넌트의 비즈니스 로직을 분리하여
 * 테스트 용이성과 재사용성을 높입니다.
 */

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useToast } from "@/components/ui/ToastProvider";
import { chatMessagesQueryOptions } from "@/lib/query-options/chatMessages";
import {
  chatRoomDetailQueryOptions,
  chatPinnedQueryOptions,
  chatAnnouncementQueryOptions,
} from "@/lib/query-options/chatRoom";
import {
  sendMessageAction,
  markAsReadAction,
  editMessageAction,
  deleteMessageAction,
  toggleReactionAction,
  pinMessageAction,
  unpinMessageAction,
  canPinMessagesAction,
  setAnnouncementAction,
  canSetAnnouncementAction,
} from "@/lib/domains/chat/actions";
import {
  isMessageEdited,
  type ReactionEmoji,
  type ReplyTargetInfo,
  type PinnedMessageWithContent,
  type AnnouncementInfo,
  type ChatRoom,
  type ChatMessageWithGrouping,
  type ChatRoomMemberWithUser,
  type PresenceUser,
  type ChatUser,
  type ChatRoomListItem,
} from "@/lib/domains/chat/types";
import {
  type InfiniteMessagesCache,
  type CacheMessage,
  addMessageToFirstPage,
  replaceMessageInFirstPage,
  updateMessageInCache,
  removeMessageFromCache,
  updateFirstPage,
  findMessageInCache,
} from "@/lib/domains/chat/cacheTypes";
import { processMessagesWithGrouping } from "@/lib/domains/chat/messageGrouping";
import { useChatRealtime, useChatPresence } from "@/lib/realtime";
import { useThrottledCallback } from "@/lib/hooks/useThrottle";
import { operationTracker } from "../operationTracker";
import { isOnline, isNetworkError } from "@/lib/offline/networkStatus";
import {
  enqueueChatMessage,
  registerMessageSender,
  initChatQueueProcessor,
} from "@/lib/offline/chatQueue";

export interface UseChatRoomLogicOptions {
  roomId: string;
  userId: string;
  isAtBottom: boolean;
  onNewMessageArrived?: () => void;
}

export interface UseChatRoomLogicReturn {
  data: {
    room: ChatRoom | undefined;
    messages: ChatMessageWithGrouping[];
    pinnedMessages: PinnedMessageWithContent[];
    announcement: AnnouncementInfo | null;
    readCounts: Record<string, number>;
    onlineUsers: PresenceUser[];
    typingUsers: PresenceUser[];
    members: ChatRoomMemberWithUser[];
    otherMemberLeft: boolean;
  };
  permissions: {
    canPin: boolean;
    canSetAnnouncement: boolean;
  };
  actions: {
    sendMessage: (content: string, replyToId?: string | null) => void;
    editMessage: (messageId: string, content: string, expectedUpdatedAt?: string) => void;
    deleteMessage: (messageId: string) => void;
    toggleReaction: (messageId: string, emoji: ReactionEmoji) => void;
    togglePin: (messageId: string, isPinned: boolean) => void;
    setAnnouncement: (content: string | null) => void;
    markAsRead: () => void;
    setTyping: (isTyping: boolean) => void;
    retryMessage: (message: ChatMessageWithGrouping) => void;
    removeFailedMessage: (messageId: string) => void;
  };
  status: {
    isLoading: boolean;
    isSending: boolean;
    isEditing: boolean;
    isDeleting: boolean;
    error: Error | null;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => Promise<unknown>;
    refetch: () => Promise<unknown>;
  };
  pinnedMessageIds: Set<string>;
  replyTargetState: {
    replyTarget: ReplyTargetInfo | null;
    setReplyTarget: (target: ReplyTargetInfo | null) => void;
  };
  utils: {
    canEditMessage: (createdAt: string) => boolean;
    isMessageEdited: (message: ChatMessageWithGrouping) => boolean;
  };
}

// ============================================
// 훅 구현
// ============================================

export function useChatRoomLogic({
  roomId,
  userId,
  isAtBottom,
  onNewMessageArrived,
}: UseChatRoomLogicOptions): UseChatRoomLogicReturn {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [replyTarget, setReplyTarget] = useState<ReplyTargetInfo | null>(null);

  // isAtBottom을 ref로 추적하여 콜백에서 항상 최신 값 사용
  const isAtBottomRef = useRef(isAtBottom);
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  // 오프라인 큐 프로세서 초기화 + sender 등록 (마운트 시 1회)
  useEffect(() => {
    registerMessageSender(sendMessageAction);
    const cleanup = initChatQueueProcessor();
    return cleanup;
  }, []);

  // ============================================
  // Queries
  // ============================================

  // 채팅방 정보 조회 (SSR prefetch 활용)
  const { data: roomData } = useQuery(chatRoomDetailQueryOptions(roomId));

  // 고정 메시지 목록 조회 (SSR prefetch 활용)
  const { data: pinnedMessages = [] } = useQuery(chatPinnedQueryOptions(roomId));

  // 고정 권한 확인
  const { data: canPinData } = useQuery({
    queryKey: ["chat-can-pin", roomId],
    queryFn: async () => {
      const result = await canPinMessagesAction(roomId);
      if (!result.success) return { canPin: false };
      return result.data ?? { canPin: false };
    },
  });

  const canPin = canPinData?.canPin ?? false;

  // 공지 조회 (SSR prefetch 활용)
  const { data: announcementData } = useQuery(chatAnnouncementQueryOptions(roomId));

  // 공지 설정 권한 확인
  const { data: canSetAnnouncementData } = useQuery({
    queryKey: ["chat-can-set-announcement", roomId],
    queryFn: async () => {
      const result = await canSetAnnouncementAction(roomId);
      if (!result.success) return { canSet: false };
      return result.data ?? { canSet: false };
    },
  });

  const canSetAnnouncement = canSetAnnouncementData?.canSet ?? false;

  // 고정된 메시지 ID Set (빠른 조회용)
  const pinnedMessageIds = useMemo(
    () => new Set(pinnedMessages.map((p: PinnedMessageWithContent) => p.message_id)),
    [pinnedMessages]
  );

  // 메시지 목록 조회 (읽음 상태 포함, 무한 스크롤)
  // SSR 프리패칭과 동일한 쿼리 옵션 사용
  const {
    data: messagesData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery(chatMessagesQueryOptions(roomId));

  // ============================================
  // Data Transformations
  // ============================================

  // 페이지 수 추적 (readCounts 증분 업데이트용)
  const pagesLengthRef = useRef(0);
  const cachedReadCountsRef = useRef<Record<string, number>>({});

  // 모든 페이지의 메시지를 시간순 정렬로 병합
  // pages는 [newest, ..., oldest] 순서 → 역순 순회로 [oldest, ..., newest]
  // 단일 패스 역순 순회로 중간 배열 복사(slice+reverse+flatMap) 제거
  const allMessages = useMemo(() => {
    if (!messagesData?.pages) return [];

    const pages = messagesData.pages;
    const result: CacheMessage[] = [];
    for (let i = pages.length - 1; i >= 0; i--) {
      const messages = pages[i]?.messages;
      if (messages) {
        for (let j = 0; j < messages.length; j++) {
          result.push(messages[j]);
        }
      }
    }
    return result;
  }, [messagesData?.pages]);

  // 메시지에 그룹핑 정보 추가 (날짜 구분선, 이름/시간 표시 여부)
  // 증분 최적화: 끝에 메시지가 추가된 경우 마지막 2개만 재계산
  const prevAllMessagesRef = useRef<typeof allMessages>([]);
  const prevGroupedRef = useRef<ChatMessageWithGrouping[]>([]);

  const messagesWithGrouping = useMemo(() => {
    if (allMessages.length === 0) {
      prevAllMessagesRef.current = [];
      prevGroupedRef.current = [];
      return [];
    }

    const prev = prevAllMessagesRef.current;
    const prevGrouped = prevGroupedRef.current;

    // Fast path: 끝에 메시지 1~3개 추가 (가장 흔한 realtime 케이스)
    const appendCount = allMessages.length - prev.length;
    if (
      appendCount > 0 &&
      appendCount <= 3 &&
      prev.length > 0 &&
      prev[prev.length - 1]?.id === allMessages[prev.length - 1]?.id
    ) {
      // 이전 결과 재사용 + 경계부터 재계산 (마지막 1개 + 새 메시지들)
      const regroupStart = Math.max(0, prev.length - 1);
      const tailMessages = allMessages.slice(regroupStart);
      const tailGrouped = processMessagesWithGrouping(tailMessages);

      const result = [
        ...prevGrouped.slice(0, regroupStart),
        ...tailGrouped,
      ];
      prevAllMessagesRef.current = allMessages;
      prevGroupedRef.current = result;
      return result;
    }

    // Full recompute (페이지네이션, 리셋 등)
    const result = processMessagesWithGrouping(allMessages);
    prevAllMessagesRef.current = allMessages;
    prevGroupedRef.current = result;
    return result;
  }, [allMessages]);

  // readCounts 병합 (증분 최적화)
  // Note: readCounts는 Realtime으로 변경되지 않고 페이지 로드 시에만 변경되므로
  // 증분 업데이트 캐싱이 안전함
  const allReadCounts = useMemo(() => {
    if (!messagesData?.pages) {
      cachedReadCountsRef.current = {};
      pagesLengthRef.current = 0;
      return {};
    }

    const pages = messagesData.pages;
    const currentLength = pages.length;
    const prevLength = pagesLengthRef.current;

    // 첫 로드 또는 리셋
    if (prevLength === 0 || currentLength < prevLength) {
      const result = pages.reduce(
        (acc, page) => ({
          ...acc,
          ...(page?.readCounts ?? {}),
        }),
        {} as Record<string, number>
      );
      cachedReadCountsRef.current = result;
      pagesLengthRef.current = currentLength;
      return result;
    }

    // 페이지 수 동일하면 캐시 반환
    if (currentLength === prevLength) {
      return cachedReadCountsRef.current;
    }

    // 새 페이지의 readCounts만 병합
    const newPages = pages.slice(prevLength);
    const newReadCounts = newPages.reduce(
      (acc, page) => ({
        ...acc,
        ...(page?.readCounts ?? {}),
      }),
      {} as Record<string, number>
    );

    const result = { ...cachedReadCountsRef.current, ...newReadCounts };
    cachedReadCountsRef.current = result;
    pagesLengthRef.current = currentLength;
    return result;
  }, [messagesData?.pages]);

  // ============================================
  // Mutations
  // ============================================

  // 메시지 전송 (Broadcast-first + Optimistic Updates 적용)
  const sendMutation = useMutation({
    mutationFn: async ({
      content,
      replyToId,
      clientMessageId,
    }: {
      content: string;
      replyToId?: string | null;
      clientMessageId?: string;
    }) => {
      const result = await sendMessageAction(roomId, content, replyToId, clientMessageId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onMutate: async ({ content, replyToId, clientMessageId }) => {
      // 1. 진행 중인 쿼리 취소 (낙관적 업데이트와 충돌 방지)
      await queryClient.cancelQueries({ queryKey: ["chat-messages", roomId] });

      // 2. 이전 데이터 스냅샷 저장 (롤백용)
      const previousMessages = queryClient.getQueryData(["chat-messages", roomId]);

      // 이전 답장 상태 저장 (복원용)
      const previousReplyTarget = replyTarget;

      // 3. 낙관적 업데이트 (즉시 UI 반영) - InfiniteQuery 구조
      // Broadcast-first: clientMessageId를 tempId로 사용 (UUID 공유)
      const tempId = clientMessageId ?? `temp-${Date.now()}`;

      // Operation Tracker에 전송 시작 등록 (Race Condition 방지)
      operationTracker.startSend(tempId, content, roomId);
      const now = new Date().toISOString();

      // 발신자 정보 조회 (roomData.members에서)
      const currentMember = roomData?.members?.find(
        (m) => m.user_id === userId
      );
      const senderName = currentMember?.user?.name ?? "나";
      const senderProfileUrl = currentMember?.user?.profileImageUrl ?? null;
      const senderType = currentMember?.user?.type ?? ("student" as const);

      const optimisticMessage: CacheMessage = {
        id: tempId,
        content,
        sender_id: userId,
        sender_type: senderType,
        message_type: "text" as const,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        room_id: roomId,
        is_deleted: false,
        reply_to_id: replyToId ?? null,
        replyTarget: replyTarget,
        sender: { name: senderName, type: senderType, id: userId },
        reactions: [],
        status: "sending" as const,
        // 비정규화 필드 (낙관적 업데이트용)
        sender_name: senderName,
        sender_profile_url: senderProfileUrl,
      };

      queryClient.setQueryData<InfiniteMessagesCache>(
        ["chat-messages", roomId],
        (old) => addMessageToFirstPage(old, optimisticMessage)
      );

      // Broadcast-first: DB INSERT 전에 수신자에게 즉시 전송 (~6ms)
      if (clientMessageId) {
        broadcastInsert({
          id: clientMessageId,
          room_id: roomId,
          sender_id: userId,
          sender_type: senderType,
          sender_name: senderName,
          sender_profile_url: senderProfileUrl,
          content,
          message_type: "text",
          reply_to_id: replyToId ?? null,
          created_at: now,
          updated_at: now,
          is_deleted: false,
          deleted_at: null,
        });

        // 발신자 측 DB trigger broadcast dedup을 위해 미리 마킹
        operationTracker.markRealtimeProcessed(`insert:${clientMessageId}`);
      }

      // 답장 상태 초기화
      setReplyTarget(null);

      // 4. 즉시 스크롤
      setTimeout(() => onNewMessageArrived?.(), 0);

      return { previousMessages, previousReplyTarget, tempId };
    },
    onSuccess: (data, _variables, context) => {
      // 5. 성공 시 temp 메시지를 실제 메시지로 교체 (invalidate 대신 직접 업데이트)
      // 이렇게 하면 실시간 이벤트와의 경쟁 조건을 피할 수 있음
      const tempId = context?.tempId;
      if (tempId && data) {
        // Operation Tracker에 전송 완료 등록 (tempId → realId 매핑)
        operationTracker.completeSend(tempId, data.id);
        queryClient.setQueryData<InfiniteMessagesCache>(
          ["chat-messages", roomId],
          (old) => replaceMessageInFirstPage(old, tempId, data)
        );
      }
    },
    onError: (_err, variables, context) => {
      // 6. 실패 시 네트워크 에러면 큐로 전환, 아니면 에러 표시
      const tempId = context?.tempId;
      if (tempId) {
        if (isNetworkError(_err)) {
          // 네트워크 에러 → tracker 해제 + "queued"로 전환 + IndexedDB 큐 저장
          operationTracker.failSend(tempId);
          queryClient.setQueryData<InfiniteMessagesCache>(
            ["chat-messages", roomId],
            (old) =>
              updateMessageInCache(old, tempId, (m) => ({ ...m, status: "queued" }))
          );
          enqueueChatMessage(
            roomId,
            variables.content,
            variables.replyToId,
            variables.clientMessageId ?? tempId
          );
        } else {
          // 비즈니스 에러 → 기존 "error" 처리
          operationTracker.failSend(tempId);
          queryClient.setQueryData<InfiniteMessagesCache>(
            ["chat-messages", roomId],
            (old) =>
              updateMessageInCache(old, tempId, (m) => ({ ...m, status: "error" }))
          );
        }
      }

      // 답장 상태 복원
      if (context?.previousReplyTarget) {
        setReplyTarget(context.previousReplyTarget);
      }
    },
    // onSettled 제거: invalidateQueries가 실시간 이벤트와 경쟁하여 새로고침 문제 발생
    // 대신 onSuccess에서 setQueryData로 직접 업데이트
  });

  // 메시지 편집 (낙관적 업데이트 + 충돌 감지)
  const editMutation = useMutation({
    mutationFn: async ({
      messageId,
      content,
      expectedUpdatedAt,
    }: {
      messageId: string;
      content: string;
      expectedUpdatedAt?: string;
    }) => {
      const result = await editMessageAction(messageId, content, expectedUpdatedAt);
      if (!result.success) {
        // 충돌 에러는 특별 처리를 위해 코드 포함
        const error = new Error(result.error);
        if (result.code === "CONFLICT_EDIT") {
          (error as Error & { code?: string }).code = "CONFLICT_EDIT";
        }
        throw error;
      }
      return result.data;
    },
    onMutate: async ({ messageId, content }) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ["chat-messages", roomId] });

      // 이전 데이터 스냅샷 저장 (롤백용)
      const previousMessages = queryClient.getQueryData<InfiniteMessagesCache>([
        "chat-messages",
        roomId,
      ]);

      // 낙관적 업데이트
      queryClient.setQueryData<InfiniteMessagesCache>(
        ["chat-messages", roomId],
        (old) => {
          if (!old?.pages?.length) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      content,
                      updated_at: new Date().toISOString(),
                    }
                  : m
              ),
            })),
          };
        }
      );

      return { previousMessages };
    },
    onError: (_err, _variables, context) => {
      // 에러 시 롤백
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["chat-messages", roomId],
          context.previousMessages
        );
      }
    },
    // onSuccess 제거: Realtime이 동기화 담당
  });

  // 메시지 삭제 (낙관적 업데이트)
  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const result = await deleteMessageAction(messageId);
      if (!result.success) throw new Error(result.error);
    },
    onMutate: async (messageId) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ["chat-messages", roomId] });

      // 이전 데이터 스냅샷 저장 (롤백용)
      const previousMessages = queryClient.getQueryData<InfiniteMessagesCache>([
        "chat-messages",
        roomId,
      ]);

      // 낙관적 업데이트 (is_deleted=true 설정)
      queryClient.setQueryData<InfiniteMessagesCache>(
        ["chat-messages", roomId],
        (old) => {
          if (!old?.pages?.length) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      is_deleted: true,
                      deleted_at: new Date().toISOString(),
                    }
                  : m
              ),
            })),
          };
        }
      );

      return { previousMessages };
    },
    onError: (_err, _variables, context) => {
      // 에러 시 롤백
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["chat-messages", roomId],
          context.previousMessages
        );
      }
      // 사용자에게 에러 알림
      showError("메시지 삭제에 실패했습니다. 다시 시도해주세요.");
    },
    // onSuccess 제거: Realtime이 동기화 담당
  });

  // 리액션 토글 (낙관적 업데이트)
  const reactionMutation = useMutation({
    mutationFn: async ({
      messageId,
      emoji,
    }: {
      messageId: string;
      emoji: ReactionEmoji;
    }) => {
      const result = await toggleReactionAction(messageId, emoji);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onMutate: async ({ messageId, emoji }) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ["chat-messages", roomId] });

      // 이전 데이터 스냅샷 저장 (롤백용)
      const previousMessages = queryClient.getQueryData<InfiniteMessagesCache>([
        "chat-messages",
        roomId,
      ]);

      // 현재 리액션 상태 확인 (추가인지 제거인지)
      let isAdd = true;
      if (previousMessages?.pages) {
        for (const page of previousMessages.pages) {
          const msg = page.messages.find((m) => m.id === messageId);
          if (msg?.reactions) {
            const reaction = msg.reactions.find((r) => r.emoji === emoji);
            if (reaction?.hasReacted) {
              isAdd = false;
            }
            break;
          }
        }
      }

      // Operation Tracker에 리액션 시작 등록 (Race Condition 방지)
      operationTracker.startReaction(messageId, emoji, isAdd, roomId);

      // 낙관적 업데이트
      queryClient.setQueryData<InfiniteMessagesCache>(
        ["chat-messages", roomId],
        (old) => {
          if (!old?.pages?.length) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((m) => {
                if (m.id !== messageId) return m;

                const existingReactions = m.reactions ?? [];
                const existingIdx = existingReactions.findIndex(
                  (r) => r.emoji === emoji
                );

                if (existingIdx >= 0) {
                  const reaction = existingReactions[existingIdx];
                  if (reaction.hasReacted) {
                    // 이미 리액션함 → 리액션 취소
                    const newCount = reaction.count - 1;
                    if (newCount <= 0) {
                      // 카운트가 0이면 제거
                      const updated = existingReactions.filter(
                        (_, i) => i !== existingIdx
                      );
                      return { ...m, reactions: updated };
                    } else {
                      // 카운트 감소
                      const updated = [...existingReactions];
                      updated[existingIdx] = {
                        ...reaction,
                        count: newCount,
                        hasReacted: false,
                      };
                      return { ...m, reactions: updated };
                    }
                  } else {
                    // 리액션 안함 → 리액션 추가
                    const updated = [...existingReactions];
                    updated[existingIdx] = {
                      ...reaction,
                      count: reaction.count + 1,
                      hasReacted: true,
                    };
                    return { ...m, reactions: updated };
                  }
                } else {
                  // 새 이모지 추가
                  return {
                    ...m,
                    reactions: [
                      ...existingReactions,
                      { emoji, count: 1, hasReacted: true },
                    ],
                  };
                }
              }),
            })),
          };
        }
      );

      return { previousMessages };
    },
    onSuccess: (_data, variables) => {
      // Operation Tracker에 리액션 완료 등록
      operationTracker.completeReaction(variables.messageId, variables.emoji);
    },
    onError: (_err, variables, context) => {
      // Operation Tracker에 리액션 완료 등록 (실패해도 pending 상태 해제)
      operationTracker.completeReaction(variables.messageId, variables.emoji);

      // 에러 시 롤백
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["chat-messages", roomId],
          context.previousMessages
        );
      }
    },
  });

  // 메시지 고정/해제
  const pinMutation = useMutation({
    mutationFn: async ({
      messageId,
      isPinned,
    }: {
      messageId: string;
      isPinned: boolean;
    }) => {
      if (isPinned) {
        const result = await unpinMessageAction(roomId, messageId);
        if (!result.success) throw new Error(result.error);
      } else {
        const result = await pinMessageAction(roomId, messageId);
        if (!result.success) throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-pinned", roomId] });
    },
    onError: (error) => {
      showError("메시지 고정에 실패했습니다.");
      console.error("[ChatRoom] Pin error:", error);
    },
  });

  // 공지 설정/삭제
  const announcementMutation = useMutation({
    mutationFn: async (content: string | null) => {
      const result = await setAnnouncementAction(roomId, content);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-announcement", roomId] });
    },
    onError: (error) => {
      showError("공지 설정에 실패했습니다.");
      console.error("[ChatRoom] Announcement error:", error);
    },
  });

  // 읽음 처리
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      await markAsReadAction(roomId);
    },
    onMutate: async () => {
      // 1. 진행 중인 refetch 취소 (낙관적 업데이트 덮어쓰기 방지)
      await queryClient.cancelQueries({ queryKey: ["chat-rooms"] });

      // 2. 이전 값 스냅샷 (롤백용)
      const previousRooms = queryClient.getQueryData<ChatRoomListItem[]>(["chat-rooms"]);

      // 3. 캐시 즉시 업데이트: 해당 방의 unreadCount를 0으로
      if (previousRooms) {
        queryClient.setQueryData<ChatRoomListItem[]>(
          ["chat-rooms"],
          previousRooms.map((room) =>
            room.id === roomId ? { ...room, unreadCount: 0 } : room
          )
        );
      }

      return { previousRooms };
    },
    onError: (_err, _vars, context) => {
      // 4. 실패 시 롤백
      if (context?.previousRooms) {
        queryClient.setQueryData(["chat-rooms"], context.previousRooms);
      }
    },
    onSettled: () => {
      // 5. 성공/실패 무관하게 서버 데이터로 최종 동기화
      queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
    },
  });

  // 읽음 처리 Throttle (3초) - 서버 부하 방지
  // leading: true - 첫 호출 즉시 실행
  // trailing: true - 마지막 호출도 실행 (최신 상태 반영)
  const throttledMarkAsRead = useThrottledCallback(
    () => {
      markAsReadMutation.mutate();
    },
    3000, // 3초마다 최대 1회
    { leading: true, trailing: true }
  );

  // ============================================
  // Realtime
  // ============================================

  // sender 캐시 구성 (roomData.members에서)
  const senderCache = useMemo(() => {
    const cache = new Map<string, ChatUser>();
    roomData?.members?.forEach((member) => {
      cache.set(`${member.user_id}_${member.user.type}`, member.user);
    });
    return cache;
  }, [roomData?.members]);

  // 실시간 구독 (Broadcast-first: broadcastInsert 반환)
  const { broadcastInsert } = useChatRealtime({
    roomId,
    userId,
    senderCache,
    onNewMessage: useCallback(() => {
      // 스크롤이 맨 아래에 있으면 자동 스크롤 (ref 사용으로 항상 최신 값)
      if (isAtBottomRef.current) {
        onNewMessageArrived?.();
      }
      // 읽음 처리 (Throttle 적용 - 3초마다 최대 1회)
      throttledMarkAsRead();
    }, [onNewMessageArrived, throttledMarkAsRead]),
  });


  // 현재 사용자 이름 (Presence용)
  const currentUserName =
    roomData?.members.find((m) => m.user_id === userId)?.user?.name ?? "사용자";

  // Presence (타이핑/온라인 상태)
  const { onlineUsers, typingUsers, setTyping } = useChatPresence({
    roomId,
    userId,
    userName: currentUserName,
    enabled: !!roomData,
  });

  // 입장 시 읽음 처리
  useEffect(() => {
    markAsReadMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ============================================
  // Actions
  // ============================================

  const sendMessage = useCallback(
    (content: string, replyToId?: string | null) => {
      const clientMessageId = crypto.randomUUID();

      if (!isOnline()) {
        // 오프라인: 캐시에 "queued" 상태로 추가 + IndexedDB 큐 저장
        const now = new Date().toISOString();
        const currentMember = roomData?.members?.find(
          (m) => m.user_id === userId
        );
        const senderName = currentMember?.user?.name ?? "나";
        const senderProfileUrl = currentMember?.user?.profileImageUrl ?? null;
        const senderType = currentMember?.user?.type ?? ("student" as const);

        const queuedMessage: CacheMessage = {
          id: clientMessageId,
          content,
          sender_id: userId,
          sender_type: senderType,
          message_type: "text" as const,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          room_id: roomId,
          is_deleted: false,
          reply_to_id: replyToId ?? null,
          replyTarget: replyTarget,
          sender: { name: senderName, type: senderType, id: userId },
          reactions: [],
          status: "queued" as const,
          sender_name: senderName,
          sender_profile_url: senderProfileUrl,
        };

        queryClient.setQueryData<InfiniteMessagesCache>(
          ["chat-messages", roomId],
          (old) => addMessageToFirstPage(old, queuedMessage)
        );
        enqueueChatMessage(roomId, content, replyToId, clientMessageId);
        setReplyTarget(null);
        setTimeout(() => onNewMessageArrived?.(), 0);
        return;
      }

      // 온라인: 기존 mutation 로직
      sendMutation.mutate({ content, replyToId, clientMessageId });
    },
    [sendMutation, roomId, userId, roomData, queryClient, onNewMessageArrived, replyTarget]
  );

  const editMessage = useCallback(
    (messageId: string, content: string, expectedUpdatedAt?: string) => {
      editMutation.mutate({ messageId, content, expectedUpdatedAt });
    },
    [editMutation]
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      deleteMutation.mutate(messageId);
    },
    [deleteMutation]
  );

  const toggleReaction = useCallback(
    (messageId: string, emoji: ReactionEmoji) => {
      reactionMutation.mutate({ messageId, emoji });
    },
    [reactionMutation]
  );

  const togglePin = useCallback(
    (messageId: string, isPinned: boolean) => {
      pinMutation.mutate({ messageId, isPinned });
    },
    [pinMutation]
  );

  const setAnnouncementAction_ = useCallback(
    (content: string | null) => {
      announcementMutation.mutate(content);
    },
    [announcementMutation]
  );

  // 외부에서 호출되는 markAsRead도 throttle 적용
  const markAsRead = useCallback(() => {
    throttledMarkAsRead();
  }, [throttledMarkAsRead]);

  // 메시지 재전송 핸들러
  const retryMessage = useCallback(
    (message: ChatMessageWithGrouping) => {
      // 1. status를 sending으로 변경
      queryClient.setQueryData<InfiniteMessagesCache>(
        ["chat-messages", roomId],
        (old) =>
          updateMessageInCache(old, message.id, (m) => ({ ...m, status: "sending" }))
      );

      // 2. 재전송 (기존 메시지 제거 후 새 메시지 추가)
      const replyToId = (message as { reply_to_id?: string | null }).reply_to_id;
      sendMutation.mutate(
        { content: message.content, replyToId },
        {
          onSuccess: () => {
            // 기존 실패 메시지 제거 (새 메시지가 낙관적 업데이트로 추가됨)
            queryClient.setQueryData<InfiniteMessagesCache>(
              ["chat-messages", roomId],
              (old) => removeMessageFromCache(old, message.id)
            );
          },
          onError: () => {
            // 다시 error 상태로
            queryClient.setQueryData<InfiniteMessagesCache>(
              ["chat-messages", roomId],
              (old) =>
                updateMessageInCache(old, message.id, (m) => ({
                  ...m,
                  status: "error",
                }))
            );
          },
        }
      );
    },
    [roomId, queryClient, sendMutation]
  );

  // 전송 실패 메시지 삭제 핸들러
  const removeFailedMessage = useCallback(
    (messageId: string) => {
      queryClient.setQueryData<InfiniteMessagesCache>(
        ["chat-messages", roomId],
        (old) => removeMessageFromCache(old, messageId)
      );
    },
    [roomId, queryClient]
  );

  // ============================================
  // Utils
  // ============================================

  // 편집 가능 여부 확인 (5분 이내)
  const canEditMessage = useCallback((createdAt: string) => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return new Date(createdAt).getTime() > fiveMinutesAgo;
  }, []);

  // ============================================
  // Return
  // ============================================

  return {
    data: {
      room: roomData?.room,
      messages: messagesWithGrouping,
      pinnedMessages,
      announcement: announcementData ?? null,
      readCounts: allReadCounts,
      onlineUsers,
      typingUsers,
      members: roomData?.members ?? [],
      otherMemberLeft: roomData?.otherMemberLeft ?? false,
    },
    permissions: {
      canPin,
      canSetAnnouncement,
    },
    actions: {
      sendMessage,
      editMessage,
      deleteMessage,
      toggleReaction,
      togglePin,
      setAnnouncement: setAnnouncementAction_,
      markAsRead,
      setTyping,
      retryMessage,
      removeFailedMessage,
    },
    status: {
      isLoading,
      isSending: sendMutation.isPending,
      isEditing: editMutation.isPending,
      isDeleting: deleteMutation.isPending,
      error: error as Error | null,
      hasNextPage: hasNextPage ?? false,
      isFetchingNextPage,
      fetchNextPage,
      refetch,
    },
    pinnedMessageIds,
    replyTargetState: {
      replyTarget,
      setReplyTarget,
    },
    utils: {
      canEditMessage,
      isMessageEdited,
    },
  };
}
