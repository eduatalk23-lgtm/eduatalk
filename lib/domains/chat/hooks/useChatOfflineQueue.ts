"use client";

/**
 * useChatOfflineQueue - 오프라인 큐 초기화 및 이벤트 콜백 등록 훅
 *
 * useChatMutations에서 추출된 두 개의 useEffect를 담당합니다:
 * 1. registerMessageSender + initChatQueueProcessor (마운트 시 1회)
 * 2. registerQueueEventCallbacks (roomId / queryClient / showError 변경 시)
 */

import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  registerMessageSender,
  registerQueueEventCallbacks,
  initChatQueueProcessor,
} from "@/lib/offline/chatQueue";
import {
  type InfiniteMessagesCache,
  replaceMessageInFirstPage,
  updateMessageInCache,
} from "@/lib/domains/chat/cacheTypes";
import { chatKeys } from "../queryKeys";

export function useChatOfflineQueue(
  roomId: string,
  queryClient: QueryClient,
  showError: (msg: string) => void
): void {
  // sender 등록 + 큐 프로세서 초기화 (마운트 시 1회)
  useEffect(() => {
    registerMessageSender(async (sendRoomId, content, replyToId, clientMsgId) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("send_chat_message", {
        p_room_id: sendRoomId,
        p_content: content,
        p_reply_to_id: replyToId ?? undefined,
        p_client_message_id: clientMsgId ?? undefined,
      });
      if (error) return { success: false, error: error.message };
      const msg = data as { id: string };
      return { success: true, data: { id: msg.id } };
    });
    const cleanup = initChatQueueProcessor();
    return cleanup;
  }, []);

  // 큐 이벤트 콜백 등록 (roomId / queryClient / showError 변경 시 재등록)
  useEffect(() => {
    registerQueueEventCallbacks({
      onMessageSent: (sentRoomId, clientMessageId, data) => {
        if (sentRoomId !== roomId) return;
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
}
