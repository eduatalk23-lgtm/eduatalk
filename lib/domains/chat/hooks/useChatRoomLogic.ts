"use client";

/**
 * useChatRoomLogic - 채팅방 비즈니스 로직 오케스트레이터 훅
 *
 * useChatMessages, useChatReadReceipt, useChatMutations, useChatFileUpload,
 * useChatRealtime, useChatPresence를 조합하여 ChatRoom 컴포넌트에
 * 단일 인터페이스를 제공합니다.
 */

import { useCallback, useMemo, useState, useEffect, useRef, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatRealtime, useChatPresence } from "@/lib/realtime";
import type { ChatMessagePayload } from "@/lib/realtime/useChatRealtime";
import { showBrowserNotification } from "@/lib/domains/notification/browserNotification";
import { playChatFeedback } from "@/lib/audio/chatSound";
import { isMessageEdited } from "@/lib/domains/chat/types";
import { MAX_EDIT_TIME_MS } from "../constants";
import { chatKeys } from "../queryKeys";
import {
  type InfiniteMessagesCache,
  decrementReadCountsForReceipt,
} from "@/lib/domains/chat/cacheTypes";
import type {
  ReactionEmoji,
  ReplyTargetInfo,
  PinnedMessageWithContent,
  AnnouncementInfo,
  ChatRoom,
  ChatMessageWithGrouping,
  ChatRoomMemberWithUser,
  ChatUserType,
  ChatMessageType,
  PresenceUser,
  ChatUser,
  UploadingAttachment,
  MentionInfo,
} from "@/lib/domains/chat/types";
import type { StorageQuotaInfo } from "@/lib/domains/chat/quota";

