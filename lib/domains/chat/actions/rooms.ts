"use server";

/**
 * Chat Room Server Actions
 * 채팅방 생성/조회/관리
 */

import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import * as chatService from "../service";
import {
  getUserType,
  type ChatRoom,
  type ChatRoomListItem,
  type ChatRoomMemberWithUser,
  type ChatUserType,
  type ChatRoomCategory,
  type ChatRoomStatus,
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
    const { userId, role, tenantId } = await getCachedUserRole();

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
 * @param options 페이지네이션 및 필터 옵션
 * @returns 채팅방 목록 (마지막 메시지, 안 읽은 수 포함)
 */
export async function getChatRoomsAction(
  options: {
    limit?: number;
    offset?: number;
    category?: ChatRoomCategory;
    status?: ChatRoomStatus | "all";
  } = {}
): Promise<ChatActionResult<ChatRoomListItem[]>> {
  try {
    const { userId, role } = await getCachedUserRole();

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
): Promise<ChatActionResult<{ room: ChatRoom; members: ChatRoomMemberWithUser[]; otherMemberLeft: boolean }>> {
  try {
    const { userId, role } = await getCachedUserRole();

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
    const { userId, role } = await getCachedUserRole();

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
 * @param options category/topic으로 동일 참여자 간 다중 방 구분
 * @returns 1:1 채팅방
 */
export async function startDirectChatAction(
  targetUserId: string,
  targetUserType: ChatUserType,
  options?: { category?: ChatRoomCategory; topic?: string }
): Promise<ChatActionResult<ChatRoom>> {
  try {
    const { userId, role, tenantId } = await getCachedUserRole();

    if (!userId || !role || !tenantId) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.createOrGetRoom(tenantId, userId, userType, {
      type: "direct",
      category: options?.category,
      topic: options?.topic,
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
// 아카이브 / 삭제 Actions
// ============================================

/**
 * 채팅방 아카이브 (방장/관리자만)
 *
 * @param roomId 채팅방 ID
 */
export async function archiveChatRoomAction(
  roomId: string
): Promise<ChatActionResult<ChatRoom>> {
  try {
    const { userId, role } = await getCachedUserRole();
    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }
    const userType = getUserType(role);
    return await chatService.archiveRoom(roomId, userId, userType);
  } catch (error) {
    console.error("[archiveChatRoomAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "채팅방 아카이브 실패",
    };
  }
}

/**
 * 채팅방 아카이브 해제 (방장/관리자만)
 *
 * @param roomId 채팅방 ID
 */
export async function unarchiveChatRoomAction(
  roomId: string
): Promise<ChatActionResult<ChatRoom>> {
  try {
    const { userId, role } = await getCachedUserRole();
    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }
    const userType = getUserType(role);
    return await chatService.unarchiveRoom(roomId, userId, userType);
  } catch (error) {
    console.error("[unarchiveChatRoomAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "아카이브 해제 실패",
    };
  }
}

/**
 * 채팅방 삭제 (소프트 - 해당 사용자 목록에서만 숨김)
 *
 * @param roomId 채팅방 ID
 */
export async function deleteChatRoomAction(
  roomId: string
): Promise<ChatActionResult<void>> {
  try {
    const { userId, role } = await getCachedUserRole();
    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }
    const userType = getUserType(role);
    return await chatService.deleteMemberRoom(roomId, userId, userType);
  } catch (error) {
    console.error("[deleteChatRoomAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "채팅방 삭제 실패",
    };
  }
}

/**
 * 채팅방 알림 음소거 토글
 *
 * @param roomId 채팅방 ID
 * @param muted 음소거 여부
 */
export async function toggleMuteChatRoomAction(
  roomId: string,
  muted: boolean
): Promise<ChatActionResult<void>> {
  try {
    const { userId, role } = await getCachedUserRole();
    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }
    const userType = getUserType(role);
    const { updateMember } = await import("../repository");
    await updateMember(roomId, userId, userType, { is_muted: muted });
    return { success: true };
  } catch (error) {
    console.error("[toggleMuteChatRoomAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "알림 설정 변경 실패",
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
    const { userId, role } = await getCachedUserRole();

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
    const { userId, role } = await getCachedUserRole();

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
    const { userId, role } = await getCachedUserRole();

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
