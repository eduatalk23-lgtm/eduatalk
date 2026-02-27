/**
 * 채팅방 서비스
 */

import * as repository from "../repository";
import { getUserInfo, rejoinMember } from "./_helpers";
import type {
  ChatRoom,
  ChatRoomMemberWithUser,
  ChatRoomListItem,
  ChatRoomCategory,
  ChatRoomStatus,
  ChatUser,
  ChatUserType,
  ChatRoomType,
  CreateChatRoomRequest,
  GetRoomsOptions,
  ChatActionResult,
} from "../types";

/**
 * 채팅방 생성 또는 기존 방 반환 (1:1의 경우)
 *
 * category가 다르면 동일 참여자라도 별도의 1:1 방 생성 가능
 * topic이 지정되면 consulting 카테고리에서 방 식별에 활용
 */
export async function createOrGetRoom(
  tenantId: string,
  creatorId: string,
  creatorType: ChatUserType,
  request: CreateChatRoomRequest
): Promise<ChatActionResult<ChatRoom>> {
  try {
    const { type, category = "general", name, topic, memberIds, memberTypes, historyVisible } = request;

    // 1:1 채팅인 경우 기존 방 확인 (나간 방 포함 - Auto-rejoin)
    // consulting 카테고리는 topic이 있으면 항상 새 방 생성
    const shouldFindExisting = type === "direct" && memberIds.length === 1
      && !(category === "consulting" && topic);

    if (shouldFindExisting) {
      const existingRoomResult = await repository.findDirectRoomIncludingLeft(
        creatorId,
        creatorType,
        memberIds[0],
        memberTypes[0],
        category
      );

      if (existingRoomResult) {
        const { room, user1Left } = existingRoomResult;

        // 요청자(creator)가 나간 상태면 자동 재참여
        if (user1Left) {
          await rejoinMember(room.id, creatorId, creatorType);
        }

        return { success: true, data: room };
      }
    }

    // 새 방 생성
    const room = await repository.insertRoom({
      tenant_id: tenantId,
      type,
      category,
      name: type === "group" ? name ?? null : null,
      topic: topic ?? null,
      created_by: creatorId,
      created_by_type: creatorType,
      ...(historyVisible !== undefined && { history_visible: historyVisible }),
    });

    // 생성자를 멤버로 추가 (owner 역할)
    await repository.insertMember({
      room_id: room.id,
      user_id: creatorId,
      user_type: creatorType,
      role: "owner",
    });

    // 다른 멤버들 추가
    for (let i = 0; i < memberIds.length; i++) {
      await repository.insertMember({
        room_id: room.id,
        user_id: memberIds[i],
        user_type: memberTypes[i],
        role: "member",
      });
    }

    return { success: true, data: room };
  } catch (error) {
    console.error("[ChatService] createOrGetRoom error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "채팅방 생성 실패",
    };
  }
}

/**
 * 사용자의 채팅방 목록 조회 (UI 표시용 추가 정보 포함)
 * 배치 쿼리로 N+1 문제 해결 (101쿼리 → 5쿼리)
 */
