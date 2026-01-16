"use client";

/**
 * useChatRoomLogic - 채팅방 비즈니스 로직 훅
 *
 * ChatRoom 컴포넌트의 비즈니스 로직을 분리하여
 * 테스트 용이성과 재사용성을 높입니다.
 */

import { useCallback, useMemo, useState, useEffect } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getMessagesWithReadStatusAction,
  sendMessageAction,
  markAsReadAction,
  getChatRoomDetailAction,
  editMessageAction,
  deleteMessageAction,
  toggleReactionAction,
  getPinnedMessagesAction,
  pinMessageAction,
  unpinMessageAction,
  canPinMessagesAction,
  getAnnouncementAction,
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
} from "@/lib/domains/chat/types";
import { processMessagesWithGrouping } from "@/lib/domains/chat/messageGrouping";
import { useChatRealtime, useChatPresence } from "@/lib/realtime";
import { useDebouncedCallback } from "@/lib/hooks/useDebounce";

// ============================================
// 타입 정의
// ============================================

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
  };
  permissions: {
    canPin: boolean;
    canSetAnnouncement: boolean;
  };
  actions: {
    sendMessage: (content: string, replyToId?: string | null) => void;
    editMessage: (messageId: string, content: string) => void;
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
  const [replyTarget, setReplyTarget] = useState<ReplyTargetInfo | null>(null);

  // ============================================
  // Queries
  // ============================================

  // 채팅방 정보 조회
  const { data: roomData } = useQuery({
    queryKey: ["chat-room", roomId],
    queryFn: async () => {
      const result = await getChatRoomDetailAction(roomId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  // 고정 메시지 목록 조회
  const { data: pinnedMessages = [] } = useQuery({
    queryKey: ["chat-pinned", roomId],
    queryFn: async () => {
      const result = await getPinnedMessagesAction(roomId);
      if (!result.success) return [];
      return result.data ?? [];
    },
  });

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

  // 공지 조회
  const { data: announcementData } = useQuery({
    queryKey: ["chat-announcement", roomId],
    queryFn: async () => {
      const result = await getAnnouncementAction(roomId);
      if (!result.success) return null;
      return result.data;
    },
  });

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
  const {
    data: messagesData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["chat-messages", roomId],
    queryFn: async ({ pageParam }) => {
      const result = await getMessagesWithReadStatusAction(roomId, {
        limit: 50,
        before: pageParam,
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.hasMore || !lastPage?.messages?.length) return undefined;
      return lastPage.messages[0].id; // 가장 오래된 메시지 ID
    },
    staleTime: 10 * 1000, // 10초
  });

  // ============================================
  // Data Transformations
  // ============================================

  // 모든 페이지의 메시지를 시간순 정렬로 병합
  const allMessages = useMemo(() => {
    if (!messagesData?.pages) return [];

    // 과거 → 현재 순서로 병합 (pages는 역순으로 쌓임)
    return messagesData.pages
      .slice()
      .reverse()
      .flatMap((page) => page?.messages ?? []);
  }, [messagesData?.pages]);

  // 메시지에 그룹핑 정보 추가 (날짜 구분선, 이름/시간 표시 여부)
  const messagesWithGrouping = useMemo(() => {
    return processMessagesWithGrouping(allMessages);
  }, [allMessages]);

  // readCounts 병합
  const allReadCounts = useMemo(() => {
    if (!messagesData?.pages) return {};

    return messagesData.pages.reduce(
      (acc, page) => ({
        ...acc,
        ...(page?.readCounts ?? {}),
      }),
      {} as Record<string, number>
    );
  }, [messagesData?.pages]);

  // ============================================
  // Mutations
  // ============================================

  // 메시지 전송 (Optimistic Updates 적용)
  const sendMutation = useMutation({
    mutationFn: async ({
      content,
      replyToId,
    }: {
      content: string;
      replyToId?: string | null;
    }) => {
      const result = await sendMessageAction(roomId, content, replyToId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onMutate: async ({ content, replyToId }) => {
      // 1. 진행 중인 쿼리 취소 (낙관적 업데이트와 충돌 방지)
      await queryClient.cancelQueries({ queryKey: ["chat-messages", roomId] });

      // 2. 이전 데이터 스냅샷 저장 (롤백용)
      const previousMessages = queryClient.getQueryData(["chat-messages", roomId]);

      // 이전 답장 상태 저장 (복원용)
      const previousReplyTarget = replyTarget;

      // 3. 낙관적 업데이트 (즉시 UI 반영) - InfiniteQuery 구조
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = {
        id: tempId,
        content,
        sender_id: userId,
        sender_type: "student" as const,
        message_type: "text" as const,
        created_at: new Date().toISOString(),
        room_id: roomId,
        is_deleted: false,
        reply_to_id: replyToId ?? null,
        replyTarget: replyTarget,
        sender: { name: "나", type: "student" as const, id: userId },
        status: "sending" as const,
      };

      queryClient.setQueryData(
        ["chat-messages", roomId],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => {
          if (!old?.pages?.length) return old;

          // 첫 번째 페이지(최신)에 메시지 추가
          const firstPage = old.pages[0];
          return {
            ...old,
            pages: [
              { ...firstPage, messages: [...firstPage.messages, optimisticMessage] },
              ...old.pages.slice(1),
            ],
          };
        }
      );

      // 답장 상태 초기화
      setReplyTarget(null);

      // 4. 즉시 스크롤
      setTimeout(() => onNewMessageArrived?.(), 0);

      return { previousMessages, previousReplyTarget, tempId };
    },
    onError: (_err, _variables, context) => {
      // 5. 실패 시 롤백 대신 status를 error로 변경
      const tempId = context?.tempId;
      if (tempId) {
        queryClient.setQueryData(
          ["chat-messages", roomId],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (old: any) => {
            if (!old?.pages?.length) return old;
            return {
              ...old,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              pages: old.pages.map((page: any) => ({
                ...page,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                messages: page.messages.map((m: any) =>
                  m.id === tempId ? { ...m, status: "error" } : m
                ),
              })),
            };
          }
        );
      }

      // 답장 상태 복원
      if (context?.previousReplyTarget) {
        setReplyTarget(context.previousReplyTarget);
      }
    },
    onSettled: (_data, error) => {
      // 6. 성공 시에만 서버 데이터와 동기화 (실패 시 에러 메시지 유지)
      if (!error) {
        queryClient.invalidateQueries({ queryKey: ["chat-messages", roomId] });
      }
    },
  });

  // 메시지 편집
  const editMutation = useMutation({
    mutationFn: async ({
      messageId,
      content,
    }: {
      messageId: string;
      content: string;
    }) => {
      const result = await editMessageAction(messageId, content);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", roomId] });
    },
  });

  // 메시지 삭제
  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const result = await deleteMessageAction(messageId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", roomId] });
    },
  });

  // 리액션 토글
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", roomId] });
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
  });

  // 읽음 처리
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      await markAsReadAction(roomId);
    },
    onSuccess: () => {
      // 채팅방 목록의 unread count 업데이트
      queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
    },
  });

  // 읽음 처리 Debounce (500ms) - 무제한 DB 쓰기 방지
  const debouncedMarkAsRead = useDebouncedCallback(() => {
    markAsReadMutation.mutate();
  }, 500);

  // ============================================
  // Realtime
  // ============================================

  // 실시간 구독
  useChatRealtime({
    roomId,
    userId,
    onNewMessage: useCallback(() => {
      // 스크롤이 맨 아래에 있으면 자동 스크롤
      if (isAtBottom) {
        onNewMessageArrived?.();
      }
      // 읽음 처리 (Debounce 적용)
      debouncedMarkAsRead();
    }, [isAtBottom, onNewMessageArrived, debouncedMarkAsRead]),
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
      sendMutation.mutate({ content, replyToId });
    },
    [sendMutation]
  );

  const editMessage = useCallback(
    (messageId: string, content: string) => {
      editMutation.mutate({ messageId, content });
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

  const markAsRead = useCallback(() => {
    markAsReadMutation.mutate();
  }, [markAsReadMutation]);

  // 메시지 재전송 핸들러
  const retryMessage = useCallback(
    (message: ChatMessageWithGrouping) => {
      // 1. status를 sending으로 변경
      queryClient.setQueryData(
        ["chat-messages", roomId],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => {
          if (!old?.pages?.length) return old;
          return {
            ...old,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pages: old.pages.map((page: any) => ({
              ...page,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              messages: page.messages.map((m: any) =>
                m.id === message.id ? { ...m, status: "sending" } : m
              ),
            })),
          };
        }
      );

      // 2. 재전송 (기존 메시지 제거 후 새 메시지 추가)
      const replyToId = (message as { reply_to_id?: string | null }).reply_to_id;
      sendMutation.mutate(
        { content: message.content, replyToId },
        {
          onSuccess: () => {
            // 기존 실패 메시지 제거 (새 메시지가 낙관적 업데이트로 추가됨)
            queryClient.setQueryData(
              ["chat-messages", roomId],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (old: any) => {
                if (!old?.pages?.length) return old;
                return {
                  ...old,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  pages: old.pages.map((page: any) => ({
                    ...page,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    messages: page.messages.filter((m: any) => m.id !== message.id),
                  })),
                };
              }
            );
          },
          onError: () => {
            // 다시 error 상태로
            queryClient.setQueryData(
              ["chat-messages", roomId],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (old: any) => {
                if (!old?.pages?.length) return old;
                return {
                  ...old,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  pages: old.pages.map((page: any) => ({
                    ...page,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    messages: page.messages.map((m: any) =>
                      m.id === message.id ? { ...m, status: "error" } : m
                    ),
                  })),
                };
              }
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
      queryClient.setQueryData(
        ["chat-messages", roomId],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => {
          if (!old?.pages?.length) return old;
          return {
            ...old,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pages: old.pages.map((page: any) => ({
              ...page,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              messages: page.messages.filter((m: any) => m.id !== messageId),
            })),
          };
        }
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
