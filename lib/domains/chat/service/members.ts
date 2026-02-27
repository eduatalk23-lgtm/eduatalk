/**
 * 멤버 서비스
 */

import * as repository from "../repository";
import { getUserInfo } from "./_helpers";
import type {
  ChatRoom,
  ChatUserType,
  ChatActionResult,
} from "../types";

/**
 * 그룹 채팅방에 멤버 초대
 * 배치 쿼리로 N+1 최적화 (N개 순차 쿼리 → 2개 배치 쿼리)
 */
export async function inviteMembers(
  roomId: string,
  inviterId: string,
  inviterType: ChatUserType,
  memberIds: string[],
  memberTypes: ChatUserType[]
): Promise<ChatActionResult<void>> {
  try {
    // 방 정보 확인
    const room = await repository.findRoomById(roomId);
    if (!room) {
      return { success: false, error: "채팅방을 찾을 수 없습니다" };
    }

    if (room.type !== "group") {
      return { success: false, error: "그룹 채팅방에서만 초대할 수 있습니다" };
    }

    // 초대자 멤버십 확인
    const inviterMembership = await repository.findMember(
      roomId,
      inviterId,
      inviterType
    );
    if (!inviterMembership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    // 배치로 기존 멤버 조회 (N+1 → 1 쿼리)
    const existingMembers = await repository.findExistingMembersByRoomBatch(
      roomId,
      memberIds,
      memberTypes
    );

    // visible_from 결정: history_visible에 따라 분기
    const visibleFrom = room.history_visible
      ? room.created_at // 공개: 방 생성 시점부터 전체 이력
      : new Date().toISOString(); // 비공개: 지금부터

    // 새로 추가할 멤버들 필터링
    const newMembers: Array<{
      room_id: string;
      user_id: string;
      user_type: ChatUserType;
      role: "member";
      last_read_at: string;
      visible_from: string;
    }> = [];

    for (let i = 0; i < memberIds.length; i++) {
      const key = `${memberIds[i]}_${memberTypes[i]}`;
      if (!existingMembers.has(key)) {
        newMembers.push({
          room_id: roomId,
          user_id: memberIds[i],
          user_type: memberTypes[i],
          role: "member",
          // last_read_at을 visible_from과 동일하게 설정하여 unread 배지 정확성 보장
          last_read_at: visibleFrom,
          visible_from: visibleFrom,
        });
      }
    }

    // 배치로 멤버 추가 (N+1 → 1 쿼리)
    if (newMembers.length > 0) {
      await repository.insertMembersBatch(newMembers);
    }

    // 시스템 메시지 추가 (발신자 스냅샷 포함)
    const inviterInfo = await getUserInfo(inviterId, inviterType);
    await repository.insertMessage({
      room_id: roomId,
      sender_id: inviterId,
      sender_type: inviterType,
      message_type: "system",
      content: `${inviterInfo?.name ?? "사용자"}님이 새 멤버를 초대했습니다`,
      sender_name: inviterInfo?.name ?? "사용자",
      sender_profile_url: inviterInfo?.profileImageUrl ?? null,
    });

    return { success: true };
  } catch (error) {
    console.error("[ChatService] inviteMembers error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "멤버 초대 실패",
    };
  }
}

/**
 * 채팅방 나가기
 */
export async function leaveRoom(
  roomId: string,
  userId: string,
  userType: ChatUserType
): Promise<ChatActionResult<void>> {
  try {
    // 멤버십 확인
    const membership = await repository.findMember(roomId, userId, userType);
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    // 핵심 작업: left_at + deleted_at 동시 설정 (나가기 = 삭제 통합)
    const now = new Date().toISOString();
    await repository.updateMember(roomId, userId, userType, {
      left_at: now,
      deleted_at: now,
    });

    // 부가 작업: 시스템 메시지 (실패해도 나가기는 성공으로 처리)
    try {
      const userInfo = await getUserInfo(userId, userType);
      await repository.insertMessage({
        room_id: roomId,
        sender_id: userId,
        sender_type: userType,
        message_type: "system",
        content: `${userInfo?.name ?? "사용자"}님이 채팅방을 나갔습니다`,
        sender_name: userInfo?.name ?? "사용자",
        sender_profile_url: userInfo?.profileImageUrl ?? null,
      });
    } catch (msgError) {
      console.warn("[ChatService] System message failed on leave:", msgError);
      // 나가기 자체는 성공으로 처리
    }

    return { success: true };
  } catch (error) {
    console.error("[ChatService] leaveRoom error:", error);
    // RLS 에러 처리
    if (error instanceof Error && error.message.includes("row-level security")) {
      return { success: false, error: "채팅방 접근 권한이 없습니다" };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "채팅방 나가기 실패",
    };
  }
}

/**
 * 채팅방 아카이브 (방장/관리자만 가능)
 * 방 상태를 archived로 변경하여 목록에서 숨김 (데이터 보존)
 */
export async function archiveRoom(
  roomId: string,
  userId: string,
  userType: ChatUserType
): Promise<ChatActionResult<ChatRoom>> {
  try {
    // 멤버십 + 권한 확인
    const membership = await repository.findMember(roomId, userId, userType);
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }
    if (membership.role !== "owner" && membership.role !== "admin") {
      return { success: false, error: "아카이브 권한이 없습니다" };
    }

    const room = await repository.updateRoom(roomId, {
      status: "archived",
      archived_at: new Date().toISOString(),
    });

    // 시스템 메시지
    const userInfo = await getUserInfo(userId, userType);
    await repository.insertMessage({
      room_id: roomId,
      sender_id: userId,
      sender_type: userType,
      message_type: "system",
      content: `${userInfo?.name ?? "사용자"}님이 채팅방을 아카이브했습니다`,
      sender_name: userInfo?.name ?? "사용자",
      sender_profile_url: userInfo?.profileImageUrl ?? null,
    });

    return { success: true, data: room };
  } catch (error) {
    console.error("[ChatService] archiveRoom error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "채팅방 아카이브 실패",
    };
  }
}

