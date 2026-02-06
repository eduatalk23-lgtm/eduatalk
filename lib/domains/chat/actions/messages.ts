"use server";

/**
 * Chat Message Server Actions
 * 메시지 전송/조회/삭제
 */

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import * as chatService from "../service";
import * as repository from "../repository";
import {
  getUserType,
  type ChatMessage,
  type ChatMessageWithSender,
  type ChatUserType,
  type ChatUser,
  type ChatActionResult,
  type PaginatedResult,
  type GetMessagesOptions,
  type SearchMessagesResult,
  type MessagesWithReadStatusResult,
} from "../types";

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
  replyToId?: string | null,
  clientMessageId?: string
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
      clientMessageId,
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
  newContent: string,
  expectedUpdatedAt?: string
): Promise<ChatActionResult<ChatMessage>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.editMessage(
      userId,
      userType,
      messageId,
      newContent,
      expectedUpdatedAt
    );
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
    // Supabase 에러는 일반 객체이므로 별도 처리
    const errorMessage = error instanceof Error
      ? error.message
      : (error as { message?: string })?.message ?? "메시지 조회 실패";

    console.error("[getMessagesWithReadStatusAction] Error:", {
      message: errorMessage,
      code: (error as { code?: string })?.code,
      raw: JSON.stringify(error),
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 발신자 정보 조회 (실시간 이벤트에서 sender 정보 보강용)
 *
 * @param senderId 발신자 ID
 * @param senderType 발신자 타입 (student | admin)
 */
export async function getSenderInfoAction(
  senderId: string,
  senderType: ChatUserType
): Promise<ChatActionResult<ChatUser>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const senderInfo = await repository.findSenderById(senderId, senderType);

    if (!senderInfo) {
      return { success: false, error: "발신자 정보를 찾을 수 없습니다." };
    }

    return {
      success: true,
      data: {
        id: senderInfo.id,
        type: senderType,
        name: senderInfo.name,
        profileImageUrl: senderInfo.profileImageUrl,
      },
    };
  } catch (error) {
    console.error("[getSenderInfoAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "발신자 정보 조회 실패",
    };
  }
}

/**
 * 발신자 정보 배치 조회 (실시간 이벤트에서 sender 정보 보강용)
 *
 * @param senderKeys 발신자 ID와 타입 배열
 */
export async function getSenderInfoBatchAction(
  senderKeys: Array<{ id: string; type: ChatUserType }>
): Promise<ChatActionResult<Record<string, ChatUser>>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const result = await repository.findSendersByIds(senderKeys);

    // Server Action은 Map을 직렬화할 수 없으므로 Record로 변환
    const chatUsers: Record<string, ChatUser> = {};
    for (const [key, info] of result) {
      chatUsers[key] = {
        id: info.id,
        type: key.endsWith("_admin") ? "admin" : "student",
        name: info.name,
        profileImageUrl: info.profileImageUrl,
      };
    }

    return { success: true, data: chatUsers };
  } catch (error) {
    console.error("[getSenderInfoBatchAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "발신자 배치 조회 실패",
    };
  }
}

/**
 * 특정 시점 이후의 메시지 조회 (점진적 동기화용)
 *
 * 재연결 시 마지막 동기화 시점 이후의 메시지만 가져옵니다.
 * 전체 캐시 무효화 대신 효율적인 동기화를 지원합니다.
 *
 * @param roomId 채팅방 ID
 * @param since ISO 8601 타임스탬프 (이 시점 이후 메시지만 조회)
 * @param limit 최대 조회 개수 (기본: 100)
 */
export async function getMessagesSinceAction(
  roomId: string,
  since: string,
  limit: number = 100
): Promise<ChatActionResult<ChatMessageWithSender[]>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    // 권한 확인: 채팅방 멤버인지
    const member = await repository.findMember(roomId, userId, userType);
    if (!member) {
      return { success: false, error: "채팅방에 접근 권한이 없습니다." };
    }

    // 메시지 조회
    const messages = await repository.findMessagesSince(roomId, since, limit);

    if (messages.length === 0) {
      return { success: true, data: [] };
    }

    // 발신자 정보 배치 조회
    const senderKeys = messages.map((m) => ({
      id: m.sender_id,
      type: m.sender_type,
    }));
    const senderMap = await repository.findSendersByIds(senderKeys);

    // 메시지에 발신자 정보 추가
    const messagesWithSender: ChatMessageWithSender[] = messages.map((m) => {
      const senderKey = `${m.sender_id}_${m.sender_type}`;
      const senderInfo = senderMap.get(senderKey);

      return {
        ...m,
        sender: senderInfo
          ? {
              id: senderInfo.id,
              type: m.sender_type,
              name: senderInfo.name,
              profileImageUrl: senderInfo.profileImageUrl,
            }
          : {
              id: m.sender_id,
              type: m.sender_type,
              name: "알 수 없음",
            },
        reactions: [],
        replyTarget: null,
      };
    });

    return { success: true, data: messagesWithSender };
  } catch (error) {
    console.error("[getMessagesSinceAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 동기화 실패",
    };
  }
}
