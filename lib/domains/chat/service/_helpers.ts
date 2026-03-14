/**
 * Chat Service 공통 헬퍼
 */

import * as repository from "../repository";
import type {
  ChatUser,
  ChatUserType,
  MessageReaction,
  ReactionSummary,
} from "../types";

// 최대 메시지 길이
export const MAX_MESSAGE_LENGTH = 1000;

// ============================================
// 사용자 정보 조회 헬퍼
// ============================================

/**
 * 사용자 정보 조회 (user_profiles 기반 1-쿼리)
 */
export async function getUserInfo(
  userId: string,
  userType: ChatUserType
): Promise<ChatUser | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, name, profile_image_url, role")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return null;

  let displayName = profile.name;
  if (!displayName) {
    if (userType === "parent") displayName = "학부모";
    else if (profile.role === "consultant") displayName = "상담사";
    else if (userType === "admin") displayName = "관리자";
    else displayName = "사용자";
  }

  return {
    id: profile.id,
    type: userType,
    name: displayName,
    profileImageUrl: profile.profile_image_url ?? null,
  };
}

/**
 * 나간 멤버를 다시 채팅방에 참여시킴 (Auto-rejoin 헬퍼)
 * 1. left_at, deleted_at을 null로 업데이트
 * 2. 시스템 메시지 추가
 */
export async function rejoinMember(
  roomId: string,
  userId: string,
  userType: ChatUserType
): Promise<void> {
  // 1. left_at, deleted_at을 null로 업데이트하여 재참여 처리
  //    visible_from = NOW() → 재입장 이후 메시지만 표시
  //    last_read_at = NOW() → unread 배지 0으로 초기화
  const now = new Date().toISOString();
  await repository.updateMember(roomId, userId, userType, {
    left_at: null,
    deleted_at: null,
    visible_from: now,
    last_read_at: now,
  });

  // 2. 시스템 메시지 추가
  const userInfo = await getUserInfo(userId, userType);
  await repository.insertMessage({
    room_id: roomId,
    sender_id: userId,
    sender_type: userType,
    message_type: "system",
    content: `${userInfo?.name ?? "사용자"}님이 다시 채팅방에 참여했습니다`,
    sender_name: userInfo?.name ?? "사용자",
    sender_profile_url: userInfo?.profileImageUrl ?? null,
  });
}

/**
 * 리액션 목록을 요약으로 변환
 */
export function convertReactionsToSummaries(
  reactions: MessageReaction[],
  currentUserId: string,
  currentUserType: ChatUserType
): ReactionSummary[] {
  // 이모지별 그룹핑
  const emojiMap = new Map<string, { count: number; hasReacted: boolean }>();

  for (const reaction of reactions) {
    const existing = emojiMap.get(reaction.emoji) ?? { count: 0, hasReacted: false };
    existing.count += 1;
    if (reaction.user_id === currentUserId && reaction.user_type === currentUserType) {
      existing.hasReacted = true;
    }
    emojiMap.set(reaction.emoji, existing);
  }

  // ReactionSummary 배열로 변환
  const summaries: ReactionSummary[] = [];
  for (const [emoji, data] of emojiMap) {
    summaries.push({
      emoji: emoji as ReactionSummary["emoji"],
      count: data.count,
      hasReacted: data.hasReacted,
    });
  }

  return summaries;
}
