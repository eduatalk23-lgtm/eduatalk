"use client";

/**
 * useChatRoomLogic - 채팅방 비즈니스 로직 훅
 *
 * ChatRoom 컴포넌트의 비즈니스 로직을 분리하여
 * 테스트 용이성과 재사용성을 높입니다.
 */

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useBeforeUnload } from "@/lib/hooks/useBeforeUnload";
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
  chatCanPinQueryOptions,
  chatCanSetAnnouncementQueryOptions,
} from "@/lib/query-options/chatRoom";
import {
  sendMessageAction,
  markAsReadAction,
  editMessageAction,
  deleteMessageAction,
  toggleReactionAction,
  pinMessageAction,
  unpinMessageAction,
  setAnnouncementAction,
  registerChatAttachmentAction,
  sendMessageWithAttachmentsAction,
  deleteChatAttachmentAction,
  getChatStorageQuotaAction,
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
  type UploadingAttachment,
  type ChatAttachment,
  type MentionInfo,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "@/lib/domains/chat/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { validateChatFile, getAttachmentType, sanitizeFileName } from "@/lib/domains/chat/fileValidation";
import { isImageType } from "@/lib/domains/chat/fileValidation";
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
import type { ChatMessagePayload } from "@/lib/realtime/useChatRealtime";
import { showBrowserNotification } from "@/lib/domains/notification/browserNotification";
import { getChatNotificationPrefs } from "@/lib/domains/student/actions/notifications";
import { playChatFeedback } from "@/lib/audio/chatSound";
import { useThrottledCallback } from "@/lib/hooks/useThrottle";
import { operationTracker } from "../operationTracker";
import { chatKeys } from "../queryKeys";
import { isOnline, isNetworkError } from "@/lib/offline/networkStatus";
import {
  enqueueChatMessage,
  registerMessageSender,
  registerQueueEventCallbacks,
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
  attachments: {
    uploadingFiles: UploadingAttachment[];
    addFiles: (files: File[]) => void;
    removeFile: (clientId: string) => void;
    retryUpload: (clientId: string) => void;
    isUploading: boolean;
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

  // 큐 이벤트 콜백 등록 (큐 전송 성공/실패 → 캐시 갱신)
  useEffect(() => {
    registerQueueEventCallbacks({
      onMessageSent: (sentRoomId, clientMessageId, data) => {
        if (sentRoomId !== roomId) return;
        // "queued" 메시지를 실제 서버 메시지로 교체 (id 갱신 + status → "sent")
        queryClient.setQueryData<InfiniteMessagesCache>(
          chatKeys.messages(roomId),
          (old) => replaceMessageInFirstPage(old, clientMessageId, { id: data.id })
        );
      },
      onMessageFailed: (failedRoomId, clientMessageId, error) => {
        if (failedRoomId !== roomId) return;
        queryClient.setQueryData<InfiniteMessagesCache>(
          chatKeys.messages(roomId),
          (old) =>
            updateMessageInCache(old, clientMessageId, (m) => ({
              ...m,
              status: "error" as const,
            }))
        );
        showError(`메시지 전송 실패: ${error}`);
      },
    });
  }, [roomId, queryClient, showError]);

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
  // markAsRead() 호출 전에 캡처해야 하므로 roomData 첫 로드 시점에 저장
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

  // 고정 권한 확인 (SSR prefetch 활용, staleTime 5분)
  const { data: canPinData } = useQuery(chatCanPinQueryOptions(roomId));

  const canPin = canPinData?.canPin ?? false;

  // 공지 조회 (SSR prefetch 활용)
  const { data: announcementData } = useQuery(chatAnnouncementQueryOptions(roomId));

  // 공지 설정 권한 확인 (SSR prefetch 활용, staleTime 5분)
  const { data: canSetAnnouncementData } = useQuery(chatCanSetAnnouncementQueryOptions(roomId));

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

  // readCounts 캐시 (증분 업데이트 + refetch 감지용)
  const pagesLengthRef = useRef(0);
  const prevPagesRef = useRef<typeof messagesData | undefined>(undefined);
  const cachedReadCountsRef = useRef<Record<string, number>>({});

  // READ_RECEIPT 실시간 갱신용
  const [readCountVersion, setReadCountVersion] = useState(0);
  const readReceiptTrackRef = useRef(new Map<string, string>()); // readerId → lastReadAt

  /** 낙관적 readCount 설정: 새 메시지의 안 읽은 인원수 즉시 반영 */
  const setOptimisticReadCount = useCallback((messageId: string) => {
    const activeOtherMembers = (roomData?.members ?? []).filter(
      (m) => m.user_id !== userId && !m.left_at
    ).length;
    if (activeOtherMembers > 0) {
      cachedReadCountsRef.current = {
        ...cachedReadCountsRef.current,
        [messageId]: activeOtherMembers,
      };
      setReadCountVersion((v) => v + 1);
    }
  }, [roomData?.members, userId]);

  /** readCount 이관: tempId → realId (메시지 확정 시) */
  const transferReadCount = useCallback((tempId: string, realId: string) => {
    const tempReadCount = cachedReadCountsRef.current[tempId];
    if (tempReadCount !== undefined) {
      const { [tempId]: _, ...rest } = cachedReadCountsRef.current;
      cachedReadCountsRef.current = { ...rest, [realId]: tempReadCount };
      setReadCountVersion((v) => v + 1);
    }
  }, []);

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

  // 그룹핑 옵션 (구분선용 — ref이므로 deps에 포함 불필요)
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

    const prev = prevAllMessagesRef.current;
    const prevGrouped = prevGroupedRef.current;

    // Fast path: 끝에 메시지 1~3개 추가 (가장 흔한 realtime 케이스)
    // 새 메시지에는 구분선 추가 안 함 (이미 읽고 있는 상태이므로)
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
    const result = processMessagesWithGrouping(allMessages, groupingOptions);
    prevAllMessagesRef.current = allMessages;
    prevGroupedRef.current = result;
    return result;
  }, [allMessages]); // eslint-disable-line react-hooks/exhaustive-deps -- groupingOptions uses refs

  // readCounts 병합 (refetch 감지 + 증분 최적화 + READ_RECEIPT 실시간 갱신)
  //
  // 이전 버그: 페이지 수가 같으면 무조건 캐시 반환 → background refetch 시 서버의
  // 최신 readCounts가 무시됨 (뒤로가기 후 재진입 시 읽음 숫자 누락)
  //
  // 수정: pages 참조(identity) 변경 감지로 refetch와 READ_RECEIPT 업데이트를 구분
  const allReadCounts = useMemo(() => {
    if (!messagesData?.pages) {
      cachedReadCountsRef.current = {};
      pagesLengthRef.current = 0;
      prevPagesRef.current = undefined;
      return {};
    }

    const pages = messagesData.pages;
    const currentLength = pages.length;
    const prevLength = pagesLengthRef.current;
    const pagesIdentityChanged = messagesData !== prevPagesRef.current;
    prevPagesRef.current = messagesData;

    // readCountVersion만 변경 (READ_RECEIPT, 낙관적 업데이트) → 캐시 반환
    if (!pagesIdentityChanged) {
      return cachedReadCountsRef.current;
    }

    // pages가 변경된 경우: 서버 데이터 기반으로 재구성
    const serverReadCounts = pages.reduce(
      (acc, page) => ({
        ...acc,
        ...(page?.readCounts ?? {}),
      }),
      {} as Record<string, number>
    );

    if (prevLength === 0) {
      // 첫 로드: 서버 데이터만 사용
      readReceiptTrackRef.current.clear();
      cachedReadCountsRef.current = serverReadCounts;
    } else if (currentLength > prevLength) {
      // 새 페이지 추가 (pagination): 기존 캐시 + 새 페이지 readCounts
      cachedReadCountsRef.current = { ...cachedReadCountsRef.current, ...serverReadCounts };
    } else {
      // refetch (같은 페이지 수 또는 줄어듦): 서버 데이터로 갱신 + 낙관적 값 보존
      const localOptimistic: Record<string, number> = {};
      for (const [key, value] of Object.entries(cachedReadCountsRef.current)) {
        // 아직 서버에 반영 안 된 낙관적 메시지(temp-*)의 readCount 보존
        if (key.startsWith("temp-") && !(key in serverReadCounts)) {
          localOptimistic[key] = value;
        }
      }
      cachedReadCountsRef.current = { ...serverReadCounts, ...localOptimistic };
    }

    pagesLengthRef.current = currentLength;
    return cachedReadCountsRef.current;
    // readCountVersion: READ_RECEIPT 수신 시 cachedReadCountsRef가 직접 업데이트되고,
    // readCountVersion 변경으로 useMemo 재실행 → cachedReadCountsRef.current 반환
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesData, readCountVersion]);

  // ============================================
  // Mutations
  // ============================================

  // 메시지 전송 (Broadcast-first + Optimistic Updates 적용)
  const sendMutation = useMutation({
    mutationFn: async ({
      content,
      replyToId,
      clientMessageId,
      mentions,
    }: {
      content: string;
      replyToId?: string | null;
      clientMessageId?: string;
      mentions?: MentionInfo[];
    }) => {
      const SEND_TIMEOUT_MS = 15_000;

      const result = await Promise.race([
        sendMessageAction(roomId, content, replyToId, clientMessageId, mentions),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("메시지 전송 시간이 초과되었습니다. (timeout)")),
            SEND_TIMEOUT_MS
          )
        ),
      ]);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onMutate: async ({ content, replyToId, clientMessageId }) => {
      // 1. 진행 중인 쿼리 취소 (낙관적 업데이트와 충돌 방지)
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(roomId) });

      // 2. 이전 데이터 스냅샷 저장 (롤백용)
      const previousMessages = queryClient.getQueryData(chatKeys.messages(roomId));

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
        metadata: null,
      };

      queryClient.setQueryData<InfiniteMessagesCache>(
        chatKeys.messages(roomId),
        (old) => addMessageToFirstPage(old, optimisticMessage)
      );

      setOptimisticReadCount(tempId);

      // Broadcast-first: DB INSERT 전에 수신자에게 즉시 전송 (~6ms)
      // try-catch로 감싸서 채널 에러 시에도 context(tempId)가 반환되도록 보장
      if (clientMessageId) {
        try {
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
        } catch {
          // Realtime 채널 에러 시 broadcast만 실패 — DB 전송은 계속 진행
          console.warn("[ChatRoom] broadcastInsert failed, continuing with DB send");
        }
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

        transferReadCount(tempId, data.id);

        const updated = queryClient.setQueryData<InfiniteMessagesCache>(
          chatKeys.messages(roomId),
          (old) => replaceMessageInFirstPage(old, tempId, data)
        );
        // Fallback: temp 메시지를 못 찾은 경우 (캐시 경쟁 조건) → 서버에서 최신 데이터 refetch
        if (!findMessageInCache(updated, data.id)) {
          queryClient.invalidateQueries({ queryKey: chatKeys.messages(roomId) });
        }
      }
    },
    onError: (_err, variables, context) => {
      // 6. 실패 시 네트워크 에러면 큐로 전환, 아니면 에러 표시
      // 단, timeout 에러는 원래 요청이 서버에서 성공했을 수 있으므로 큐잉하지 않음
      const tempId = context?.tempId;
      const isSendTimeout =
        _err instanceof Error && _err.message.includes("(timeout)");
      if (tempId) {
        if (!isSendTimeout && isNetworkError(_err)) {
          // 네트워크 에러 → tracker 해제 + "queued"로 전환 + IndexedDB 큐 저장
          operationTracker.failSend(tempId);
          queryClient.setQueryData<InfiniteMessagesCache>(
            chatKeys.messages(roomId),
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
            chatKeys.messages(roomId),
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
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(roomId) });

      // 이전 데이터 스냅샷 저장 (롤백용)
      const previousMessages = queryClient.getQueryData<InfiniteMessagesCache>([
        "chat-messages",
        roomId,
      ]);

      // 낙관적 업데이트
      queryClient.setQueryData<InfiniteMessagesCache>(
        chatKeys.messages(roomId),
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
          chatKeys.messages(roomId),
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
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(roomId) });

      // 이전 데이터 스냅샷 저장 (롤백용)
      const previousMessages = queryClient.getQueryData<InfiniteMessagesCache>([
        "chat-messages",
        roomId,
      ]);

      // 낙관적 업데이트 (is_deleted=true 설정)
      queryClient.setQueryData<InfiniteMessagesCache>(
        chatKeys.messages(roomId),
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
          chatKeys.messages(roomId),
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
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(roomId) });

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
        chatKeys.messages(roomId),
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
          chatKeys.messages(roomId),
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
      queryClient.invalidateQueries({ queryKey: chatKeys.pinned(roomId) });
      // 메시지 목록의 pin 상태도 동기화
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(roomId) });
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
      queryClient.invalidateQueries({ queryKey: chatKeys.announcement(roomId) });
    },
    onError: (error) => {
      showError("공지 설정에 실패했습니다.");
      console.error("[ChatRoom] Announcement error:", error);
    },
  });

  // broadcastReadReceipt ref (useChatRealtime보다 먼저 정의되는 markAsReadMutation에서 안전하게 참조)
  const broadcastReadReceiptRef = useRef<() => void>(() => {});

  // 읽음 처리
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      await markAsReadAction(roomId);
    },
    onMutate: async () => {
      // 1. 진행 중인 refetch 취소 (낙관적 업데이트 덮어쓰기 방지)
      await queryClient.cancelQueries({ queryKey: chatKeys.rooms() });

      // 2. 이전 값 스냅샷 (롤백용)
      const previousRooms = queryClient.getQueryData<ChatRoomListItem[]>(chatKeys.rooms());

      // 3. 캐시 즉시 업데이트: 해당 방의 unreadCount를 0으로
      if (previousRooms) {
        queryClient.setQueryData<ChatRoomListItem[]>(
          chatKeys.rooms(),
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
        queryClient.setQueryData(chatKeys.rooms(), context.previousRooms);
      }
    },
    onSuccess: () => {
      // 5-a. 상대방에게 읽음 확인 broadcast (상대 화면의 읽지않은 수 실시간 갱신)
      broadcastReadReceiptRef.current();
    },
    onSettled: () => {
      // 5-b. 성공/실패 무관하게 서버 데이터로 최종 동기화
      queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
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

  // 실시간 구독 (Broadcast-first: broadcastInsert, broadcastReadReceipt 반환)
  const { broadcastInsert, broadcastReadReceipt } = useChatRealtime({
    roomId,
    userId,
    senderCache,
    onReadReceipt: useCallback((readerId: string, readAt: string) => {
      // 중복 처리 방지: 같은 reader의 이전 readAt보다 새로운 경우만 처리
      const prevReadAt = readReceiptTrackRef.current.get(readerId) ?? "1970-01-01T00:00:00Z";
      if (readAt <= prevReadAt) return;
      readReceiptTrackRef.current.set(readerId, readAt);

      // 본인 메시지 중 새로 읽힌 메시지의 readCount를 감소
      const updated = { ...cachedReadCountsRef.current };
      const messages = prevAllMessagesRef.current;
      let hasChanges = false;

      for (const msg of messages) {
        if (
          msg.sender_id === userId &&
          msg.created_at <= readAt &&
          msg.created_at > prevReadAt
        ) {
          const current = updated[msg.id] ?? 0;
          if (current > 0) {
            updated[msg.id] = Math.max(0, current - 1);
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        cachedReadCountsRef.current = updated;
        setReadCountVersion((v) => v + 1);
      }
    }, [userId]),
    onNewMessage: useCallback((message: ChatMessagePayload) => {
      // 스크롤이 맨 아래에 있으면 자동 스크롤 (ref 사용으로 항상 최신 값)
      if (isAtBottomRef.current) {
        onNewMessageArrived?.();
      }
      // 읽음 처리 (읽음확인 설정이 꺼져있으면 스킵)
      const prefs = chatPrefsRef.current;
      if (prefs?.chat_read_receipt_enabled !== false) {
        throttledMarkAsRead();
      }

      // 타인 메시지 수신 시 소리/진동 피드백
      if (message.sender_id !== userId) {
        playChatFeedback({
          sound: prefs?.chat_sound_enabled !== false,
          vibrate: prefs?.chat_vibrate_enabled !== false,
        });
      }

      // 백그라운드 탭일 때 브라우저 알림 (본인 메시지 제외)
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
    }, [onNewMessageArrived, throttledMarkAsRead, userId, roomId]),
  });

  // broadcastReadReceipt ref 동기화 (markAsReadMutation.onSuccess에서 안전하게 참조)
  broadcastReadReceiptRef.current = broadcastReadReceipt;

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

  // 입장 시 읽음 처리 + READ_RECEIPT 추적 리셋
  useEffect(() => {
    readReceiptTrackRef.current.clear();
    if (chatPrefsRef.current?.chat_read_receipt_enabled !== false) {
      markAsReadMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // "sending" 상태 메시지 자동 복구 (30초 이상 stuck 감지)
  useEffect(() => {
    const STALE_THRESHOLD_MS = 30_000;
    const CHECK_INTERVAL_MS = 10_000;

    const interval = setInterval(() => {
      const cache = queryClient.getQueryData<InfiniteMessagesCache>([
        "chat-messages",
        roomId,
      ]);
      if (!cache?.pages) return;

      const now = Date.now();
      let hasStale = false;

      for (const page of cache.pages) {
        for (const msg of page.messages) {
          if (
            msg.status === "sending" &&
            now - new Date(msg.created_at).getTime() > STALE_THRESHOLD_MS
          ) {
            hasStale = true;
            break;
          }
        }
        if (hasStale) break;
      }

      if (hasStale) {
        // side effect를 updater 밖에서 실행 (updater는 순수 함수여야 함)
        const staleIds: string[] = [];
        for (const page of cache.pages) {
          for (const msg of page.messages) {
            if (
              msg.status === "sending" &&
              now - new Date(msg.created_at).getTime() > STALE_THRESHOLD_MS
            ) {
              staleIds.push(msg.id);
            }
          }
        }
        staleIds.forEach((id) => operationTracker.failSend(id));

        const staleIdSet = new Set(staleIds);
        queryClient.setQueryData<InfiniteMessagesCache>(
          chatKeys.messages(roomId),
          (old) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                messages: page.messages.map((m) =>
                  staleIdSet.has(m.id)
                    ? { ...m, status: "error" as const }
                    : m
                ),
              })),
            };
          }
        );
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [roomId, queryClient]);

  // ============================================
  // File Upload State
  // ============================================

  const [uploadingFiles, setUploadingFiles] = useState<UploadingAttachment[]>([]);

  // Preview URL 메모리 누수 방지: ref로 최신 상태 추적 + unmount 시 cleanup
  const uploadingFilesRef = useRef<UploadingAttachment[]>([]);
  uploadingFilesRef.current = uploadingFiles;

  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시 모든 preview URL 해제
      for (const f of uploadingFilesRef.current) {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      }
    };
  }, []);

  // 업로드 진행 중 페이지 이탈 경고
  const isUploading = uploadingFiles.some(
    (f) => f.status === "uploading" || f.status === "pending"
  );
  useBeforeUnload(isUploading, "파일 업로드가 진행 중입니다. 나가시겠습니까?");

  // addFiles 동시 호출 직렬화 (race condition 방지)
  const addFilesLockRef = useRef<Promise<void>>(Promise.resolve());

  /** 단일 파일 업로드 처리 (병렬 실행용) */
  const uploadSingleFile = useCallback(
    async (file: File, clientId: string) => {
      try {
        // 이미지인 경우 리사이즈
        let uploadFile: File | Blob = file;
        let width: number | undefined;
        let height: number | undefined;

        if (isImageType(file.type)) {
          try {
            const { resizeImageIfNeeded } = await import("@/lib/domains/chat/imageResize");
            const resized = await resizeImageIfNeeded(file);
            uploadFile = resized.blob;
            width = resized.width;
            height = resized.height;
          } catch {
            // 리사이즈 실패 시 원본 사용
          }
        }

        // Supabase 세션 획득 (만료 임박 시 자동 갱신)
        const supabase = createSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        if (!session) throw new Error("인증 세션이 만료되었습니다. 새로고침해주세요.");

        let accessToken = session.access_token;
        const expiresAt = session.expires_at ?? 0;
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt - now < 60) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed.session) {
            accessToken = refreshed.session.access_token;
          }
        }

        const safeName = sanitizeFileName(file.name);
        const timestamp = Date.now();
        const storagePath = `${roomId}/${userId}/${timestamp}_${safeName}`;

        // AbortController 생성 + 상태에 저장
        const abortController = new AbortController();
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.clientId === clientId ? { ...f, abortController } : f
          )
        );

        const { uploadWithProgress } = await import("@/lib/domains/chat/uploadWithProgress");
        const { error: uploadError } = await uploadWithProgress({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
          accessToken,
          bucket: "chat-attachments",
          path: storagePath,
          file: uploadFile,
          onProgress: (progress) => {
            setUploadingFiles((prev) =>
              prev.map((f) =>
                f.clientId === clientId ? { ...f, progress } : f
              )
            );
          },
          signal: abortController.signal,
        });

        if (uploadError) throw uploadError;

        // 이미지인 경우 썸네일 생성 + 업로드 (비치명적)
        let thumbnailPath: string | null = null;
        if (isImageType(file.type)) {
          try {
            const { generateThumbnail } = await import("@/lib/domains/chat/imageResize");
            const thumb = await generateThumbnail(uploadFile);
            const thumbPath = `${roomId}/${userId}/${timestamp}_thumb_${safeName}`;

            const { error: thumbError } = await supabase.storage
              .from("chat-attachments")
              .upload(thumbPath, thumb.blob, { contentType: "image/webp" });

            if (!thumbError) {
              thumbnailPath = thumbPath;
            }
          } catch {
            // 썸네일 생성 실패 시 풀 이미지 사용 (비치명적)
          }
        }

        // Server Action으로 DB 레코드 등록
        const result = await registerChatAttachmentAction(
          roomId,
          storagePath,
          file.name,
          file.size,
          file.type,
          width,
          height,
          thumbnailPath
        );

        if (!result.success || !result.data) {
          throw new Error(`${file.name}: ${result.error ?? "첨부파일 등록 실패"}`);
        }

        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.clientId === clientId
              ? { ...f, status: "done" as const, progress: 100, result: result.data, abortController: undefined }
              : f
          )
        );
      } catch (err) {
        // 사용자가 파일 제거로 취소한 경우 state 업데이트 불필요
        if (err instanceof Error && err.message === "업로드가 취소되었습니다.") return;

        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.clientId === clientId
              ? {
                  ...f,
                  status: "error" as const,
                  error: err instanceof Error ? err.message : `${file.name}: 업로드 실패`,
                  abortController: undefined,
                }
              : f
          )
        );
      }
    },
    [roomId, userId]
  );

  const addFiles = useCallback(
    (files: File[]) => {
      // 직렬화: 이전 addFiles 완료 후 실행 (동시 호출 시 race condition 방지)
      const task = addFilesLockRef.current.then(async () => {
        // 현재 파일 수 기준으로 남은 슬롯 계산 (ref로 최신 상태 참조)
        const currentCount = uploadingFilesRef.current.length;
        const remaining = MAX_ATTACHMENTS_PER_MESSAGE - currentCount;
        if (remaining <= 0) {
          showError(`파일은 최대 ${MAX_ATTACHMENTS_PER_MESSAGE}개까지 첨부할 수 있습니다.`);
          return;
        }
        const limitedFiles = files.slice(0, remaining);

        // 업로드 전 쿼터 사전 체크
        const totalNewSize = limitedFiles.reduce((sum, f) => sum + f.size, 0);
        const quotaResult = await getChatStorageQuotaAction();
        if (quotaResult.success && quotaResult.data) {
          if (quotaResult.data.remainingBytes < totalNewSize) {
            const { formatStorageSize } = await import("@/lib/domains/chat/quota");
            showError(
              `스토리지 용량 부족: 남은 ${formatStorageSize(quotaResult.data.remainingBytes)}`
            );
            return;
          }
        }

        // 1단계: 검증 + 상태 일괄 등록 (동기)
        const validFiles: { file: File; clientId: string }[] = [];
        const newEntries: UploadingAttachment[] = [];

        for (const file of limitedFiles) {
          const validation = validateChatFile(file);
          if (!validation.valid) {
            showError(validation.error ?? "파일 검증 실패");
            continue;
          }

          const clientId = crypto.randomUUID();
          const previewUrl = isImageType(file.type) ? URL.createObjectURL(file) : "";
          validFiles.push({ file, clientId });
          newEntries.push({ clientId, file, previewUrl, progress: 0, status: "uploading" });
        }

        if (newEntries.length === 0) return;
        setUploadingFiles((prev) => [...prev, ...newEntries]);

        // 2단계: 모든 파일 병렬 업로드
        await Promise.allSettled(
          validFiles.map(({ file, clientId }) => uploadSingleFile(file, clientId))
        );
      });

      // lock 갱신 (에러 발생해도 다음 호출은 진행되도록)
      addFilesLockRef.current = task.catch(() => {});
    },
    [showError, uploadSingleFile]
  );

  /** 실패한 파일 업로드 재시도 */
  const retryUpload = useCallback(
    (clientId: string) => {
      const target = uploadingFilesRef.current.find(
        (f) => f.clientId === clientId && f.status === "error"
      );
      if (!target) return;

      // 상태 초기화
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.clientId === clientId
            ? { ...f, status: "uploading" as const, progress: 0, error: undefined }
            : f
        )
      );

      // 재업로드
      uploadSingleFile(target.file, clientId);
    },
    [uploadSingleFile]
  );

  const removeFile = useCallback(
    (clientId: string) => {
      setUploadingFiles((prev) => {
        const file = prev.find((f) => f.clientId === clientId);
        if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
        // 진행 중인 업로드 취소
        if (file?.status === "uploading" && file.abortController) {
          file.abortController.abort();
        }
        // 업로드 완료된 파일이면 서버에서도 삭제
        if (file?.status === "done" && file.result) {
          deleteChatAttachmentAction(file.result.id).catch(() => {});
        }
        return prev.filter((f) => f.clientId !== clientId);
      });
    },
    []
  );

  // ============================================
  // Actions
  // ============================================

  const sendMessage = useCallback(
    (content: string, replyToId?: string | null, mentions?: MentionInfo[]) => {
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
          metadata: null,
        };

        queryClient.setQueryData<InfiniteMessagesCache>(
          chatKeys.messages(roomId),
          (old) => addMessageToFirstPage(old, queuedMessage)
        );
        enqueueChatMessage(roomId, content, replyToId, clientMessageId);
        setReplyTarget(null);
        setTimeout(() => onNewMessageArrived?.(), 0);
        return;
      }

      // 온라인: 첨부파일이 있으면 attachments action 사용
      const completedAttachments = uploadingFiles.filter(
        (f) => f.status === "done" && f.result
      );

      if (completedAttachments.length > 0) {
        const attachmentIds = completedAttachments.map((f) => f.result!.id);
        const attachmentResults = completedAttachments
          .map((f) => f.result!)
          .filter(Boolean);

        // 낙관적 업데이트: 텍스트 전용과 동일한 패턴
        const now = new Date().toISOString();
        const currentMember = roomData?.members?.find(
          (m) => m.user_id === userId
        );
        const senderName = currentMember?.user?.name ?? "나";
        const senderProfileUrl = currentMember?.user?.profileImageUrl ?? null;
        const senderType = currentMember?.user?.type ?? ("student" as const);

        const hasText = content.trim().length > 0;
        const allImages = attachmentResults.every(
          (a) => a.attachment_type === "image"
        );
        const messageType = hasText
          ? "mixed"
          : allImages
            ? "image"
            : "file";
        const messageContent = hasText ? content : " ";

        operationTracker.startSend(clientMessageId, messageContent, roomId);

        const optimisticMessage: CacheMessage = {
          id: clientMessageId,
          content: messageContent,
          sender_id: userId,
          sender_type: senderType,
          message_type: messageType,
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
          sender_name: senderName,
          sender_profile_url: senderProfileUrl,
          attachments: attachmentResults,
          metadata: null,
        };

        queryClient.setQueryData<InfiniteMessagesCache>(
          chatKeys.messages(roomId),
          (old) => addMessageToFirstPage(old, optimisticMessage)
        );

        setOptimisticReadCount(clientMessageId);

        // Broadcast-first: 수신자에게 즉시 전송
        try {
          broadcastInsert({
            id: clientMessageId,
            room_id: roomId,
            sender_id: userId,
            sender_type: senderType,
            sender_name: senderName,
            sender_profile_url: senderProfileUrl,
            content: messageContent,
            message_type: messageType,
            reply_to_id: replyToId ?? null,
            created_at: now,
            updated_at: now,
            is_deleted: false,
            deleted_at: null,
          });
          operationTracker.markRealtimeProcessed(`insert:${clientMessageId}`);
        } catch {
          console.warn("[ChatRoom] broadcastInsert failed for attachment message");
        }

        // Preview URL 메모리 해제 후 상태 초기화
        for (const f of uploadingFiles) {
          if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        }
        setUploadingFiles([]);
        setReplyTarget(null);
        setTimeout(() => onNewMessageArrived?.(), 0);

        // 서버 전송 (비동기)
        sendMessageWithAttachmentsAction(
          roomId,
          content,
          attachmentIds,
          replyToId,
          clientMessageId
        ).then((result) => {
          if (result.success && result.data) {
            operationTracker.completeSend(clientMessageId, result.data.id);

            transferReadCount(clientMessageId, result.data.id);

            queryClient.setQueryData<InfiniteMessagesCache>(
              chatKeys.messages(roomId),
              (old) => replaceMessageInFirstPage(old, clientMessageId, result.data!)
            );
          } else {
            operationTracker.failSend(clientMessageId);
            queryClient.setQueryData<InfiniteMessagesCache>(
              chatKeys.messages(roomId),
              (old) =>
                updateMessageInCache(old, clientMessageId, (m) => ({
                  ...m,
                  status: "error" as const,
                }))
            );
            showError(result.error ?? "메시지 전송 실패");
          }
        }).catch((err) => {
          operationTracker.failSend(clientMessageId);
          queryClient.setQueryData<InfiniteMessagesCache>(
            chatKeys.messages(roomId),
            (old) =>
              updateMessageInCache(old, clientMessageId, (m) => ({
                ...m,
                status: "error" as const,
              }))
          );
          showError(err instanceof Error ? err.message : "메시지 전송 실패");
        });
      } else {
        sendMutation.mutate({ content, replyToId, clientMessageId, mentions });
      }
    },
    [sendMutation, roomId, userId, roomData, queryClient, onNewMessageArrived, replyTarget, uploadingFiles, showError, broadcastInsert]
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

  // 외부에서 호출되는 markAsRead도 throttle 적용 (읽음확인 OFF 시 스킵)
  const markAsRead = useCallback(() => {
    if (chatPrefsRef.current?.chat_read_receipt_enabled !== false) {
      throttledMarkAsRead();
    }
  }, [throttledMarkAsRead]);

  // 메시지 재전송 핸들러 (원래 위치 유지, 카카오톡 스타일)
  const retryMessage = useCallback(
    (message: ChatMessageWithGrouping) => {
      const messageId = message.id;

      // 1. 기존 메시지 상태를 "sending"으로 변경 (위치 유지)
      queryClient.setQueryData<InfiniteMessagesCache>(
        chatKeys.messages(roomId),
        (old) => updateMessageInCache(old, messageId, (m) => ({ ...m, status: "sending" }))
      );

      // 2. Operation Tracker에 재전송 등록
      operationTracker.startSend(messageId, message.content, roomId);

      // 3. 서버로 재전송 (기존 clientMessageId 재사용)
      const replyToId = (message as { reply_to_id?: string | null }).reply_to_id;
      sendMessageAction(roomId, message.content, replyToId, messageId)
        .then((result) => {
          if (result.success && result.data) {
            operationTracker.completeSend(messageId, result.data.id);
            // 기존 temp 메시지를 서버 응답으로 교체 (위치 유지)
            const updated = queryClient.setQueryData<InfiniteMessagesCache>(
              chatKeys.messages(roomId),
              (old) => replaceMessageInFirstPage(old, messageId, result.data!)
            );
            if (!findMessageInCache(updated, result.data.id)) {
              queryClient.invalidateQueries({ queryKey: chatKeys.messages(roomId) });
            }
          } else {
            throw new Error(result.error ?? "전송 실패");
          }
        })
        .catch(() => {
          operationTracker.failSend(messageId);
          queryClient.setQueryData<InfiniteMessagesCache>(
            chatKeys.messages(roomId),
            (old) => updateMessageInCache(old, messageId, (m) => ({ ...m, status: "error" }))
          );
        });
    },
    [roomId, queryClient]
  );

  // 전송 실패 메시지 삭제 핸들러
  const removeFailedMessage = useCallback(
    (messageId: string) => {
      queryClient.setQueryData<InfiniteMessagesCache>(
        chatKeys.messages(roomId),
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
    attachments: {
      uploadingFiles,
      addFiles,
      removeFile,
      retryUpload,
      isUploading,
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
