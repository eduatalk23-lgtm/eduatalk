/**
 * Chat 도메인 Repository
 * 채팅 데이터 접근 레이어
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ChatRoom,
  ChatRoomInsert,
  ChatRoomUpdate,
  ChatRoomMember,
  ChatRoomMemberInsert,
  ChatRoomMemberUpdate,
  ChatMessage,
  ChatMessageInsert,
  ChatBlock,
  ChatBlockInsert,
  ChatReport,
  ChatReportInsert,
  ChatReportUpdate,
  GetMessagesOptions,
  GetRoomsOptions,
  ChatUserType,
  SearchMessagesOptions,
  MessageReaction,
  ReactionEmoji,
  PinnedMessage,
  PinnedMessageInsert,
} from "./types";

// ============================================
// 컬럼 정의
// ============================================

const CHAT_ROOM_COLUMNS = `
  id,
  tenant_id,
  type,
  name,
  created_by,
  created_by_type,
  is_active,
  announcement,
  announcement_by,
  announcement_by_type,
  announcement_at,
  created_at,
  updated_at
` as const;

const CHAT_MEMBER_COLUMNS = `
  id,
  room_id,
  user_id,
  user_type,
  role,
  last_read_at,
  is_muted,
  left_at,
  created_at,
  updated_at
` as const;

const CHAT_MESSAGE_COLUMNS = `
  id,
  room_id,
  sender_id,
  sender_type,
  message_type,
  content,
  reply_to_id,
  is_deleted,
  deleted_at,
  created_at,
  updated_at
` as const;

const CHAT_REACTION_COLUMNS = `
  id,
  message_id,
  user_id,
  user_type,
  emoji,
  created_at
` as const;

// ============================================
// 채팅방 Repository
// ============================================

/**
 * 채팅방 ID로 조회
 */
export async function findRoomById(
  roomId: string
): Promise<ChatRoom | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_rooms")
    .select(CHAT_ROOM_COLUMNS)
    .eq("id", roomId)
    .eq("is_active", true)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data as ChatRoom | null;
}

/**
 * 사용자의 채팅방 목록 조회 (최신순)
 */
export async function findRoomsByUser(
  userId: string,
  userType: ChatUserType,
  options: GetRoomsOptions = {}
): Promise<ChatRoom[]> {
  const { limit = 20, offset = 0 } = options;
  const supabase = await createSupabaseServerClient();

  // 멤버로 참여 중인 방 ID 목록 조회
  const { data: memberData, error: memberError } = await supabase
    .from("chat_room_members")
    .select("room_id")
    .eq("user_id", userId)
    .eq("user_type", userType)
    .is("left_at", null);

  if (memberError) throw memberError;
  if (!memberData || memberData.length === 0) return [];

  const roomIds = memberData.map((m) => m.room_id);

  // 채팅방 정보 조회
  const { data, error } = await supabase
    .from("chat_rooms")
    .select(CHAT_ROOM_COLUMNS)
    .in("id", roomIds)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return (data as ChatRoom[]) ?? [];
}

/**
 * 두 사용자 간의 1:1 채팅방 찾기
 */
export async function findDirectRoom(
  user1Id: string,
  user1Type: ChatUserType,
  user2Id: string,
  user2Type: ChatUserType
): Promise<ChatRoom | null> {
  const supabase = await createSupabaseServerClient();

  // user1이 속한 direct 방 조회
  const { data: user1Rooms, error: error1 } = await supabase
    .from("chat_room_members")
    .select("room_id")
    .eq("user_id", user1Id)
    .eq("user_type", user1Type)
    .is("left_at", null);

  if (error1) throw error1;
  if (!user1Rooms || user1Rooms.length === 0) return null;

  const roomIds = user1Rooms.map((r) => r.room_id);

  // user2도 속한 direct 방 찾기
  const { data: matchingRoom, error: error2 } = await supabase
    .from("chat_rooms")
    .select(CHAT_ROOM_COLUMNS)
    .in("id", roomIds)
    .eq("type", "direct")
    .eq("is_active", true)
    .maybeSingle();

  if (error2 && error2.code !== "PGRST116") throw error2;
  if (!matchingRoom) return null;

  // user2가 해당 방의 멤버인지 확인
  const { data: user2Member, error: error3 } = await supabase
    .from("chat_room_members")
    .select("id")
    .eq("room_id", matchingRoom.id)
    .eq("user_id", user2Id)
    .eq("user_type", user2Type)
    .is("left_at", null)
    .maybeSingle();

  if (error3 && error3.code !== "PGRST116") throw error3;

  return user2Member ? (matchingRoom as ChatRoom) : null;
}

