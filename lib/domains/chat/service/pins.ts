/**
 * 고정 메시지 서비스
 */

import * as repository from "../repository";
import type {
  ChatUserType,
  PinMessageInput,
  PinnedMessageWithContent,
  ChatActionResult,
} from "../types";

/** 최대 고정 메시지 개수 */
const MAX_PINNED_MESSAGES = 5;

/**
 * 메시지 고정
 * - 채팅방 멤버만 고정 가능
 * - owner/admin 역할만 고정 가능
 * - 삭제된 메시지는 고정 불가
 * - 최대 5개까지만 고정 가능
 */
export async function pinMessage(
  userId: string,
  userType: ChatUserType,
  input: PinMessageInput
): Promise<ChatActionResult<void>> {
  try {
    const { roomId, messageId } = input;

    // 1. 메시지 조회
    const message = await repository.findMessageById(messageId);
    if (!message) {
      return { success: false, error: "메시지를 찾을 수 없습니다" };
    }

    // 2. 같은 채팅방 메시지인지 확인
    if (message.room_id !== roomId) {
      return { success: false, error: "해당 채팅방의 메시지가 아닙니다" };
    }

    // 3. 삭제된 메시지인지 확인
    if (message.is_deleted) {
      return { success: false, error: "삭제된 메시지는 고정할 수 없습니다" };
    }

    // 4. 채팅방 멤버십 및 역할 확인
    const membership = await repository.findMember(roomId, userId, userType);
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      return { success: false, error: "메시지를 고정할 권한이 없습니다" };
    }

    // 5. 이미 고정된 메시지인지 확인
    const alreadyPinned = await repository.isPinnedMessage(roomId, messageId);
    if (alreadyPinned) {
      return { success: false, error: "이미 고정된 메시지입니다" };
    }

    // 6. 최대 고정 개수 확인
    const pinnedCount = await repository.countPinnedMessages(roomId);
    if (pinnedCount >= MAX_PINNED_MESSAGES) {
      return {
        success: false,
        error: `최대 ${MAX_PINNED_MESSAGES}개까지만 고정할 수 있습니다`,
      };
    }

    // 7. 고정 메시지 추가
    await repository.insertPinnedMessage({
      room_id: roomId,
      message_id: messageId,
      pinned_by: userId,
      pinned_by_type: userType,
    });

    return { success: true };
  } catch (error) {
    console.error("[ChatService] pinMessage error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 고정 실패",
    };
  }
}

/**
 * 메시지 고정 해제
 * - 채팅방 멤버만 해제 가능
 * - owner/admin 역할만 해제 가능
 */
export async function unpinMessage(
  userId: string,
  userType: ChatUserType,
  input: PinMessageInput
): Promise<ChatActionResult<void>> {
  try {
    const { roomId, messageId } = input;

    // 1. 채팅방 멤버십 및 역할 확인
    const membership = await repository.findMember(roomId, userId, userType);
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      return { success: false, error: "메시지 고정을 해제할 권한이 없습니다" };
    }

    // 2. 고정된 메시지인지 확인
    const isPinned = await repository.isPinnedMessage(roomId, messageId);
    if (!isPinned) {
      return { success: false, error: "고정되지 않은 메시지입니다" };
    }

    // 3. 고정 해제
    await repository.deletePinnedMessage(roomId, messageId);

    return { success: true };
  } catch (error) {
    console.error("[ChatService] unpinMessage error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 고정 해제 실패",
    };
  }
}

/**
 * 채팅방의 고정 메시지 목록 조회
 * - 채팅방 멤버만 조회 가능
 * - 메시지 내용 + 발신자 이름 포함
 */
export async function getPinnedMessages(
  userId: string,
  userType: ChatUserType,
  roomId: string
): Promise<ChatActionResult<PinnedMessageWithContent[]>> {
  try {
    // 1. 채팅방 멤버십 확인
    const membership = await repository.findMember(roomId, userId, userType);
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    // 2. 고정 메시지 목록 조회
    const pinnedMessages = await repository.findPinnedMessagesByRoom(roomId);
    if (pinnedMessages.length === 0) {
      return { success: true, data: [] };
    }

    // 3. 메시지 내용 배치 조회
    const messageIds = pinnedMessages.map((p) => p.message_id);
    const messagesMap = await repository.findReplyTargetsByIds(messageIds);

    // 4. 발신자 정보 배치 조회
    const senderKeys = Array.from(messagesMap.values()).map((m) => ({
      id: m.sender_id,
      type: m.sender_type,
    }));
    const senderMap = await repository.findSendersByIds(senderKeys);

    // 5. 결과 조합
    const result: PinnedMessageWithContent[] = pinnedMessages.map((pinned) => {
      const msg = messagesMap.get(pinned.message_id);
      const senderInfo = msg
        ? senderMap.get(`${msg.sender_id}_${msg.sender_type}`)
        : null;

      return {
        ...pinned,
        message: {
          content: msg?.is_deleted ? "삭제된 메시지입니다" : (msg?.content ?? ""),
          senderName: senderInfo?.name ?? "알 수 없음",
          isDeleted: msg?.is_deleted ?? true,
        },
      };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("[ChatService] getPinnedMessages error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "고정 메시지 조회 실패",
    };
  }
}

/**
 * 메시지 고정 여부 확인 (단일 메시지)
 */
export async function checkMessagePinned(
  roomId: string,
  messageId: string
): Promise<boolean> {
  try {
    return await repository.isPinnedMessage(roomId, messageId);
  } catch {
    return false;
  }
}

/**
 * 사용자가 고정 권한을 가지고 있는지 확인
 */
export async function canUserPinMessages(
  userId: string,
  userType: ChatUserType,
  roomId: string
): Promise<boolean> {
  try {
    const membership = await repository.findMember(roomId, userId, userType);
    if (!membership) return false;
    return membership.role === "owner" || membership.role === "admin";
  } catch {
    return false;
  }
}