import { useChatMessages } from "./useChatMessages";
import { useChatReadReceipt } from "./useChatReadReceipt";
import { useChatMutations } from "./useChatMutations";
import { useChatFileUpload } from "./useChatFileUpload";

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
    onlineUsers: PresenceUser[];
    typingUsers: PresenceUser[];
    members: ChatRoomMemberWithUser[];
    otherMemberLeft: boolean;
    leftOtherMember?: ChatUser | null;
  };
  permissions: {
    canPin: boolean;
    canSetAnnouncement: boolean;
  };
  actions: {
    sendMessage: (content: string, replyToId?: string | null, mentions?: MentionInfo[]) => void;
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
    fetchStatus: "fetching" | "paused" | "idle";
    isSending: boolean;
    isEditing: boolean;
    isDeleting: boolean;
    error: Error | null;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => Promise<unknown>;
    hasPreviousPage: boolean;
    isFetchingPreviousPage: boolean;
    fetchPreviousPage: () => Promise<unknown>;
    refetch: () => Promise<unknown>;
  };
  pinnedMessageIds: Set<string>;
  readCountsMap: RefObject<Map<string, number>>;
  replyTargetState: {
    replyTarget: ReplyTargetInfo | null;
    setReplyTarget: (target: ReplyTargetInfo | null) => void;
  };
  attachments: {
    uploadingFiles: UploadingAttachment[];
    addFiles: (files: File[]) => void;
    removeFile: (clientId: string) => void;
    retryUpload: (clientId: string) => void;
    clearFiles: () => void;
    isUploading: boolean;
    quota: StorageQuotaInfo | null;
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

  // isAtBottom을 ref로 추적하여 콜백에서 항상 최신 값 사용
  const isAtBottomRef = useRef(isAtBottom);
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  // ============================================
  // 서브 훅 조합
  // ============================================

  // 메시지 쿼리 + 그룹핑 + IDB 캐시
  const {
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
    error,
    fetchStatus,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    fetchPreviousPage,
    hasPreviousPage,
    isFetchingPreviousPage,
    refetch,
    readReceiptTrackRef,
    readReceiptBufferRef,
    readReceiptFlushTimerRef,
  } = useChatMessages({ roomId, userId });

  // 파일 업로드
  const fileUpload = useChatFileUpload({ roomId, userId });

  // uploadingFiles 최신 값 ref (setUploadingFiles 래퍼에서 사용)
  const uploadingFilesRef = useRef(fileUpload.uploadingFiles);
  uploadingFilesRef.current = fileUpload.uploadingFiles;

  // sender 캐시 구성 (roomData.members에서)
  const senderCache = useMemo(() => {
    const cache = new Map<string, ChatUser>();
    roomData?.members?.forEach((member) => {
      cache.set(`${member.user_id}_${member.user.type}`, member.user);
    });
    return cache;
  }, [roomData?.members]);

  // 읽음 처리 (broadcastInsert보다 먼저 선언 — broadcastReadReceiptRef 필요)
  const {
    markAsRead,
    throttledMarkAsRead,
    broadcastReadReceiptRef,
  } = useChatReadReceipt({
    roomId,
    userId,
    isAtBottom,
    chatPrefsRef,
    roomDataMembers: roomData?.members,
    readReceiptTrackRef,
    readReceiptBufferRef,
    readReceiptFlushTimerRef,
  });

  // 실시간 구독 (Broadcast-first: broadcastInsert, broadcastReadReceipt 반환)
  const { broadcastInsert, broadcastReadReceipt } = useChatRealtime({
    roomId,
    userId,
    senderCache,
    onReadReceipt: useCallback((readerId: string, readAt: string) => {
      const READ_RECEIPT_TRACK_MAX = 500;
      const prevReadAt = readReceiptTrackRef.current.get(readerId);
      if (!prevReadAt) {
        if (readReceiptTrackRef.current.size >= READ_RECEIPT_TRACK_MAX) return;
        return;
      }
      if (readAt <= prevReadAt) return;
      readReceiptTrackRef.current.set(readerId, readAt);

      // READ_RECEIPT 버퍼링: 다인원 채팅에서 수십 명이 동시에 읽을 때 일괄 처리
      readReceiptBufferRef.current.push({ readAt, prevReadAt });
      if (!readReceiptFlushTimerRef.current) {
        readReceiptFlushTimerRef.current = setTimeout(() => {
          const buffer = readReceiptBufferRef.current;
          readReceiptBufferRef.current = [];
          readReceiptFlushTimerRef.current = null;

          if (buffer.length === 0) return;

          queryClient.setQueryData<InfiniteMessagesCache>(
            chatKeys.messages(roomId),
            (old) => {
              let result = old;
              for (const { readAt: ra, prevReadAt: pra } of buffer) {
                result = decrementReadCountsForReceipt(result, userId, ra, pra);
              }
              return result;
            }
          );
        }, 300);
      }
    }, [userId, queryClient, roomId, readReceiptTrackRef, readReceiptBufferRef, readReceiptFlushTimerRef]),
    onNewMessage: useCallback((message: ChatMessagePayload) => {
      onNewMessageArrived?.();
      const prefs = chatPrefsRef.current;
      if (prefs?.chat_read_receipt_enabled !== false) {
        throttledMarkAsRead();
      }

      if (message.sender_id !== userId) {
        playChatFeedback({
          sound: prefs?.chat_sound_enabled !== false,
          vibrate: prefs?.chat_vibrate_enabled !== false,
        });
      }

      if (document.visibilityState === "hidden" && message.sender_id !== userId) {
        const isMedia = message.message_type === "image";
        const isFile = message.message_type === "file";
        const body = isMedia
          ? "사진을 보냈습니다"
          : isFile
            ? "파일을 보냈습니다"
            : (message.content || "").slice(0, 100);

        showBrowserNotification({
          title: message.sender_name ?? "새 메시지",
          body,
          tag: `chat-${roomId}`,
        });
      }
    }, [onNewMessageArrived, userId, roomId, chatPrefsRef, throttledMarkAsRead]),
  });

  // broadcastReadReceipt ref 동기화 (markAsReadMutation.onSuccess에서 안전하게 참조)
  broadcastReadReceiptRef.current = broadcastReadReceipt;

  // 뮤테이션 (broadcastInsert 연결)
  const {
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    togglePin,
    setAnnouncement,
    retryMessage,
    removeFailedMessage,
    isSending,
    isEditing,
    isDeleting,
  } = useChatMutations({
    roomId,
    userId,
    roomDataMembers: roomData?.members,
    replyTarget,
    setReplyTarget,
    uploadingFiles: fileUpload.uploadingFiles,
    setUploadingFiles: (fn) => {
      // useChatMutations에서 setUploadingFiles 호출은 첨부파일 전송 후 초기화(prev → [])만 사용.
      // fileUpload 내부 state setter는 노출되지 않으므로 clearFiles로 위임.
      // preview URL revoke는 fn(prev)를 통해 최신 값 기반으로 처리됨.
      const currentFiles = uploadingFilesRef.current;
      fn(currentFiles); // side effect: preview URL revoke
      fileUpload.clearFiles();
    },
    onNewMessageArrived,
    broadcastInsert,
  });

  // 오프라인→온라인 복귀 시 delta 메시지 동기화
  const lastMessageTimestampRef = useRef<string | null>(null);
  useEffect(() => {
    const pages = queryClient.getQueryData<{ pages: Array<{ data: Array<{ created_at: string }> }> }>(
      chatKeys.messages(roomId)
    );
    if (pages?.pages) {
      const lastPage = pages.pages[0];
      const lastMsg = lastPage?.data?.[lastPage.data.length - 1];
      if (lastMsg) lastMessageTimestampRef.current = lastMsg.created_at;
    }
  });

  useEffect(() => {
    const debouncedInvalidate = () =>
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(roomId) });

    const handleOnline = async () => {
      const since = lastMessageTimestampRef.current;
      if (!since) return;

      try {
        const { getMessagesSinceAction } = await import("@/lib/domains/chat/actions");
        const result = await getMessagesSinceAction(roomId, since, 100);
        if (result.success && result.data && result.data.length > 0) {
          queryClient.setQueryData(
            chatKeys.messages(roomId),
            (old: { pages: Array<{ data: Array<{ id: string }> }> } | undefined) => {
              if (!old?.pages) return old;
              const firstPage = old.pages[0];
              const existingIds = new Set(firstPage.data.map((m: { id: string }) => m.id));
              const newMessages = result.data!.filter((m) => !existingIds.has(m.id));
              if (newMessages.length === 0) return old;
              return {
                ...old,
                pages: [
                  { ...firstPage, data: [...firstPage.data, ...newMessages] },
                  ...old.pages.slice(1),
                ],
              };
            }
          );
        }
      } catch {
        debouncedInvalidate();
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [roomId, queryClient]);

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

  // 편집 가능 여부 확인 (UI 힌트 — 진짜 게이트는 서버)
  const canEditMessage = useCallback((createdAt: string) => {
    return new Date(createdAt).getTime() > Date.now() - MAX_EDIT_TIME_MS;
  }, []);

  const canPin = permissionsData?.canPin ?? false;
  const canSetAnnouncement = permissionsData?.canSetAnnouncement ?? false;

  // ============================================
  // Return
  // ============================================

  return {
    data: {
      room: roomData?.room,
      messages: messagesWithGrouping,
      pinnedMessages,
      announcement: announcementData ?? null,
      onlineUsers,
      typingUsers,
      members: roomData?.members ?? [],
      otherMemberLeft: roomData?.otherMemberLeft ?? false,
      leftOtherMember: roomData?.leftOtherMember ?? null,
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
      setAnnouncement,
      markAsRead,
      setTyping,
      retryMessage,
      removeFailedMessage,
    },
    status: {
      isLoading,
      fetchStatus,
      isSending,
      isEditing,
      isDeleting,
      error,
      hasNextPage,
      isFetchingNextPage,
      fetchNextPage,
      hasPreviousPage,
      isFetchingPreviousPage,
      fetchPreviousPage,
      refetch,
    },
    attachments: {
      uploadingFiles: fileUpload.uploadingFiles,
      addFiles: fileUpload.addFiles,
      removeFile: fileUpload.removeFile,
      retryUpload: fileUpload.retryUpload,
      clearFiles: fileUpload.clearFiles,
      isUploading: fileUpload.isUploading,
      quota: fileUpload.quota,
    },
    pinnedMessageIds,
    readCountsMap: readCountsMapRef,
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
