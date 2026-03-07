/**
 * 채팅방 멤버 Repository
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminClientForChat, CHAT_MEMBER_COLUMNS } from "./_shared";
import type {
  ChatRoomMember,
  ChatRoomMemberInsert,
  ChatRoomMemberUpdate,
  ChatUserType,
} from "../types";

/**
 * 채팅방의 멤버 목록 조회
 * RLS 정책 우회를 위해 Admin Client 사용
 * (같은 방의 다른 멤버 조회 허용)
 */
export async function findMembersByRoom(
  roomId: string
): Promise<ChatRoomMember[]> {
  const supabase = getAdminClientForChat();

  const { data, error } = await supabase
    .from("chat_room_members")
    .select(CHAT_MEMBER_COLUMNS)
    .eq("room_id", roomId)
    .is("left_at", null)
    .is("deleted_at", null)
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

  const supabase = getAdminClientForChat();

  const { data, error } = await supabase
    .from("chat_room_members")
    .select(CHAT_MEMBER_COLUMNS)
    .in("room_id", roomIds)
    .is("left_at", null)
    .is("deleted_at", null)
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
    .is("deleted_at", null)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;

  return data as ChatRoomMember | null;
}

/**
 * 특정 멤버 조회 (나간 멤버 포함)
 * Auto-rejoin 기능을 위해 left_at과 관계없이 멤버를 조회
 */
export async function findMemberIncludingLeft(
  roomId: string,
  userId: string,
  userType: ChatUserType
): Promise<ChatRoomMember | null> {
  const supabase = getAdminClientForChat();

  const { data, error } = await supabase
    .from("chat_room_members")
    .select(CHAT_MEMBER_COLUMNS)
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("user_type", userType)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;

  return data as ChatRoomMember | null;
}

/**
 * 1:1 채팅방에서 상대방 멤버 조회 (나간 멤버 포함)
 * Admin Client 사용으로 RLS 우회
 */
export async function findOtherMemberInDirectRoom(
  roomId: string,
  currentUserId: string,
  currentUserType: ChatUserType
): Promise<ChatRoomMember | null> {
  const supabase = getAdminClientForChat();

  // 해당 방의 멤버 조회 (deleted_at 제외, left_at은 허용 — 퇴장 상태 확인 목적)
  const { data, error } = await supabase
    .from("chat_room_members")
    .select(CHAT_MEMBER_COLUMNS)
    .eq("room_id", roomId)
    .is("deleted_at", null);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  // 현재 사용자가 아닌 다른 멤버 찾기
  const otherMember = (data as ChatRoomMember[]).find(
    (m) => !(m.user_id === currentUserId && m.user_type === currentUserType)
  );

  return otherMember ?? null;
}

/**
 * 멤버 추가
 */
export async function insertMember(
  input: ChatRoomMemberInsert
): Promise<ChatRoomMember> {
  const supabase = getAdminClientForChat();

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

/**
 * 채팅방의 활성 멤버 목록과 last_read_at 조회 (읽음 상태 계산용)
 */
export async function findActiveMembersWithReadStatus(
  roomId: string
): Promise<Array<{ user_id: string; user_type: ChatUserType; last_read_at: string }>> {
  const supabase = getAdminClientForChat();

  const { data, error } = await supabase
    .from("chat_room_members")
    .select("user_id, user_type, last_read_at")
    .eq("room_id", roomId)
    .is("left_at", null);

  if (error) throw error;

  return (data ?? []) as Array<{ user_id: string; user_type: ChatUserType; last_read_at: string }>;
}

/**
 * 기존 멤버 배치 조회 (N+1 최적화)
 * 특정 채팅방에서 이미 존재하는 멤버들을 한 번에 조회
 */
export async function findExistingMembersByRoomBatch(
  roomId: string,
  memberIds: string[],
  memberTypes: ChatUserType[]
): Promise<Set<string>> {
  if (memberIds.length === 0) return new Set();

  const supabase = await createSupabaseServerClient();

  // RPC 함수 호출
  const { data, error } = await supabase.rpc("find_existing_members_batch", {
    p_room_id: roomId,
    p_member_ids: memberIds,
    p_member_types: memberTypes,
  });

  if (error) throw error;

  // user_id_userType 형태의 Set 생성
  const result = new Set<string>();
  for (const row of (data as Array<{ user_id: string; user_type: string }>) ?? []) {
    result.add(`${row.user_id}_${row.user_type}`);
  }

  return result;
}

/**
 * 멤버 배치 추가 (N+1 최적화)
 * 여러 멤버를 한 번의 INSERT로 추가
 */
export async function insertMembersBatch(
  members: ChatRoomMemberInsert[]
): Promise<ChatRoomMember[]> {
  if (members.length === 0) return [];

  const supabase = getAdminClientForChat();

  const { data, error } = await supabase
    .from("chat_room_members")
    .insert(members)
    .select(CHAT_MEMBER_COLUMNS);

  if (error) throw error;

  return (data as ChatRoomMember[]) ?? [];
}