/**
 * 채팅방 생성
 */
export async function insertRoom(
  input: ChatRoomInsert
): Promise<ChatRoom> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_rooms")
    .insert(input)
    .select(CHAT_ROOM_COLUMNS)
    .single();

  if (error) throw error;

  return data as ChatRoom;
}

/**
 * 채팅방 수정
 */
export async function updateRoom(
  roomId: string,
  input: ChatRoomUpdate
): Promise<ChatRoom> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_rooms")
    .update(input)
    .eq("id", roomId)
    .select(CHAT_ROOM_COLUMNS)
    .single();

  if (error) throw error;

  return data as ChatRoom;
}

// ============================================
// 채팅방 멤버 Repository
// ============================================

/**
 * 채팅방의 멤버 목록 조회
 * RLS 정책 우회를 위해 Admin Client 사용
 * (같은 방의 다른 멤버 조회 허용)
 */
export async function findMembersByRoom(
  roomId: string
): Promise<ChatRoomMember[]> {
  // Admin client 사용 (RLS 우회 - 같은 방 멤버 조회 허용)
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Admin client initialization failed");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("chat_room_members")
    .select(CHAT_MEMBER_COLUMNS)
    .eq("room_id", roomId)
    .is("left_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data as ChatRoomMember[]) ?? [];
}

/**
 * 여러 채팅방의 멤버 목록 배치 조회 (N+1 최적화)
 */
export async function findMembersByRoomIds(
  roomIds: string[]
): Promise<Map<string, ChatRoomMember[]>> {
  if (roomIds.length === 0) return new Map();

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Admin client initialization failed");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("chat_room_members")
    .select(CHAT_MEMBER_COLUMNS)
    .in("room_id", roomIds)
    .is("left_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;

  // room_id별로 그룹핑
  const result = new Map<string, ChatRoomMember[]>();
  for (const member of (data as ChatRoomMember[]) ?? []) {
    const existing = result.get(member.room_id) ?? [];
    existing.push(member);
    result.set(member.room_id, existing);
  }

  return result;
}

/**
 * 특정 멤버 조회
 */
export async function findMember(
  roomId: string,
  userId: string,
  userType: ChatUserType
): Promise<ChatRoomMember | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_room_members")
    .select(CHAT_MEMBER_COLUMNS)
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("user_type", userType)
    .is("left_at", null)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;

  return data as ChatRoomMember | null;
}

/**
 * 멤버 추가
 */
export async function insertMember(
  input: ChatRoomMemberInsert
): Promise<ChatRoomMember> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_room_members")
    .insert(input)
    .select(CHAT_MEMBER_COLUMNS)
    .single();

  if (error) throw error;

  return data as ChatRoomMember;
}

/**
 * 멤버 정보 수정
 */
export async function updateMember(
  roomId: string,
  userId: string,
  userType: ChatUserType,
  input: ChatRoomMemberUpdate
): Promise<ChatRoomMember> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_room_members")
    .update(input)
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("user_type", userType)
    .select(CHAT_MEMBER_COLUMNS)
    .single();

  if (error) throw error;

  return data as ChatRoomMember;
}

/**
 * 읽음 처리 (last_read_at 업데이트)
 */
