/**
 * 메시지 Repository
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateCursor, CHAT_MESSAGE_COLUMNS } from "./_shared";
import type {
  ChatMessage,
  ChatMessageInsert,
  GetMessagesOptions,
  SearchMessagesOptions,
  ChatUserType,
} from "../types";

/**
 * 채팅방의 메시지 목록 조회 (페이지네이션)
 */
export async function findMessagesByRoom(
  options: GetMessagesOptions & { visibleFrom?: string }
): Promise<ChatMessage[]> {
  const { roomId, limit: rawLimit = 50, before, visibleFrom } = options;
  const limit = Math.min(rawLimit, 100);
  const supabase = await createSupabaseServerClient();

  // 커서 유효성 검증
  const validatedBefore = validateCursor(before);

  let query = supabase
    .from("chat_messages")
    .select(CHAT_MESSAGE_COLUMNS)
    .eq("room_id", roomId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (validatedBefore) {
    query = query.lt("created_at", validatedBefore);
  }

  // visible_from 필터: 멤버의 가시 시작 시점 이후 메시지만
  if (visibleFrom) {
    query = query.gte("created_at", visibleFrom);
  }

  const { data, error } = await query;

  if (error) throw error;

  // 오래된 순으로 반환 (UI에서 역순 표시)
  return ((data as ChatMessage[]) ?? []).reverse();
}

/**
 * 여러 채팅방의 마지막 메시지 배치 조회 (N+1 최적화)
 * RPC 함수 사용: DISTINCT ON (room_id) ORDER BY created_at DESC
 */
export async function findLastMessagesByRoomIds(
  roomIds: string[]
): Promise<Map<string, ChatMessage>> {
  if (roomIds.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();

  // RPC 함수 호출 (DISTINCT ON 사용으로 DB에서 직접 처리)
  const { data, error } = await supabase.rpc("get_last_messages_by_room_ids", {
    p_room_ids: roomIds,
  });

  if (error) throw error;

  // room_id별로 매핑
  const result = new Map<string, ChatMessage>();
  for (const message of (data as ChatMessage[]) ?? []) {
    result.set(message.room_id, message);
  }

  return result;
}

/**
 * 여러 채팅방의 안 읽은 메시지 수 배치 조회 (N+1 최적화)
 * RPC 함수 사용: DB에서 직접 집계하여 성능 최적화
 */
export async function countUnreadByRoomIds(
  roomIds: string[],
  userId: string,
  membershipMap: Map<string, { last_read_at: string }>
): Promise<Map<string, number>> {
  if (roomIds.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();

  // membershipMap을 JSON 객체로 변환
  const membershipData: Record<string, string> = {};
  for (const [roomId, membership] of membershipMap) {
    membershipData[roomId] = membership.last_read_at;
  }

  // RPC 함수 호출 (DB에서 직접 집계)
  const { data, error } = await supabase.rpc("count_unread_by_room_ids", {
    p_room_ids: roomIds,
    p_user_id: userId,
    p_membership_data: membershipData,
  });

  if (error) throw error;

  // 결과 매핑 (unread가 없는 방은 0으로 초기화)
  const result = new Map<string, number>();
  for (const roomId of roomIds) {
    result.set(roomId, 0);
  }

  for (const row of (data as Array<{ room_id: string; unread_count: number }>) ?? []) {
    result.set(row.room_id, row.unread_count);
  }

  return result;
}

/**
 * 메시지 생성
 */
export async function insertMessage(
  input: ChatMessageInsert
): Promise<ChatMessage> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_messages")
    .insert(input)
    .select(CHAT_MESSAGE_COLUMNS)
    .single();

  if (error) throw error;

  // chat_rooms.updated_at은 DB 트리거가 자동으로 갱신
  return data as ChatMessage;
}

/**
 * 메시지 삭제 (soft delete)
 */
export async function deleteMessage(
  messageId: string,
  senderId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("chat_messages")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .eq("sender_id", senderId);

  if (error) throw error;
}

/**
 * 안 읽은 메시지 수 계산
 */
export async function countUnreadMessages(
  roomId: string,
  userId: string,
  _userType: ChatUserType,
  lastReadAt: string
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const { count, error } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .neq("sender_id", userId)
    .eq("is_deleted", false)
    .gt("created_at", lastReadAt);

  if (error) throw error;

  return count ?? 0;
}

/**
 * 메시지 ID로 단일 메시지 조회
 */
export async function findMessageById(
  messageId: string
): Promise<ChatMessage | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_messages")
    .select(CHAT_MESSAGE_COLUMNS)
    .eq("id", messageId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;

  return data as ChatMessage | null;
}

/**
 * 메시지 내용 수정
 *
 * @param messageId 메시지 ID
 * @param content 새 내용
 * @param expectedUpdatedAt 낙관적 잠금용 - 편집 시작 시점의 updated_at 값
 * @returns 수정된 메시지 또는 충돌 시 null
 */
export async function updateMessageContent(
  messageId: string,
  content: string,
  expectedUpdatedAt?: string
): Promise<ChatMessage | null> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("chat_messages")
    .update({ content })
    .eq("id", messageId);

  // 낙관적 잠금: expectedUpdatedAt가 제공되면 충돌 감지
  if (expectedUpdatedAt) {
    query = query.eq("updated_at", expectedUpdatedAt);
  }

  const { data, error } = await query.select(CHAT_MESSAGE_COLUMNS).single();

  // 충돌 감지: 조건에 맞는 row가 없으면 null 반환
  if (error?.code === "PGRST116") {
    return null;
  }

  if (error) throw error;

  return data as ChatMessage;
}

/**
 * 채팅방 내 메시지 검색 (ILIKE 기반)
 */
export async function searchMessagesByRoom(
  options: SearchMessagesOptions & { visibleFrom?: string }
): Promise<{ messages: ChatMessage[]; total: number }> {
  const { roomId, query, limit: rawLimit = 20, offset = 0, visibleFrom } = options;
  const limit = Math.min(rawLimit, 100);
  const supabase = await createSupabaseServerClient();

  // 검색어 이스케이프 (SQL 와일드카드 처리)
  const escapedQuery = query.replace(/[%_]/g, "\\$&");

  let dbQuery = supabase
    .from("chat_messages")
    .select(CHAT_MESSAGE_COLUMNS, { count: "exact" })
    .eq("room_id", roomId)
    .eq("is_deleted", false)
    .ilike("content", `%${escapedQuery}%`)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // visible_from 필터
  if (visibleFrom) {
    dbQuery = dbQuery.gte("created_at", visibleFrom);
  }

  const { data, error, count } = await dbQuery;

  if (error) throw error;

  return {
    messages: (data as ChatMessage[]) ?? [],
    total: count ?? 0,
  };
}

/**
 * 메시지 목록과 각 메시지의 읽음 상태를 함께 조회
 * 본인 메시지에 대해서만 안 읽은 멤버 수 계산
 *
 * 최적화: SQL RPC 함수로 계산하여 O(m×u) → O(1) 쿼리
 */
export async function findMessagesWithReadCounts(
  options: GetMessagesOptions & { visibleFrom?: string },
  currentUserId: string
): Promise<{ messages: ChatMessage[]; readCounts: Record<string, number> }> {
  const supabase = await createSupabaseServerClient();
  const messages = await findMessagesByRoom(options);

  if (messages.length === 0) {
    return { messages, readCounts: {} };
  }

  // 본인 메시지 ID만 추출 (읽음 상태 계산 대상)
  const myMessageIds = messages
    .filter((m) => m.sender_id === currentUserId)
    .map((m) => m.id);

  const readCounts: Record<string, number> = {};

  // 본인 메시지가 있는 경우에만 RPC 호출
  if (myMessageIds.length > 0) {
    const { data, error } = await supabase.rpc("get_message_read_counts", {
      p_room_id: options.roomId,
      p_message_ids: myMessageIds,
      p_sender_id: currentUserId,
    });

    if (error) {
      console.error("[findMessagesWithReadCounts] RPC error:", error);
      // RPC 실패 시 0으로 fallback (기능은 유지하되 성능만 저하)
    } else if (data) {
      // RPC 결과를 Record로 변환
      for (const row of data as Array<{ message_id: string; unread_count: number }>) {
        readCounts[row.message_id] = row.unread_count;
      }
    }
  }

  // 타인 메시지는 0, 본인 메시지는 RPC 결과 또는 0
  for (const msg of messages) {
    if (!(msg.id in readCounts)) {
      readCounts[msg.id] = 0;
    }
  }

  return { messages, readCounts };
}

/**
 * 답장 원본 메시지 배치 조회 (N+1 최적화)
 * 여러 메시지의 원본 메시지를 한 번에 조회
 * sender_name 스냅샷 포함으로 추가 쿼리 불필요
 */
type ReplyTargetRow = {
  id: string;
  content: string;
  sender_id: string;
  sender_type: ChatUserType;
  is_deleted: boolean;
  sender_name: string;
  message_type: string;
};

export async function findReplyTargetsByIds(
  replyToIds: string[]
): Promise<Map<string, ReplyTargetRow>> {
  if (replyToIds.length === 0) return new Map();

  // 배열 길이 제한 (과도한 .in() 쿼리 방지)
  const ids = replyToIds.slice(0, 200);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, content, sender_id, sender_type, is_deleted, sender_name, message_type")
    .in("id", ids);

  if (error) throw error;

  const result = new Map<string, ReplyTargetRow>();
  for (const msg of (data ?? []) as ReplyTargetRow[]) {
    result.set(msg.id, msg);
  }
  return result;
}

/**
 * 특정 시점 이후의 메시지 조회 (점진적 동기화용)
 * 재연결 시 마지막 동기화 시점 이후의 메시지만 가져옴
 */
export async function findMessagesSince(
  roomId: string,
  since: string,
  limit: number = 100
): Promise<ChatMessage[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_chat_messages_since", {
    p_room_id: roomId,
    p_since: since,
    p_limit: limit,
  });

  if (error) throw error;

  return (data as ChatMessage[]) ?? [];
}
