/**
 * 고정 메시지 + 공지 Repository
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CHAT_ROOM_COLUMNS, PINNED_MESSAGE_COLUMNS } from "./_shared";
import type {
  ChatRoom,
  ChatRoomUpdate,
  PinnedMessage,
  PinnedMessageInsert,
  ChatUserType,
} from "../types";

// ============================================
// 고정 메시지 Repository
// ============================================

/**
 * 채팅방의 고정 메시지 목록 조회 (pin_order 순)
 */
export async function findPinnedMessagesByRoom(
  roomId: string
): Promise<PinnedMessage[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_pinned_messages")
    .select(PINNED_MESSAGE_COLUMNS)
    .eq("room_id", roomId)
    .order("pin_order", { ascending: true });

  if (error) throw error;

  return (data as PinnedMessage[]) ?? [];
}

/**
 * 고정 메시지 추가
 */
export async function insertPinnedMessage(
  input: PinnedMessageInsert
): Promise<PinnedMessage> {
  const supabase = await createSupabaseServerClient();

  // 현재 채팅방의 최대 pin_order 조회
  const { data: existing } = await supabase
    .from("chat_pinned_messages")
    .select("pin_order")
    .eq("room_id", input.room_id)
    .order("pin_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = existing ? existing.pin_order + 1 : 0;

  const { data, error } = await supabase
    .from("chat_pinned_messages")
    .insert({
      ...input,
      pin_order: input.pin_order ?? nextOrder,
    })
    .select(PINNED_MESSAGE_COLUMNS)
    .single();

  if (error) throw error;

  return data as PinnedMessage;
}

/**
 * 고정 메시지 삭제
 */
export async function deletePinnedMessage(
  roomId: string,
  messageId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("chat_pinned_messages")
    .delete()
    .eq("room_id", roomId)
    .eq("message_id", messageId);

  if (error) throw error;
}

/**
 * 메시지가 고정되어 있는지 확인
 */
export async function isPinnedMessage(
  roomId: string,
  messageId: string
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_pinned_messages")
    .select("id")
    .eq("room_id", roomId)
    .eq("message_id", messageId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;

  return !!data;
}

/**
 * 채팅방의 고정 메시지 개수 조회
 */
export async function countPinnedMessages(
  roomId: string
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const { count, error } = await supabase
    .from("chat_pinned_messages")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId);

  if (error) throw error;

  return count ?? 0;
}

// ============================================
// 공지 Repository
// ============================================

/**
 * 채팅방 공지 설정
 * content가 null이면 공지 삭제
 */
export async function setRoomAnnouncement(
  roomId: string,
  userId: string | null,
  userType: ChatUserType | null,
  content: string | null
): Promise<ChatRoom> {
  const supabase = await createSupabaseServerClient();

  const updateData: ChatRoomUpdate = content
    ? {
        announcement: content,
        announcement_by: userId,
        announcement_by_type: userType,
        announcement_at: new Date().toISOString(),
      }
    : {
        announcement: null,
        announcement_by: null,
        announcement_by_type: null,
        announcement_at: null,
      };

  const { data, error } = await supabase
    .from("chat_rooms")
    .update(updateData)
    .eq("id", roomId)
    .select(CHAT_ROOM_COLUMNS)
    .single();

  if (error) throw error;

  return data as ChatRoom;
}
