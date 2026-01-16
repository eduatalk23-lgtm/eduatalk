"use server";

/**
 * Chat Message Server Actions
 * 메시지 전송/조회/삭제
 */

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import * as chatService from "../service";
import type {
  ChatMessage,
  ChatMessageWithSender,
  ChatUserType,
  ChatActionResult,
  PaginatedResult,
  GetMessagesOptions,
  SearchMessagesResult,
  MessagesWithReadStatusResult,
} from "../types";

/**
 * 현재 사용자의 userType 결정
 */
function getUserType(role: string | null): ChatUserType {
  if (role === "admin" || role === "consultant") return "admin";
  return "student";
}

/**
 * 메시지 전송
 *
 * @param roomId 채팅방 ID
 * @param content 메시지 내용 (최대 1000자)
 * @param replyToId 답장 대상 메시지 ID (선택)
 * @returns 전송된 메시지
 */
export async function sendMessageAction(
  roomId: string,
  content: string,
  replyToId?: string | null
): Promise<ChatActionResult<ChatMessage>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.sendMessage(userId, userType, {
      roomId,
      content,
      replyToId,
    });
  } catch (error) {
    console.error("[sendMessageAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 전송 실패",
    };
  }
}

/**
 * 메시지 목록 조회 (페이지네이션)
 *
 * @param roomId 채팅방 ID
 * @param options 페이지네이션 옵션 (limit, before)
 * @returns 메시지 목록 (발신자 정보 포함)
 */
export async function getMessagesAction(
  roomId: string,
  options: { limit?: number; before?: string } = {}
): Promise<ChatActionResult<PaginatedResult<ChatMessageWithSender>>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    const messageOptions: GetMessagesOptions = {
      roomId,
      limit: options.limit ?? 50,
      before: options.before,
    };

    return await chatService.getMessages(userId, userType, messageOptions);
  } catch (error) {
    console.error("[getMessagesAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 조회 실패",
    };
  }
}

/**
 * 메시지 삭제 (본인 메시지만)
 *
 * @param messageId 메시지 ID
 */
export async function deleteMessageAction(
  messageId: string
): Promise<ChatActionResult<void>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    return await chatService.deleteMessage(messageId, userId);
  } catch (error) {
    console.error("[deleteMessageAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 삭제 실패",
    };
  }
}

/**
 * 읽음 처리 (채팅방 입장/스크롤 시 호출)
 *
 * @param roomId 채팅방 ID
 */
export async function markAsReadAction(
  roomId: string
): Promise<ChatActionResult<void>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.markRoomAsRead(roomId, userId, userType);
  } catch (error) {
    console.error("[markAsReadAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "읽음 처리 실패",
    };
  }
}

/**
 * 메시지 편집 (본인 메시지, 5분 이내)
 *
 * @param messageId 메시지 ID
 * @param newContent 새 메시지 내용
 */
export async function editMessageAction(
  messageId: string,
  newContent: string
): Promise<ChatActionResult<ChatMessage>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.editMessage(userId, userType, messageId, newContent);
  } catch (error) {
    console.error("[editMessageAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 수정 실패",
    };
  }
}

/**
 * 메시지 검색
 *
 * @param roomId 채팅방 ID
 * @param query 검색어
 * @param options 페이지네이션 옵션 (limit, offset)
 */
export async function searchMessagesAction(
  roomId: string,
  query: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ChatActionResult<SearchMessagesResult>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.searchMessages(userId, userType, {
      roomId,
      query,
      limit: options.limit,
      offset: options.offset,
    });
  } catch (error) {
    console.error("[searchMessagesAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 검색 실패",
    };
  }
}

/**
 * 메시지 목록 조회 (읽음 상태 포함)
 *
 * @param roomId 채팅방 ID
 * @param options 페이지네이션 옵션 (limit, before)
 */
export async function getMessagesWithReadStatusAction(
  roomId: string,
  options: { limit?: number; before?: string } = {}
): Promise<ChatActionResult<MessagesWithReadStatusResult>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.getMessagesWithReadStatus(userId, userType, {
      roomId,
      limit: options.limit ?? 50,
      before: options.before,
    });
  } catch (error) {
    console.error("[getMessagesWithReadStatusAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 조회 실패",
    };
  }
}