export async function markAsRead(
  roomId: string,
  userId: string,
  userType: ChatUserType
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("chat_room_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("user_type", userType);

  if (error) throw error;
}

// ============================================
// 메시지 Repository
// ============================================

/**
 * 채팅방의 메시지 목록 조회 (페이지네이션)
 */
export async function findMessagesByRoom(
  options: GetMessagesOptions
): Promise<ChatMessage[]> {
  const { roomId, limit = 50, before } = options;
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("chat_messages")
    .select(CHAT_MESSAGE_COLUMNS)
    .eq("room_id", roomId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;

  if (error) throw error;

  // 오래된 순으로 반환 (UI에서 역순 표시)
  return ((data as ChatMessage[]) ?? []).reverse();
}

/**
 * 여러 채팅방의 마지막 메시지 배치 조회 (N+1 최적화)
 * SQL: DISTINCT ON (room_id) ORDER BY created_at DESC
 */
export async function findLastMessagesByRoomIds(
  roomIds: string[]
): Promise<Map<string, ChatMessage>> {
  if (roomIds.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();

  // Supabase는 DISTINCT ON을 직접 지원하지 않으므로
  // 각 room의 최신 메시지를 위해 RPC나 서브쿼리 대신
  // 전체 조회 후 JS에서 처리 (room 수가 적을 때 효율적)
  const { data, error } = await supabase
    .from("chat_messages")
    .select(CHAT_MESSAGE_COLUMNS)
    .in("room_id", roomIds)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // room_id별 첫 번째(최신) 메시지만 추출
  const result = new Map<string, ChatMessage>();
  for (const message of (data as ChatMessage[]) ?? []) {
    if (!result.has(message.room_id)) {
      result.set(message.room_id, message);
    }
  }

  return result;
}

/**
 * 여러 채팅방의 안 읽은 메시지 수 배치 조회 (N+1 최적화)
 */
export async function countUnreadByRoomIds(
  roomIds: string[],
  userId: string,
  membershipMap: Map<string, { last_read_at: string }>
): Promise<Map<string, number>> {
  if (roomIds.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();

  // 각 방의 last_read_at 이후 메시지 수를 계산
  // 효율성을 위해 한 쿼리로 모든 메시지 조회 후 JS에서 카운트
  const { data, error } = await supabase
    .from("chat_messages")
    .select("room_id, sender_id, created_at")
    .in("room_id", roomIds)
    .neq("sender_id", userId)
    .eq("is_deleted", false);

  if (error) throw error;

  const result = new Map<string, number>();
  for (const roomId of roomIds) {
    result.set(roomId, 0);
  }

  for (const msg of data ?? []) {
    const membership = membershipMap.get(msg.room_id);
    if (membership && msg.created_at > membership.last_read_at) {
      result.set(msg.room_id, (result.get(msg.room_id) ?? 0) + 1);
    }
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

  // 채팅방 updated_at 갱신
  await supabase
    .from("chat_rooms")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.room_id);

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
 * 발신자 정보 배치 조회 (N+1 쿼리 최적화)
 * sender_id + sender_type 조합으로 한 번에 조회
 */
export async function findSendersByIds(
  senderKeys: Array<{ id: string; type: ChatUserType }>
): Promise<Map<string, { id: string; name: string; profileImageUrl?: string | null }>> {
  if (senderKeys.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();

  // 중복 제거
  const uniqueKeys = Array.from(
    new Map(senderKeys.map((k) => [`${k.id}_${k.type}`, k])).values()
  );

  // student와 admin 분리
  const studentIds = uniqueKeys.filter((k) => k.type === "student").map((k) => k.id);
  const adminIds = uniqueKeys.filter((k) => k.type === "admin").map((k) => k.id);

  const result = new Map<string, { id: string; name: string; profileImageUrl?: string | null }>();

  // 학생 정보 배치 조회
  if (studentIds.length > 0) {
    const { data: students } = await supabase
      .from("students")
      .select("id, name")
      .in("id", studentIds);

    // 프로필 이미지 배치 조회
    const { data: profiles } = await supabase
      .from("student_profiles")
      .select("id, profile_image_url")
      .in("id", studentIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p.profile_image_url]) ?? []);

    students?.forEach((s) => {
      result.set(`${s.id}_student`, {
        id: s.id,
        name: s.name,
        profileImageUrl: profileMap.get(s.id) ?? null,
      });
    });
  }

  // 관리자 정보 배치 조회
  if (adminIds.length > 0) {
    const { data: admins } = await supabase
      .from("admin_users")
      .select("id, name")
      .in("id", adminIds);

    admins?.forEach((a) => {
      result.set(`${a.id}_admin`, {
        id: a.id,
        name: a.name ?? "관리자",
        profileImageUrl: null,
      });
    });
  }

  return result;
}

/**
 * 안 읽은 메시지 수 계산
 */
export async function countUnreadMessages(
  roomId: string,
  userId: string,
  userType: ChatUserType,
  lastReadAt: string
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const { count, error } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId)
    .neq("sender_id", userId)
    .eq("is_deleted", false)
    .gt("created_at", lastReadAt);

  if (error) throw error;

  return count ?? 0;
}

// ============================================
// 차단 Repository
// ============================================

/**
 * 차단 목록 조회
 */
export async function findBlocksByUser(
  userId: string,
  userType: ChatUserType
): Promise<ChatBlock[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_blocks")
    .select("*")
    .eq("blocker_id", userId)
    .eq("blocker_type", userType);

  if (error) throw error;

  return (data as ChatBlock[]) ?? [];
}

/**
 * 차단 여부 확인
 */
export async function isBlocked(
  blockerId: string,
  blockerType: ChatUserType,
  blockedId: string,
  blockedType: ChatUserType
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_blocks")
    .select("id")
    .eq("blocker_id", blockerId)
    .eq("blocker_type", blockerType)
    .eq("blocked_id", blockedId)
    .eq("blocked_type", blockedType)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;

  return !!data;
}

/**
 * 차단 추가
 */
export async function insertBlock(
  input: ChatBlockInsert
): Promise<ChatBlock> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_blocks")
    .insert(input)
    .select("*")
    .single();

  if (error) throw error;

  return data as ChatBlock;
}

/**
 * 차단 해제
 */
export async function deleteBlock(
  blockerId: string,
  blockerType: ChatUserType,
  blockedId: string,
  blockedType: ChatUserType
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("chat_blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocker_type", blockerType)
    .eq("blocked_id", blockedId)
    .eq("blocked_type", blockedType);

  if (error) throw error;
}

// ============================================
// 신고 Repository
// ============================================

/**
 * 신고 생성
 */
export async function insertReport(
  input: ChatReportInsert
): Promise<ChatReport> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_reports")
    .insert(input)
    .select("*")
    .single();

  if (error) throw error;

  return data as ChatReport;
}

/**
 * 대기 중인 신고 목록 조회 (관리자용)
 */
export async function findPendingReports(
  limit = 50
): Promise<ChatReport[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_reports")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return (data as ChatReport[]) ?? [];
}

/**
 * 신고 상태 업데이트 (관리자용)
 */
export async function updateReport(
  reportId: string,
  input: ChatReportUpdate
): Promise<ChatReport> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_reports")
    .update(input)
    .eq("id", reportId)
    .select("*")
    .single();

  if (error) throw error;

  return data as ChatReport;
}

