"use client";

/**
 * 채팅 Realtime 훅 공유 타입
 *
 * useChatRealtime, useChatMessageHandlers 등에서 공유하는 Payload 타입과 옵션 타입.
 */

import type { ChatUserType, ChatUser, ChatMessageType } from "@/lib/domains/chat/types";

// Supabase Realtime Payload 타입 (DB 컬럼과 1:1 매핑)
export interface ChatMessagePayload {
  id: string;
  room_id: string;
  sender_id: string;
  sender_type: ChatUserType;
  message_type: ChatMessageType;
  content: string;
  is_deleted: boolean;
  reply_to_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** 비정규화된 발신자 이름 스냅샷 */
  sender_name: string;
  /** 비정규화된 발신자 프로필 URL 스냅샷 */
  sender_profile_url: string | null;
}

// 리액션 Payload 타입
export interface ChatReactionPayload {
  id: string;
  message_id: string;
  user_id: string;
  user_type: ChatUserType;
  emoji: string;
  created_at: string;
}

export type UseChatRealtimeOptions = {
  /** 채팅방 ID */
  roomId: string;
  /** 현재 사용자 ID (본인 메시지 구분용) */
  userId: string;
  /** 구독 활성화 여부 */
  enabled?: boolean;
  /** 발신자 정보 캐시 (roomData.members에서 구성) */
  senderCache?: Map<string, ChatUser>;
  /** 새 메시지 수신 콜백 */
  onNewMessage?: (message: ChatMessagePayload) => void;
  /** 메시지 삭제 콜백 */
  onMessageDeleted?: (messageId: string) => void;
  /** 읽음 확인 수신 콜백 (상대방이 메시지를 읽었을 때) */
  onReadReceipt?: (readerId: string, readAt: string) => void;
};
