/**
 * 공지 서비스
 */

import * as repository from "../repository";
import { getUserInfo } from "./_helpers";
import type {
  ChatRoom,
  ChatUserType,
  SetAnnouncementInput,
  AnnouncementInfo,
  ChatActionResult,
} from "../types";

/**
 * 채팅방 공지 설정/삭제
 * - 채팅방 멤버만 설정 가능
 * - owner/admin 역할만 설정 가능
 * - content가 null이면 공지 삭제
 */
export async function setAnnouncement(
  userId: string,
  userType: ChatUserType,
  input: SetAnnouncementInput
): Promise<ChatActionResult<ChatRoom>> {
  try {
    const { roomId, content } = input;

    // 1. 채팅방 존재 확인
    const room = await repository.findRoomById(roomId);
    if (!room) {
      return { success: false, error: "채팅방을 찾을 수 없습니다" };
    }

    // 2. 채팅방 멤버십 및 역할 확인
    const membership = await repository.findMember(roomId, userId, userType);
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      return { success: false, error: "공지를 설정할 권한이 없습니다" };
    }

    // 3. 공지 내용 검증 (설정하는 경우)
    if (content !== null) {
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return { success: false, error: "공지 내용을 입력해주세요" };
      }
      if (trimmedContent.length > 500) {
        return { success: false, error: "공지는 500자를 초과할 수 없습니다" };
      }
    }

    // 4. 공지 설정/삭제 실행
    const updatedRoom = await repository.setRoomAnnouncement(
      roomId,
      content !== null ? userId : null,
      content !== null ? userType : null,
      content !== null ? content.trim() : null
    );

    return { success: true, data: updatedRoom };
  } catch (error) {
    console.error("[ChatService] setAnnouncement error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "공지 설정 실패",
    };
  }
}

/**
 * 채팅방 공지 조회
 * - 채팅방 멤버만 조회 가능
 * - 공지가 없으면 null 반환
 */
export async function getAnnouncement(
  userId: string,
  userType: ChatUserType,
  roomId: string
): Promise<ChatActionResult<AnnouncementInfo | null>> {
  try {
    // 1. 채팅방 존재 확인
    const room = await repository.findRoomById(roomId);
    if (!room) {
      return { success: false, error: "채팅방을 찾을 수 없습니다" };
    }

    // 2. 채팅방 멤버십 확인
    const membership = await repository.findMember(roomId, userId, userType);
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    // 3. 공지가 없으면 null 반환
    if (!room.announcement || !room.announcement_by || !room.announcement_by_type) {
      return { success: true, data: null };
    }

    // 4. 공지 작성자 정보 조회
    const authorInfo = await getUserInfo(room.announcement_by, room.announcement_by_type);

    return {
      success: true,
      data: {
        content: room.announcement,
        authorName: authorInfo?.name ?? "알 수 없음",
        authorType: room.announcement_by_type,
        createdAt: room.announcement_at ?? new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("[ChatService] getAnnouncement error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "공지 조회 실패",
    };
  }
}

/**
 * 사용자가 공지 설정 권한을 가지고 있는지 확인
 */
export async function canUserSetAnnouncement(
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
