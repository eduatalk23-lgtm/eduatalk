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
  ChatMessageType,
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

    // 생성자(owner) + 다른 멤버들 병렬 배치 추가 (2 RTT → 1 RTT)
    const memberInsertTasks: Promise<unknown>[] = [
      repository.insertMember({
        room_id: room.id,
        user_id: creatorId,
        user_type: creatorType,
        role: "owner",
      }),
    ];

    if (memberIds.length > 0) {
      memberInsertTasks.push(
        repository.insertMembersBatch(
          memberIds.map((id, i) => ({
            room_id: room.id,
            user_id: id,
            user_type: memberTypes[i],
            role: "member" as const,
          }))
        )
      );
    }

    await Promise.all(memberInsertTasks);

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

  // 멤버 정보 조회 (last_message는 chat_rooms에 역정규화됨 → RPC 불필요)
  const membersMap = await repository.findMembersByRoomIds(roomIds);

  // 내 멤버십 정보로 last_read_at 맵 생성
  const membershipMap = new Map<string, { last_read_at: string; is_muted: boolean }>();
  for (const roomId of roomIds) {
    const members = membersMap.get(roomId) ?? [];
    const myMembership = members.find(
      (m) => m.user_id === userId && m.user_type === userType
    );
    if (myMembership) {
      membershipMap.set(roomId, { last_read_at: myMembership.last_read_at, is_muted: myMembership.is_muted });
    }
  }

  // 발신자 키 추출 (동기 — membersMap만 필요)
  const senderKeys: Array<{ id: string; type: ChatUserType }> = [];
  for (const room of rooms) {
    if (room.type === "direct") {
      const members = membersMap.get(room.id) ?? [];
      const otherMember = members.find(
        (m) => !(m.user_id === userId && m.user_type === userType)
      );
      if (otherMember) {
        senderKeys.push({ id: otherMember.user_id, type: otherMember.user_type });
      }
    }
  }

  // 안 읽은 메시지 수 + 발신자 정보를 병렬 조회
  const [unreadMap, senderMap] = await Promise.all([
    repository.countUnreadByRoomIds(roomIds, userId, membershipMap),
    senderKeys.length > 0
      ? repository.findSendersByIds(senderKeys)
      : Promise.resolve(new Map<string, { id: string; name: string; profileImageUrl?: string; schoolName?: string; gradeDisplay?: string }>()),
  ]);

  // 결과 조합
  const result: ChatRoomListItem[] = [];

  for (const room of rooms) {
    const members = membersMap.get(room.id) ?? [];
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

    // 마지막 메시지 정보 (역정규화된 컬럼에서 직접 조회)
    let lastMessageInfo = null;
    if (room.last_message_at && room.last_message_content !== null) {
      const msgType = room.last_message_type ?? "text";
      let previewContent: string;
      switch (msgType) {
        case "system":
          previewContent = room.last_message_content;
          break;
        case "image":
          previewContent = "사진";
          break;
        case "file":
          previewContent = "파일";
          break;
        case "mixed":
          previewContent = room.last_message_content
            ? room.last_message_content.length > 50
              ? room.last_message_content.slice(0, 50) + "..."
              : room.last_message_content
            : "파일";
          break;
        default:
          previewContent = room.last_message_content.length > 50
            ? room.last_message_content.slice(0, 50) + "..."
            : room.last_message_content;
          break;
      }

      lastMessageInfo = {
        content: previewContent,
        messageType: msgType as ChatMessageType,
        senderName: room.last_message_sender_name ?? "알 수 없음",
        createdAt: room.last_message_at,
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
      isMuted: membershipMap.get(room.id)?.is_muted ?? false,
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
    // Phase 1: 방 정보 + 멤버십 확인 병렬 조회 (2 RTT → 1 RTT)
    const [room, membership] = await Promise.all([
      repository.findRoomById(roomId),
      repository.findMember(roomId, userId, userType),
    ]);

    if (!room) {
      return { success: false, error: "채팅방을 찾을 수 없습니다" };
    }
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    // Phase 2: 멤버 목록 + 1:1 상대방 퇴장 상태 병렬 조회 (2 RTT → 1 RTT)
    const [members, otherMember] = await Promise.all([
      repository.findMembersByRoom(roomId),
      room.type === "direct"
        ? repository.findOtherMemberInDirectRoom(roomId, userId, userType)
        : Promise.resolve(null),
    ]);

    const otherMemberLeft = otherMember?.left_at !== null && otherMember?.left_at !== undefined;

    // Phase 3: 사용자 정보 배치 조회
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

    return { success: true, data: { room, members: membersWithUser, otherMemberLeft } };
  } catch (error) {
    console.error("[ChatService] getRoomDetail error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "채팅방 조회 실패",
    };
  }
}