/**
 * 모든 신고 목록 조회 (관리자용, 필터 지원)
 */
export async function findAllReports(
  filters?: { status?: string; reason?: string },
  limit = 100
): Promise<ChatReport[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("chat_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  // 상태 필터
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  // 사유 필터
  if (filters?.reason && filters.reason !== "all") {
    query = query.eq("reason", filters.reason);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data as ChatReport[]) ?? [];
}

/**
 * 신고 ID로 조회
 */
export async function findReportById(
  reportId: string
): Promise<ChatReport | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;

  return data as ChatReport | null;
}

/**
 * 메시지 ID로 단일 메시지 조회 (신고된 메시지 상세용)
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

// ============================================
// 메시지 편집 Repository
// ============================================

/**
 * 메시지 내용 수정
 */
export async function updateMessageContent(
  messageId: string,
  content: string
): Promise<ChatMessage> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_messages")
    .update({ content })
    .eq("id", messageId)
    .select(CHAT_MESSAGE_COLUMNS)
    .single();

  if (error) throw error;

  return data as ChatMessage;
}

// ============================================
// 메시지 검색 Repository
// ============================================

/**
 * 채팅방 내 메시지 검색 (ILIKE 기반)
 */
export async function searchMessagesByRoom(
  options: SearchMessagesOptions
): Promise<{ messages: ChatMessage[]; total: number }> {
  const { roomId, query, limit = 20, offset = 0 } = options;
  const supabase = await createSupabaseServerClient();

  // 검색어 이스케이프 (SQL 와일드카드 처리)
  const escapedQuery = query.replace(/[%_]/g, "\\$&");

  const { data, error, count } = await supabase
    .from("chat_messages")
    .select(CHAT_MESSAGE_COLUMNS, { count: "exact" })
    .eq("room_id", roomId)
    .eq("is_deleted", false)
    .ilike("content", `%${escapedQuery}%`)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    messages: (data as ChatMessage[]) ?? [],
    total: count ?? 0,
  };
}

// ============================================
// 읽음 표시 Repository
// ============================================

/**
 * 채팅방의 활성 멤버 목록과 last_read_at 조회 (읽음 상태 계산용)
 */
export async function findActiveMembersWithReadStatus(
  roomId: string
): Promise<Array<{ user_id: string; user_type: ChatUserType; last_read_at: string }>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Admin client initialization failed");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("chat_room_members")
    .select("user_id, user_type, last_read_at")
    .eq("room_id", roomId)
    .is("left_at", null);

  if (error) throw error;

  return (data ?? []) as Array<{ user_id: string; user_type: ChatUserType; last_read_at: string }>;
}

