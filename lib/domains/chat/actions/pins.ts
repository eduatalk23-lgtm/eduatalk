"use server";

/**
 * Chat Pin Server Actions
 * 메시지 고정/해제 기능
 */

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import * as chatService from "../service";
import type {
  ChatActionResult,
  ChatUserType,
  PinnedMessageWithContent,
} from "../types";

/**
 * 현재 사용자의 userType 결정
 */
function getUserType(role: string | null): ChatUserType {
  if (role === "admin" || role === "consultant") return "admin";
  return "student";
}

/**
 * 메시지 고정
 *
 * @param roomId 채팅방 ID
 * @param messageId 고정할 메시지 ID
 */
export async function pinMessageAction(
  roomId: string,
  messageId: string
): Promise<ChatActionResult<void>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.pinMessage(userId, userType, {
      roomId,
      messageId,
    });
  } catch (error) {
    console.error("[pinMessageAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 고정 실패",
    };
  }
}

/**
 * 메시지 고정 해제
 *
 * @param roomId 채팅방 ID
 * @param messageId 고정 해제할 메시지 ID
 */
export async function unpinMessageAction(
  roomId: string,
  messageId: string
): Promise<ChatActionResult<void>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.unpinMessage(userId, userType, {
      roomId,
      messageId,
    });
  } catch (error) {
    console.error("[unpinMessageAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 고정 해제 실패",
    };
  }
}

/**
 * 채팅방의 고정 메시지 목록 조회
 *
 * @param roomId 채팅방 ID
 */
export async function getPinnedMessagesAction(
  roomId: string
): Promise<ChatActionResult<PinnedMessageWithContent[]>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.getPinnedMessages(userId, userType, roomId);
  } catch (error) {
    console.error("[getPinnedMessagesAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "고정 메시지 조회 실패",
    };
  }
}

/**
 * 사용자가 고정 권한을 가지고 있는지 확인
 *
 * @param roomId 채팅방 ID
 */
export async function canPinMessagesAction(
  roomId: string
): Promise<ChatActionResult<{ canPin: boolean }>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);
    const canPin = await chatService.canUserPinMessages(userId, userType, roomId);

    return { success: true, data: { canPin } };
  } catch (error) {
    console.error("[canPinMessagesAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "권한 확인 실패",
    };
  }
}
