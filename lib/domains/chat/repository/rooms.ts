/**
 * 채팅방 Repository
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminClientForChat, CHAT_ROOM_COLUMNS } from "./_shared";
import type {
  ChatRoom,
  ChatRoomInsert,
  ChatRoomUpdate,
  ChatRoomCategory,
  GetRoomsOptions,
  ChatUserType,
} from "../types";

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
 * deleted_at이 설정된 멤버십은 제외 (소프트 삭제)
 */
export async function findRoomsByUser(
  userId: string,
  userType: ChatUserType,
  options: GetRoomsOptions = {}
): Promise<ChatRoom[]> {
  const { limit = 20, offset = 0, category, status } = options;
  const supabase = await createSupabaseServerClient();

  // 멤버로 참여 중인 방 ID 목록 조회 (left_at=null, deleted_at=null)
  const { data: memberData, error: memberError } = await supabase
    .from("chat_room_members")
    .select("room_id")
    .eq("user_id", userId)
    .eq("user_type", userType)
    .is("left_at", null)
    .is("deleted_at", null);

  if (memberError) throw memberError;
  if (!memberData || memberData.length === 0) return [];

  const roomIds = memberData.map((m) => m.room_id);

  // 채팅방 정보 조회
  let query = supabase
    .from("chat_rooms")
    .select(CHAT_ROOM_COLUMNS)
    .in("id", roomIds)
    .eq("is_active", true);

  // 카테고리 필터
  if (category) {
    query = query.eq("category", category);
  }

  // 상태 필터 (기본: active만)
  if (status && status !== "all") {
    query = query.eq("status", status);
  } else if (!status) {
    query = query.eq("status", "active");
  }

  const { data, error } = await query
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
 * 두 사용자 간의 1:1 채팅방 찾기 (나간 멤버 포함)
 * Auto-rejoin 기능을 위해 left_at과 관계없이 방을 찾음
 *
 * RPC 단일 JOIN으로 3 RTT → 1 RTT 최적화
 *
 * @param category 카테고리별로 별도의 1:1 방 허용 (기본: general)
 */
export async function findDirectRoomIncludingLeft(
  user1Id: string,
  user1Type: ChatUserType,
  user2Id: string,
  user2Type: ChatUserType,
  category: ChatRoomCategory = "general"
): Promise<{ room: ChatRoom; user1Left: boolean; user2Left: boolean } | null> {
  const supabase = getAdminClientForChat();

  const { data, error } = await supabase
    .rpc("find_direct_room_including_left_rpc", {
      p_user1_id: user1Id,
      p_user1_type: user1Type,
      p_user2_id: user2Id,
      p_user2_type: user2Type,
      p_category: category,
    })
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    room: data.room_data as ChatRoom,
    user1Left: data.user1_left,
    user2Left: data.user2_left,
  };
}

/**
 * 채팅방 생성
 */
export async function insertRoom(
  input: ChatRoomInsert
): Promise<ChatRoom> {
  const supabase = getAdminClientForChat();

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