/**
 * 메시지 목록과 각 메시지의 읽음 상태를 함께 조회
 * 본인 메시지에 대해서만 안 읽은 멤버 수 계산
 */
export async function findMessagesWithReadCounts(
  options: GetMessagesOptions,
  currentUserId: string
): Promise<{ messages: ChatMessage[]; readCounts: Record<string, number> }> {
  const messages = await findMessagesByRoom(options);

  // 방 멤버들의 last_read_at 조회
  const members = await findActiveMembersWithReadStatus(options.roomId);

  const readCounts: Record<string, number> = {};

  // 각 메시지에 대해 안 읽은 멤버 수 계산 (본인 메시지만)
  for (const msg of messages) {
    if (msg.sender_id === currentUserId) {
      // 메시지 시간 이후에 읽지 않은 멤버 수 (발신자 제외)
      const unreadCount = members.filter(
        (m) =>
          m.user_id !== msg.sender_id &&
          new Date(m.last_read_at) < new Date(msg.created_at)
      ).length;

      readCounts[msg.id] = unreadCount;
    } else {
      readCounts[msg.id] = 0;
    }
  }

  return { messages, readCounts };
}

// ============================================
// 리액션 Repository
// ============================================

/**
 * 리액션 추가
 */
export async function insertReaction(input: {
  messageId: string;
  userId: string;
  userType: ChatUserType;
  emoji: ReactionEmoji;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("chat_message_reactions").insert({
    message_id: input.messageId,
    user_id: input.userId,
    user_type: input.userType,
    emoji: input.emoji,
  });

  if (error) throw error;
}

/**
 * 리액션 삭제
 */
export async function deleteReaction(input: {
  messageId: string;
  userId: string;
  userType: ChatUserType;
  emoji: ReactionEmoji;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("chat_message_reactions")
    .delete()
    .eq("message_id", input.messageId)
    .eq("user_id", input.userId)
    .eq("user_type", input.userType)
    .eq("emoji", input.emoji);

  if (error) throw error;
}

/**
 * 리액션 존재 확인 (토글용)
 */
export async function hasReaction(input: {
  messageId: string;
  userId: string;
  userType: ChatUserType;
  emoji: ReactionEmoji;
}): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("chat_message_reactions")
    .select("id")
    .eq("message_id", input.messageId)
    .eq("user_id", input.userId)
    .eq("user_type", input.userType)
    .eq("emoji", input.emoji)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;

  return !!data;
}

/**
 * 메시지별 리액션 조회 (배치)
 * N+1 쿼리 최적화를 위해 여러 메시지의 리액션을 한 번에 조회
 */
export async function findReactionsByMessageIds(
  messageIds: string[]
): Promise<Map<string, MessageReaction[]>> {
  if (messageIds.length === 0) return new Map();

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Admin client initialization failed");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("chat_message_reactions")
    .select(CHAT_REACTION_COLUMNS)
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });

  if (error) throw error;

  // message_id별로 그룹핑
  const result = new Map<string, MessageReaction[]>();
  for (const reaction of (data as MessageReaction[]) ?? []) {
    const existing = result.get(reaction.message_id) ?? [];
    existing.push(reaction);
    result.set(reaction.message_id, existing);
  }

  return result;
}

// ============================================
// 답장 원본 메시지 Repository
// ============================================

/**
 * 답장 원본 메시지 배치 조회 (N+1 최적화)
 * 여러 메시지의 원본 메시지를 한 번에 조회
 */
export async function findReplyTargetsByIds(
  replyToIds: string[]
): Promise<Map<string, { id: string; content: string; sender_id: string; sender_type: ChatUserType; is_deleted: boolean }>> {
  if (replyToIds.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, content, sender_id, sender_type, is_deleted")
    .in("id", replyToIds);

  if (error) throw error;

  const result = new Map<string, { id: string; content: string; sender_id: string; sender_type: ChatUserType; is_deleted: boolean }>();
  for (const msg of (data ?? []) as Array<{ id: string; content: string; sender_id: string; sender_type: ChatUserType; is_deleted: boolean }>) {
    result.set(msg.id, msg);
  }
  return result;
}

// ============================================
// 고정 메시지 Repository
// ============================================

const PINNED_MESSAGE_COLUMNS = `
  id,
  room_id,
  message_id,
  pinned_by,
  pinned_by_type,
  pin_order,
  created_at
` as const;

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