export async function getRoomList(
  userId: string,
  userType: ChatUserType,
  options: GetRoomsOptions = {}
): Promise<ChatRoomListItem[]> {
  const rooms = await repository.findRoomsByUser(userId, userType, options);
  if (rooms.length === 0) return [];

  const roomIds = rooms.map((r) => r.id);

  // 배치 쿼리로 모든 데이터 한 번에 조회
  const [membersMap, lastMessagesMap] = await Promise.all([
    repository.findMembersByRoomIds(roomIds),
    repository.findLastMessagesByRoomIds(roomIds),
  ]);

  // 내 멤버십 정보로 last_read_at 맵 생성
  const membershipMap = new Map<string, { last_read_at: string }>();
  for (const roomId of roomIds) {
    const members = membersMap.get(roomId) ?? [];
    const myMembership = members.find(
      (m) => m.user_id === userId && m.user_type === userType
    );
    if (myMembership) {
      membershipMap.set(roomId, { last_read_at: myMembership.last_read_at });
    }
  }

  // 안 읽은 메시지 수 배치 조회
  const unreadMap = await repository.countUnreadByRoomIds(roomIds, userId, membershipMap);

  // 발신자 정보 배치 조회를 위한 키 수집
  const senderKeys: Array<{ id: string; type: ChatUserType }> = [];

  // 1:1 채팅 상대방 + 마지막 메시지 발신자
  for (const room of rooms) {
    const members = membersMap.get(room.id) ?? [];
    if (room.type === "direct") {
      const otherMember = members.find(
        (m) => !(m.user_id === userId && m.user_type === userType)
      );
      if (otherMember) {
        senderKeys.push({ id: otherMember.user_id, type: otherMember.user_type });
      }
    }
    const lastMsg = lastMessagesMap.get(room.id);
    if (lastMsg) {
      senderKeys.push({ id: lastMsg.sender_id, type: lastMsg.sender_type });
    }
  }

  const senderMap = await repository.findSendersByIds(senderKeys);

  // 결과 조합
  const result: ChatRoomListItem[] = [];

  for (const room of rooms) {
    const members = membersMap.get(room.id) ?? [];
    const lastMessage = lastMessagesMap.get(room.id) ?? null;
    const unreadCount = unreadMap.get(room.id) ?? 0;

    // 1:1인 경우 상대방 정보
    let otherUser: ChatUser | null = null;
    if (room.type === "direct") {
      const otherMember = members.find(
        (m) => !(m.user_id === userId && m.user_type === userType)
      );
      if (otherMember) {
        const key = `${otherMember.user_id}_${otherMember.user_type}`;
        const senderInfo = senderMap.get(key);
        if (senderInfo) {
          otherUser = {
            id: senderInfo.id,
            type: otherMember.user_type,
            name: senderInfo.name,
            profileImageUrl: senderInfo.profileImageUrl,
            schoolName: senderInfo.schoolName,
            gradeDisplay: senderInfo.gradeDisplay,
          };
        }
      }
    }

    // 마지막 메시지 정보
    let lastMessageInfo = null;
    if (lastMessage) {
      const key = `${lastMessage.sender_id}_${lastMessage.sender_type}`;
      const senderInfo = senderMap.get(key);

      // 메시지 타입별 미리보기 텍스트 생성
      let previewContent: string;
      switch (lastMessage.message_type) {
        case "system":
          previewContent = lastMessage.content;
          break;
        case "image":
          previewContent = "사진";
          break;
        case "file":
          previewContent = "파일";
          break;
        case "mixed":
          // 텍스트+첨부 혼합: 텍스트가 있으면 표시, 없으면 대체 텍스트
          previewContent = lastMessage.content
            ? lastMessage.content.length > 50
              ? lastMessage.content.slice(0, 50) + "..."
              : lastMessage.content
            : "파일";
          break;
        default: // "text"
          previewContent = lastMessage.content.length > 50
            ? lastMessage.content.slice(0, 50) + "..."
            : lastMessage.content;
          break;
      }

      lastMessageInfo = {
        content: previewContent,
        messageType: lastMessage.message_type,
        senderName: senderInfo?.name ?? "알 수 없음",
        createdAt: lastMessage.created_at,
      };
    }

    result.push({
      id: room.id,
      type: room.type as ChatRoomType,
      category: (room.category ?? "general") as ChatRoomCategory,
      name: room.name,
      topic: room.topic ?? null,
      status: (room.status ?? "active") as ChatRoomStatus,
      otherUser,
      memberCount: members.length,
      lastMessage: lastMessageInfo,
      unreadCount,
      updatedAt: room.updated_at,
    });
  }

  return result;
}

/**
 * 채팅방 상세 정보 조회
 */
export async function getRoomDetail(
  roomId: string,
  userId: string,
  userType: ChatUserType
): Promise<ChatActionResult<{ room: ChatRoom; members: ChatRoomMemberWithUser[]; otherMemberLeft: boolean }>> {
  try {
    // 방 정보 조회
    const room = await repository.findRoomById(roomId);
    if (!room) {
      return { success: false, error: "채팅방을 찾을 수 없습니다" };
    }

    // 멤버십 확인
    const membership = await repository.findMember(roomId, userId, userType);
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    // 멤버 목록 + 사용자 정보 (배치 쿼리로 N+1 해결)
    const members = await repository.findMembersByRoom(roomId);
    const senderKeys = members.map((m) => ({ id: m.user_id, type: m.user_type }));
    const senderMap = await repository.findSendersByIds(senderKeys);

    const membersWithUser: ChatRoomMemberWithUser[] = members.map((member) => {
      const senderInfo = senderMap.get(`${member.user_id}_${member.user_type}`);
      return {
        ...member,
        user: {
          id: member.user_id,
          type: member.user_type,
          name: senderInfo?.name ?? "알 수 없음",
          profileImageUrl: senderInfo?.profileImageUrl ?? null,
          schoolName: senderInfo?.schoolName ?? null,
          gradeDisplay: senderInfo?.gradeDisplay ?? null,
        },
      };
    });

    // 1:1 채팅에서 상대방 퇴장 상태 확인
    let otherMemberLeft = false;
    if (room.type === "direct") {
      const otherMember = await repository.findOtherMemberInDirectRoom(
        roomId,
        userId,
        userType
      );
      otherMemberLeft = otherMember?.left_at !== null && otherMember?.left_at !== undefined;
    }

    return { success: true, data: { room, members: membersWithUser, otherMemberLeft } };
  } catch (error) {
    console.error("[ChatService] getRoomDetail error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "채팅방 조회 실패",
    };
  }
}
