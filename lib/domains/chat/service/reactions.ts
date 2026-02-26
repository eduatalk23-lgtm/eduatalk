/**
 * 리액션 서비스
 */

import * as repository from "../repository";
import type {
  ChatUserType,
  ReactionToggleInput,
  ChatActionResult,
} from "../types";

/**
 * 리액션 토글
 * - 리액션이 없으면 추가, 있으면 삭제
 * - 채팅방 멤버만 리액션 가능
 * - 삭제된 메시지에는 리액션 불가
 */
export async function toggleReaction(
  userId: string,
  userType: ChatUserType,
  input: ReactionToggleInput
): Promise<ChatActionResult<{ added: boolean }>> {
  try {
    const { messageId, emoji } = input;

    // 1. 메시지 조회
    const message = await repository.findMessageById(messageId);
    if (!message) {
      return { success: false, error: "메시지를 찾을 수 없습니다" };
    }

    // 2. 삭제된 메시지인지 확인
    if (message.is_deleted) {
      return { success: false, error: "삭제된 메시지에는 리액션할 수 없습니다" };
    }

    // 3. 채팅방 멤버십 확인
    const membership = await repository.findMember(message.room_id, userId, userType);
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    // 4. 기존 리액션 존재 여부 확인
    const hasExisting = await repository.hasReaction({
      messageId,
      userId,
      userType,
      emoji,
    });

    // 5. 토글 실행
    if (hasExisting) {
      // 기존 리액션 삭제
      await repository.deleteReaction({
        messageId,
        userId,
        userType,
        emoji,
      });
      return { success: true, data: { added: false } };
    } else {
      // 새 리액션 추가
      await repository.insertReaction({
        messageId,
        userId,
        userType,
        emoji,
      });
      return { success: true, data: { added: true } };
    }
  } catch (error) {
    console.error("[ChatService] toggleReaction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "리액션 처리 실패",
    };
  }
}
