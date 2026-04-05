"use client";

/**
 * useChatMutations - 채팅 메시지 변이 훅
 *
 * send/edit/delete/reaction/pin/announcement mutations,
 * 오프라인 큐 초기화, Actions(public API)를 담당합니다.
 */

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/ToastProvider";
import { useDebouncedCallback } from "@/lib/hooks/useDebounce";
import { useThrottledCallback } from "@/lib/hooks/useThrottle";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sendMessageWithAttachmentsAction } from "@/lib/domains/chat/actions";
import {
  type InfiniteMessagesCache,
  type CacheMessage,
  addMessageToFirstPage,
  replaceMessageInFirstPage,
  updateMessageInCache,
  removeMessageFromCache,
  findMessageInCache,
} from "@/lib/domains/chat/cacheTypes";
import { operationTracker } from "../operationTracker";
import { chatKeys } from "../queryKeys";
import { isOnline, isNetworkError } from "@/lib/offline/networkStatus";
import { enqueueChatMessage } from "@/lib/offline/chatQueue";
import { useChatOfflineQueue } from "./useChatOfflineQueue";
import { useChatStaleRecovery } from "./useChatStaleRecovery";
import type {
  ReactionEmoji,
  ReplyTargetInfo,
  ChatMessageWithGrouping,
  ChatUserType,
  ChatMessageType,
  MentionInfo,
  UploadingAttachment,
} from "@/lib/domains/chat/types";

