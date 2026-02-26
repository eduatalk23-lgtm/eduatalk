/**
 * 리액션 Repository
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminClientForChat, CHAT_REACTION_COLUMNS } from "./_shared";
import type {
  MessageReaction,
  ReactionEmoji,
  ChatUserType,
} from "../types";

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

  const supabase = getAdminClientForChat();

  const { data, error } = await supabase
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
