/**
 * 차단/신고 서비스
 */

import * as repository from "../repository";
import type {
  ChatUserType,
  ChatActionResult,
} from "../types";

/**
 * 사용자 차단
 */
export async function blockUser(
  blockerId: string,
  blockerType: ChatUserType,
  blockedId: string,
  blockedType: ChatUserType
): Promise<ChatActionResult<void>> {
  try {
    // 이미 차단했는지 확인
    const alreadyBlocked = await repository.isBlocked(
      blockerId,
      blockerType,
      blockedId,
      blockedType
    );

    if (alreadyBlocked) {
      return { success: false, error: "이미 차단한 사용자입니다" };
    }

    await repository.insertBlock({
      blocker_id: blockerId,
      blocker_type: blockerType,
      blocked_id: blockedId,
      blocked_type: blockedType,
    });

    return { success: true };
  } catch (error) {
    console.error("[ChatService] blockUser error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "차단 실패",
    };
  }
}

/**
 * 차단 해제
 */
export async function unblockUser(
  blockerId: string,
  blockerType: ChatUserType,
  blockedId: string,
  blockedType: ChatUserType
): Promise<ChatActionResult<void>> {
  try {
    await repository.deleteBlock(blockerId, blockerType, blockedId, blockedType);
    return { success: true };
  } catch (error) {
    console.error("[ChatService] unblockUser error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "차단 해제 실패",
    };
  }
}

/**
 * 메시지 신고
 */
export async function reportMessage(
  reporterId: string,
  reporterType: ChatUserType,
  messageId: string,
  reason: string,
  description?: string
): Promise<ChatActionResult<void>> {
  try {
    await repository.insertReport({
      reporter_id: reporterId,
      reporter_type: reporterType,
      reported_message_id: messageId,
      reason: reason as "spam" | "harassment" | "inappropriate" | "hate_speech" | "other",
      description: description ?? null,
    });

    return { success: true };
  } catch (error) {
    console.error("[ChatService] reportMessage error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "신고 실패",
    };
  }
}
