"use server";

/**
 * Chat Reaction Server Actions
 * 메시지 리액션 토글
 */

import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import * as chatService from "../service";
import { getUserType, type ChatActionResult, type ReactionEmoji } from "../types";
import { isUUID } from "@/lib/types/guards";

/**
 * 메시지 리액션 토글
 * - 리액션이 없으면 추가, 있으면 삭제
 *
 * @param messageId 메시지 ID
 * @param emoji 리액션 이모지 (👍, ❤️, 😂, 🔥, 😮)
 * @returns { added: boolean } - true면 추가됨, false면 삭제됨
 */
export async function toggleReactionAction(
  messageId: string,
  emoji: ReactionEmoji
): Promise<ChatActionResult<{ added: boolean }>> {
  try {
    if (!isUUID(messageId)) {
      return { success: false, error: "잘못된 메시지 ID입니다." };
    }
    const { userId, role } = await getCachedUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.toggleReaction(userId, userType, {
      messageId,
      emoji,
    });
  } catch (error) {
    console.error("[toggleReactionAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "리액션 처리 실패",
    };
  }
}
