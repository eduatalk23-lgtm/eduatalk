"use server";

/**
 * Chat Room Server Actions
 * 채팅방 생성/조회/관리
 */

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import * as chatService from "../service";
import {
  getUserType,
  type ChatRoom,
  type ChatRoomListItem,
  type ChatRoomMemberWithUser,
  type ChatUserType,
  type ChatActionResult,
  type CreateChatRoomRequest,
  type AnnouncementInfo,
} from "../types";

/**
 * 채팅방 생성 (1:1 또는 그룹)
 *
 * @param request 채팅방 생성 요청
 * @returns 생성된 채팅방 또는 기존 1:1 채팅방
 */
export async function createChatRoomAction(
  request: CreateChatRoomRequest
): Promise<ChatActionResult<ChatRoom>> {
  try {
    const { userId, role, tenantId } = await getCurrentUserRole();

    if (!userId || !role || !tenantId) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.createOrGetRoom(
      tenantId,
      userId,
      userType,
      request
    );
  } catch (error) {
    console.error("[createChatRoomAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "채팅방 생성 실패",
    };
  }
}

/**
 * 내 채팅방 목록 조회
 *
 * @param options 페이지네이션 옵션
 * @returns 채팅방 목록 (마지막 메시지, 안 읽은 수 포함)
 */
export async function getChatRoomsAction(
  options: { limit?: number; offset?: number } = {}
): Promise<ChatActionResult<ChatRoomListItem[]>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    const rooms = await chatService.getRoomList(userId, userType, options);

    return { success: true, data: rooms };
  } catch (error) {
    console.error("[getChatRoomsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "채팅방 목록 조회 실패",
    };
  }
}

/**
 * 채팅방 상세 정보 조회
 *
 * @param roomId 채팅방 ID
 * @returns 채팅방 정보 + 멤버 목록
 */
export async function getChatRoomDetailAction(
  roomId: string
): Promise<ChatActionResult<{ room: ChatRoom; members: ChatRoomMemberWithUser[] }>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.getRoomDetail(roomId, userId, userType);
  } catch (error) {
    console.error("[getChatRoomDetailAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "채팅방 조회 실패",
    };
  }
}

/**
 * 채팅방 나가기
 *
 * @param roomId 채팅방 ID
 */
export async function leaveChatRoomAction(
  roomId: string
): Promise<ChatActionResult<void>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.leaveRoom(roomId, userId, userType);
  } catch (error) {
    console.error("[leaveChatRoomAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "채팅방 나가기 실패",
    };
  }
}

/**
 * 1:1 채팅 시작 (또는 기존 방 열기)
 *
 * @param targetUserId 대화 상대 ID
 * @param targetUserType 대화 상대 유형
 * @returns 1:1 채팅방
 */
export async function startDirectChatAction(
  targetUserId: string,
  targetUserType: ChatUserType
): Promise<ChatActionResult<ChatRoom>> {
  try {
    const { userId, role, tenantId } = await getCurrentUserRole();

    if (!userId || !role || !tenantId) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.createOrGetRoom(tenantId, userId, userType, {
      type: "direct",
      memberIds: [targetUserId],
      memberTypes: [targetUserType],
    });
  } catch (error) {
    console.error("[startDirectChatAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "채팅 시작 실패",
    };
  }
}

// ============================================
// 공지 Actions
// ============================================

/**
 * 채팅방 공지 설정
 *
 * @param roomId 채팅방 ID
 * @param content 공지 내용 (null이면 공지 삭제)
 */
export async function setAnnouncementAction(
  roomId: string,
  content: string | null
): Promise<ChatActionResult<ChatRoom>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.setAnnouncement(userId, userType, {
      roomId,
      content,
    });
  } catch (error) {
    console.error("[setAnnouncementAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "공지 설정 실패",
    };
  }
}

/**
 * 채팅방 공지 조회
 *
 * @param roomId 채팅방 ID
 */
export async function getAnnouncementAction(
  roomId: string
): Promise<ChatActionResult<AnnouncementInfo | null>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.getAnnouncement(userId, userType, roomId);
  } catch (error) {
    console.error("[getAnnouncementAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "공지 조회 실패",
    };
  }
}

/**
 * 사용자가 공지 설정 권한을 가지고 있는지 확인
 *
 * @param roomId 채팅방 ID
 */
export async function canSetAnnouncementAction(
  roomId: string
): Promise<ChatActionResult<{ canSet: boolean }>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);
    const canSet = await chatService.canUserSetAnnouncement(userId, userType, roomId);

    return { success: true, data: { canSet } };
  } catch (error) {
    console.error("[canSetAnnouncementAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "권한 확인 실패",
    };
  }
}