/**
 * UUID v4 생성 (Secure Context 불필요)
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface UseChatMutationsOptions {
  roomId: string;
  userId: string;
  roomDataMembers: Array<{
    user_id: string;
    left_at: string | null;
    user: { name: string; type: ChatUserType; id?: string; profileImageUrl?: string | null };
  }> | undefined;
  replyTarget: ReplyTargetInfo | null;
  setReplyTarget: (target: ReplyTargetInfo | null) => void;
  uploadingFiles: UploadingAttachment[];
  setUploadingFiles: (fn: (prev: UploadingAttachment[]) => UploadingAttachment[]) => void;
  onNewMessageArrived?: () => void;
  broadcastInsert: (payload: {
    id: string;
    room_id: string;
    sender_id: string;
    sender_type: ChatUserType;
    sender_name: string;
    sender_profile_url: string | null;
    content: string;
    message_type: ChatMessageType;
    reply_to_id: string | null;
    created_at: string;
    updated_at: string;
    is_deleted: boolean;
    deleted_at: string | null;
  }) => void;
}

export interface UseChatMutationsReturn {
  sendMessage: (content: string, replyToId?: string | null, mentions?: MentionInfo[]) => void;
  editMessage: (messageId: string, content: string, expectedUpdatedAt?: string) => void;
  deleteMessage: (messageId: string) => void;
  toggleReaction: (messageId: string, emoji: ReactionEmoji) => void;
  togglePin: (messageId: string, isPinned: boolean) => void;
  setAnnouncement: (content: string | null) => void;
  retryMessage: (message: ChatMessageWithGrouping) => void;
  removeFailedMessage: (messageId: string) => void;
  isSending: boolean;
  isEditing: boolean;
  isDeleting: boolean;
}

export function useChatMutations({
  roomId,
  userId,
  roomDataMembers,
  replyTarget,
  setReplyTarget,
  uploadingFiles,
  setUploadingFiles,
  onNewMessageArrived,
  broadcastInsert,
}: UseChatMutationsOptions): UseChatMutationsReturn {
  const queryClient = useQueryClient();
  const { showError } = useToast();

  // Debounced 메시지 invalidation (Realtime broadcast와의 경합 방지, 300ms)
  const debouncedInvalidateMessages = useDebouncedCallback(
    () => queryClient.invalidateQueries({ queryKey: chatKeys.messages(roomId) }),
    300
  );

  // 오프라인 큐 초기화 + 이벤트 콜백 등록
  useChatOfflineQueue(roomId, queryClient, showError);

  // stale "sending" 메시지 자동 복구 (30초 이상 stuck 감지)
  useChatStaleRecovery(roomId, queryClient);

  // ============================================
  // Mutations
  // ============================================

  // 메시지 전송 (Broadcast-first + Optimistic Updates, Browser RPC)
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
      const supabase = createSupabaseBrowserClient();

      const rpcCall = supabase.rpc("send_chat_message", {
        p_room_id: roomId,
        p_content: content,
        p_message_type: "text",
        p_reply_to_id: replyToId ?? undefined,
        p_client_message_id: clientMessageId ?? undefined,
        p_mentions: mentions && mentions.length > 0 ? JSON.parse(JSON.stringify(mentions)) : undefined,
      });

      const { data, error } = await Promise.race([
        rpcCall,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("메시지 전송 시간이 초과되었습니다. (timeout)")),
            SEND_TIMEOUT_MS
          )
        ),
      ]);
      if (error) throw new Error(error.message);
      const msg = data as Record<string, unknown>;
      return {
        id: msg.id as string,
        room_id: msg.room_id as string,
        content: msg.content as string,
        created_at: msg.created_at as string,
        updated_at: msg.updated_at as string,
        sender_id: msg.sender_id as string,
        sender_type: (msg.sender_type as string) as ChatUserType,
        sender_name: msg.sender_name as string,
        sender_profile_url: msg.sender_profile_url as string | null,
        message_type: msg.message_type as ChatMessageType,
        reply_to_id: msg.reply_to_id as string | null,
        is_deleted: msg.is_deleted as boolean,
        deleted_at: msg.deleted_at as string | null,
        metadata: msg.metadata as Record<string, unknown> | null,
      };
    },
    onMutate: async ({ content, replyToId, clientMessageId }) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(roomId) });
      const previousMessages = queryClient.getQueryData(chatKeys.messages(roomId));
      const previousReplyTarget = replyTarget;

      const tempId = clientMessageId ?? `temp-${Date.now()}`;
      operationTracker.startSend(tempId, content, roomId);
      const now = new Date().toISOString();

      const currentMember = roomDataMembers?.find((m) => m.user_id === userId);
      const senderName = currentMember?.user?.name ?? "나";
      const senderProfileUrl = currentMember?.user?.profileImageUrl ?? null;
      const senderType = currentMember?.user?.type ?? ("student" as const);

      const activeOtherMembers = (roomDataMembers ?? []).filter(
        (m) => m.user_id !== userId && !m.left_at
      ).length;

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
        readCount: activeOtherMembers > 0 ? activeOtherMembers : undefined,
        sender_name: senderName,
        sender_profile_url: senderProfileUrl,
        metadata: null,
      };

      queryClient.setQueryData<InfiniteMessagesCache>(
        chatKeys.messages(roomId),
        (old) => addMessageToFirstPage(old, optimisticMessage)
      );

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
          operationTracker.markRealtimeProcessed(`insert:${clientMessageId}`);
        } catch {
          console.warn("[useChatMutations] broadcastInsert failed, continuing with DB send");
        }
      }

      setReplyTarget(null);
      setTimeout(() => onNewMessageArrived?.(), 0);

      return { previousMessages, previousReplyTarget, tempId };
    },
    onSuccess: (data, _variables, context) => {
      const tempId = context?.tempId;
      if (tempId && data) {
        operationTracker.completeSend(tempId, data.id);
        const updated = queryClient.setQueryData<InfiniteMessagesCache>(
          chatKeys.messages(roomId),
          (old) => replaceMessageInFirstPage(old, tempId, data)
        );
        if (!findMessageInCache(updated, data.id)) {
          debouncedInvalidateMessages();
        }
      }
    },
    onError: (_err, variables, context) => {
      const tempId = context?.tempId;
      const isSendTimeout =
        _err instanceof Error && _err.message.includes("(timeout)");
      if (tempId) {
        if (!isSendTimeout && isNetworkError(_err)) {
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
          operationTracker.failSend(tempId);
          queryClient.setQueryData<InfiniteMessagesCache>(
            chatKeys.messages(roomId),
            (old) =>
              updateMessageInCache(old, tempId, (m) => ({ ...m, status: "error" }))
          );
          showError(_err instanceof Error ? _err.message : "메시지 전송에 실패했습니다.");
        }
      }

      if (context?.previousReplyTarget) {
        setReplyTarget(context.previousReplyTarget);
      }
    },
  });

  // 메시지 편집 (낙관적 업데이트 + 충돌 감지, Browser RPC)
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
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("edit_chat_message", {
        p_message_id: messageId,
        p_content: content,
        p_expected_updated_at: expectedUpdatedAt ?? undefined,
      });
      if (error) {
        const err = new Error(error.message);
        if (error.message.includes("CONFLICT_EDIT")) {
          (err as Error & { code?: string }).code = "CONFLICT_EDIT";
        }
        throw err;
      }
      return data as { id: string; content: string; updated_at: string };
    },
    onMutate: async ({ messageId, content }) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(roomId) });
      const previousMessages = queryClient.getQueryData<InfiniteMessagesCache>([
        "chat-messages",
        roomId,
      ]);

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
                  ? { ...m, content, updated_at: new Date().toISOString() }
                  : m
              ),
            })),
          };
        }
      );

      return { previousMessages };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(chatKeys.messages(roomId), context.previousMessages);
      }
    },
  });

  // 메시지 삭제 (낙관적 업데이트, Browser RPC)
  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("delete_chat_message", {
        p_message_id: messageId,
      });
      if (error) throw new Error(error.message);
    },
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(roomId) });
      const previousMessages = queryClient.getQueryData<InfiniteMessagesCache>([
        "chat-messages",
        roomId,
      ]);

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
                  ? { ...m, is_deleted: true, deleted_at: new Date().toISOString() }
                  : m
              ),
            })),
          };
        }
      );

      return { previousMessages };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(chatKeys.messages(roomId), context.previousMessages);
      }
      showError("메시지 삭제에 실패했습니다. 다시 시도해주세요.");
    },
  });

  // 리액션 토글 (낙관적 업데이트, Browser RPC)
  const reactionMutation = useMutation({
    mutationFn: async ({
      messageId,
      emoji,
    }: {
      messageId: string;
      emoji: ReactionEmoji;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("toggle_chat_reaction", {
        p_message_id: messageId,
        p_emoji: emoji,
      });
      if (error) throw new Error(error.message);
      return data as { added: boolean };
    },
    onMutate: async ({ messageId, emoji }) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(roomId) });
      const previousMessages = queryClient.getQueryData<InfiniteMessagesCache>([
        "chat-messages",
        roomId,
      ]);

      let isAdd = true;
      if (previousMessages?.pages) {
        for (const page of previousMessages.pages) {
          const msg = page.messages.find((m) => m.id === messageId);
          if (msg?.reactions) {
            const reaction = msg.reactions.find((r) => r.emoji === emoji);
            if (reaction?.hasReacted) isAdd = false;
            break;
          }
        }
      }

      operationTracker.startReaction(messageId, emoji, isAdd, roomId);

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
                const existingIdx = existingReactions.findIndex((r) => r.emoji === emoji);

                if (existingIdx >= 0) {
                  const reaction = existingReactions[existingIdx];
                  if (reaction.hasReacted) {
                    const newCount = reaction.count - 1;
                    if (newCount <= 0) {
                      return { ...m, reactions: existingReactions.filter((_, i) => i !== existingIdx) };
                    }
                    const updated = [...existingReactions];
                    updated[existingIdx] = { ...reaction, count: newCount, hasReacted: false };
                    return { ...m, reactions: updated };
                  } else {
                    const updated = [...existingReactions];
                    updated[existingIdx] = { ...reaction, count: reaction.count + 1, hasReacted: true };
                    return { ...m, reactions: updated };
                  }
                } else {
                  return { ...m, reactions: [...existingReactions, { emoji, count: 1, hasReacted: true }] };
                }
              }),
            })),
          };
        }
      );

      return { previousMessages };
    },
    onSuccess: (_data, variables) => {
      operationTracker.completeReaction(variables.messageId, variables.emoji);
    },
    onError: (_err, variables, context) => {
      operationTracker.completeReaction(variables.messageId, variables.emoji);
      if (context?.previousMessages) {
        queryClient.setQueryData(chatKeys.messages(roomId), context.previousMessages);
      }
    },
  });

  // 메시지 고정/해제 (Browser RPC)
  const pinMutation = useMutation({
    mutationFn: async ({
      messageId,
      isPinned,
    }: {
      messageId: string;
      isPinned: boolean;
    }) => {
      const supabase = createSupabaseBrowserClient();
      if (isPinned) {
        const { error } = await supabase.rpc("unpin_chat_message", {
          p_room_id: roomId,
          p_message_id: messageId,
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.rpc("pin_chat_message", {
          p_room_id: roomId,
          p_message_id: messageId,
        });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.pinned(roomId) });
      debouncedInvalidateMessages();
    },
    onError: (error) => {
      showError("메시지 고정에 실패했습니다.");
      console.error("[useChatMutations] Pin error:", error);
    },
  });

  // 공지 설정/삭제 (Browser RPC)
  const announcementMutation = useMutation({
    mutationFn: async (content: string | null) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("set_chat_announcement", {
        p_room_id: roomId,
        p_content: content ?? undefined,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.announcement(roomId) });
    },
    onError: (error) => {
      showError("공지 설정에 실패했습니다.");
      console.error("[useChatMutations] Announcement error:", error);
    },
  });

  // ============================================
  // Actions
  // ============================================

  const sendMessage = useCallback(
    (content: string, replyToId?: string | null, mentions?: MentionInfo[]) => {
      const clientMessageId = generateUUID();

      if (!isOnline()) {
        const now = new Date().toISOString();
        const currentMember = roomDataMembers?.find((m) => m.user_id === userId);
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
        const attachmentResults = completedAttachments.map((f) => f.result!).filter(Boolean);

        const now = new Date().toISOString();
        const currentMember = roomDataMembers?.find((m) => m.user_id === userId);
        const senderName = currentMember?.user?.name ?? "나";
        const senderProfileUrl = currentMember?.user?.profileImageUrl ?? null;
        const senderType = currentMember?.user?.type ?? ("student" as const);

        const hasText = content.trim().length > 0;
        const allImages = attachmentResults.every((a) => a.attachment_type === "image");
        const messageType = hasText ? "mixed" : allImages ? "image" : "file";
        const messageContent = hasText ? content : " ";

        operationTracker.startSend(clientMessageId, messageContent, roomId);

        const activeOtherMembers = (roomDataMembers ?? []).filter(
          (m) => m.user_id !== userId && !m.left_at
        ).length;

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
          readCount: activeOtherMembers > 0 ? activeOtherMembers : undefined,
          sender_name: senderName,
          sender_profile_url: senderProfileUrl,
          attachments: attachmentResults,
          metadata: null,
        };

        queryClient.setQueryData<InfiniteMessagesCache>(
          chatKeys.messages(roomId),
          (old) => addMessageToFirstPage(old, optimisticMessage)
        );

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
          console.warn("[useChatMutations] broadcastInsert failed for attachment message");
        }

        // Preview URL 메모리 해제 후 상태 초기화
        setUploadingFiles((prev) => {
          for (const f of prev) {
            if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
          }
          return [];
        });
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
    [sendMutation, roomId, userId, roomDataMembers, queryClient, onNewMessageArrived, replyTarget, uploadingFiles, setUploadingFiles, showError, broadcastInsert, setReplyTarget]
  );

  const throttledEdit = useThrottledCallback(
    (...args: unknown[]) => {
      const [messageId, content, expectedUpdatedAt] = args as [string, string, string?];
      editMutation.mutate({ messageId, content, expectedUpdatedAt });
    },
    500,
    { leading: true, trailing: false }
  );
  const editMessage = useCallback(
    (messageId: string, content: string, expectedUpdatedAt?: string) => {
      throttledEdit(messageId, content, expectedUpdatedAt);
    },
    [throttledEdit]
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      deleteMutation.mutate(messageId);
    },
    [deleteMutation]
  );

  const throttledToggleReaction = useThrottledCallback(
    (...args: unknown[]) => {
      const [messageId, emoji] = args as [string, ReactionEmoji];
      reactionMutation.mutate({ messageId, emoji });
    },
    300,
    { leading: true, trailing: false }
  );
  const toggleReaction = useCallback(
    (messageId: string, emoji: ReactionEmoji) => {
      throttledToggleReaction(messageId, emoji);
    },
    [throttledToggleReaction]
  );

  const togglePin = useCallback(
    (messageId: string, isPinned: boolean) => {
      pinMutation.mutate({ messageId, isPinned });
    },
    [pinMutation]
  );

  const setAnnouncement = useCallback(
    (content: string | null) => {
      announcementMutation.mutate(content);
    },
    [announcementMutation]
  );

  // 메시지 재전송 핸들러 (원래 위치 유지, 카카오톡 스타일)
  const retryMessage = useCallback(
    (message: ChatMessageWithGrouping) => {
      const messageId = message.id;

      queryClient.setQueryData<InfiniteMessagesCache>(
        chatKeys.messages(roomId),
        (old) => updateMessageInCache(old, messageId, (m) => ({ ...m, status: "sending" }))
      );

      operationTracker.startSend(messageId, message.content, roomId);

      const replyToId = (message as { reply_to_id?: string | null }).reply_to_id;
      const supabase = createSupabaseBrowserClient();
      Promise.resolve(
        supabase.rpc("send_chat_message", {
          p_room_id: roomId,
          p_content: message.content,
          p_reply_to_id: replyToId ?? undefined,
          p_client_message_id: messageId,
        })
      )
        .then(({ data, error }) => {
          if (error) throw new Error(error.message);
          const msg = data as { id: string };
          operationTracker.completeSend(messageId, msg.id);
          const updated = queryClient.setQueryData<InfiniteMessagesCache>(
            chatKeys.messages(roomId),
            (old) => replaceMessageInFirstPage(old, messageId, msg)
          );
          if (!findMessageInCache(updated, msg.id)) {
            debouncedInvalidateMessages();
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
    [roomId, queryClient, debouncedInvalidateMessages]
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

  return {
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    togglePin,
    setAnnouncement,
    retryMessage,
    removeFailedMessage,
    isSending: sendMutation.isPending,
    isEditing: editMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