/**
 * 채팅방 아카이브 해제 (방장/관리자만 가능)
 */
export async function unarchiveRoom(
  roomId: string,
  userId: string,
  userType: ChatUserType
): Promise<ChatActionResult<ChatRoom>> {
  try {
    const membership = await repository.findMember(roomId, userId, userType);
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }
    if (membership.role !== "owner" && membership.role !== "admin") {
      return { success: false, error: "아카이브 해제 권한이 없습니다" };
    }

    const room = await repository.updateRoom(roomId, {
      status: "active",
      archived_at: null,
    });

    // 시스템 메시지
    const userInfo = await getUserInfo(userId, userType);
    await repository.insertMessage({
      room_id: roomId,
      sender_id: userId,
      sender_type: userType,
      message_type: "system",
      content: `${userInfo?.name ?? "사용자"}님이 채팅방 아카이브를 해제했습니다`,
      sender_name: userInfo?.name ?? "사용자",
      sender_profile_url: userInfo?.profileImageUrl ?? null,
    });

    return { success: true, data: room };
  } catch (error) {
    console.error("[ChatService] unarchiveRoom error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "아카이브 해제 실패",
    };
  }
}

/**
 * 채팅방 삭제 (소프트 삭제 - 멤버 개별)
 * 해당 사용자의 멤버십에 deleted_at을 설정하여 목록에서 숨김
 * 데이터는 보존되며 다른 멤버에게는 영향 없음
 */
export async function deleteMemberRoom(
  roomId: string,
  userId: string,
  userType: ChatUserType
): Promise<ChatActionResult<void>> {
  try {
    const membership = await repository.findMember(roomId, userId, userType);
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    const now = new Date().toISOString();

    // 나가기 + 소프트 삭제를 단일 호출로 원자적 처리
    await repository.updateMember(roomId, userId, userType, {
      left_at: membership.left_at ?? now,
      deleted_at: now,
    });

    return { success: true };
  } catch (error) {
    console.error("[ChatService] deleteMemberRoom error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "채팅방 삭제 실패",
    };
  }
}
