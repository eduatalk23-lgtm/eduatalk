/**
 * Chat 도메인 Service
 * 채팅 비즈니스 로직
 */

import * as repository from "./repository";
import type {
  ChatRoom,
  ChatRoomMemberWithUser,
  ChatMessage,
  ChatRoomListItem,
  ChatMessageWithSender,
  ChatUser,
  ChatUserType,
  ChatRoomType,
  CreateChatRoomRequest,
  SendMessageRequest,
  GetMessagesOptions,
  GetRoomsOptions,
  ChatActionResult,
  PaginatedResult,
  SearchMessagesOptions,
  SearchMessagesResult,
  MessagesWithReadStatusResult,
  ReactionToggleInput,
  ReactionSummary,
  MessageReaction,
  PinMessageInput,
  PinnedMessageWithContent,
  AnnouncementInfo,
  SetAnnouncementInput,
} from "./types";

// 최대 메시지 길이
const MAX_MESSAGE_LENGTH = 1000;

// ============================================
// 사용자 정보 조회 헬퍼
// ============================================

/**
 * 사용자 정보 조회 (student 또는 admin)
 */
async function getUserInfo(
  userId: string,
  userType: ChatUserType
): Promise<ChatUser | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  if (userType === "student") {
    const { data } = await supabase
      .from("students")
      .select("id, name")
      .eq("id", userId)
      .maybeSingle();

    if (!data) return null;

    // 프로필 이미지 조회
    const { data: profile } = await supabase
      .from("student_profiles")
      .select("profile_image_url")
      .eq("id", userId)
      .maybeSingle();

    return {
      id: data.id,
      type: "student",
      name: data.name,
      profileImageUrl: profile?.profile_image_url ?? null,
    };
  } else {
    // admin (admin_users 테이블에서 조회)
    const { data } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!data) return null;

    // auth.users에서 이름 가져오기
    // 참고: admin 이름은 user_metadata에서 가져와야 할 수 있음
    return {
      id: data.id,
      type: "admin",
      name: "관리자", // TODO: 실제 이름 조회 로직 추가
      profileImageUrl: null,
    };
  }
}

// ============================================
// 채팅방 서비스
// ============================================

/**
 * 채팅방 생성 또는 기존 방 반환 (1:1의 경우)
 */
export async function createOrGetRoom(
  tenantId: string,
  creatorId: string,
  creatorType: ChatUserType,
  request: CreateChatRoomRequest
): Promise<ChatActionResult<ChatRoom>> {
  try {
    const { type, name, memberIds, memberTypes } = request;

    // 1:1 채팅인 경우 기존 방 확인
    if (type === "direct" && memberIds.length === 1) {
      const existingRoom = await repository.findDirectRoom(
        creatorId,
        creatorType,
        memberIds[0],
        memberTypes[0]
      );

      if (existingRoom) {
        return { success: true, data: existingRoom };
      }
    }

    // 새 방 생성
    const room = await repository.insertRoom({
      tenant_id: tenantId,
      type,
      name: type === "group" ? name ?? null : null,
      created_by: creatorId,
      created_by_type: creatorType,
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
          };
        }
      }
    }

    // 마지막 메시지 정보
    let lastMessageInfo = null;
    if (lastMessage) {
      const key = `${lastMessage.sender_id}_${lastMessage.sender_type}`;
      const senderInfo = senderMap.get(key);
      lastMessageInfo = {
        content:
          lastMessage.message_type === "system"
            ? lastMessage.content
            : lastMessage.content.length > 50
            ? lastMessage.content.slice(0, 50) + "..."
            : lastMessage.content,
        senderName: senderInfo?.name ?? "알 수 없음",
        createdAt: lastMessage.created_at,
      };
    }

    result.push({
      id: room.id,
      type: room.type as ChatRoomType,
      name: room.name,
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
): Promise<ChatActionResult<{ room: ChatRoom; members: ChatRoomMemberWithUser[] }>> {
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

    // 멤버 목록 + 사용자 정보
    const members = await repository.findMembersByRoom(roomId);
    const membersWithUser: ChatRoomMemberWithUser[] = await Promise.all(
      members.map(async (member) => ({
        ...member,
        user: await getUserInfo(member.user_id, member.user_type) ?? {
          id: member.user_id,
          type: member.user_type,
          name: "알 수 없음",
          profileImageUrl: null,
        },
      }))
    );

    return { success: true, data: { room, members: membersWithUser } };
  } catch (error) {
    console.error("[ChatService] getRoomDetail error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "채팅방 조회 실패",
    };
  }
}

// ============================================
// 메시지 서비스
// ============================================

/**
 * 메시지 전송
 */
export async function sendMessage(
  senderId: string,
  senderType: ChatUserType,
  request: SendMessageRequest
): Promise<ChatActionResult<ChatMessage>> {
  try {
    const { roomId, content, messageType = "text", replyToId } = request;

    // 메시지 길이 검증
    if (content.length > MAX_MESSAGE_LENGTH) {
      return {
        success: false,
        error: `메시지는 ${MAX_MESSAGE_LENGTH}자를 초과할 수 없습니다`,
      };
    }

    // 빈 메시지 검증
    if (content.trim().length === 0) {
      return { success: false, error: "메시지 내용을 입력해주세요" };
    }

    // 멤버십은 RLS INSERT 정책이 DB 레벨에서 검증 (별도 조회 불필요)

    // 답장 대상 메시지 검증 (있는 경우)
    if (replyToId) {
      const targetMessage = await repository.findMessageById(replyToId);
      if (!targetMessage) {
        return { success: false, error: "답장 대상 메시지를 찾을 수 없습니다" };
      }
      if (targetMessage.room_id !== roomId) {
        return { success: false, error: "같은 채팅방의 메시지에만 답장할 수 있습니다" };
      }
    }

    // 메시지 생성
    const message = await repository.insertMessage({
      room_id: roomId,
      sender_id: senderId,
      sender_type: senderType,
      message_type: messageType,
      content: content.trim(),
      reply_to_id: replyToId ?? null,
    });

    return { success: true, data: message };
  } catch (error) {
    console.error("[ChatService] sendMessage error:", error);
    // RLS 위반 시 친절한 에러 메시지 반환
    if (error instanceof Error && error.message.includes("row-level security")) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 전송 실패",
    };
  }
}

/**
 * 메시지 목록 조회 (발신자 정보 포함)
 * 배치 쿼리로 N+1 문제 해결 (51쿼리 → 4쿼리)
 */
export async function getMessages(
  userId: string,
  userType: ChatUserType,
  options: GetMessagesOptions
): Promise<ChatActionResult<PaginatedResult<ChatMessageWithSender>>> {
  try {
    const { roomId, limit = 50 } = options;

    // 멤버십 확인
    const membership = await repository.findMember(roomId, userId, userType);
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    // 병렬로 차단 목록 + 메시지 조회
    const [blocks, messages] = await Promise.all([
      repository.findBlocksByUser(userId, userType),
      repository.findMessagesByRoom(options),
    ]);

    const blockedIds = new Set(blocks.map((b) => `${b.blocked_id}_${b.blocked_type}`));

    // 차단되지 않은 메시지만 필터링
    const filteredMessages = messages.filter(
      (m) => !blockedIds.has(`${m.sender_id}_${m.sender_type}`)
    );

    // 발신자 정보 배치 조회 (1-2 쿼리로 모든 발신자 정보 가져옴)
    const senderKeys = filteredMessages.map((m) => ({
      id: m.sender_id,
      type: m.sender_type,
    }));
    const senderMap = await repository.findSendersByIds(senderKeys);

    // 메시지에 발신자 정보 매핑
    const messagesWithSender: ChatMessageWithSender[] = filteredMessages.map((message) => {
      const key = `${message.sender_id}_${message.sender_type}`;
      const senderInfo = senderMap.get(key);

      return {
        ...message,
        sender: senderInfo
          ? {
              id: senderInfo.id,
              type: message.sender_type,
              name: senderInfo.name,
              profileImageUrl: senderInfo.profileImageUrl,
            }
          : {
              id: message.sender_id,
              type: message.sender_type,
              name: "알 수 없음",
            },
      };
    });

    return {
      success: true,
      data: {
        data: messagesWithSender,
        hasMore: messages.length === limit,
        nextCursor: messages.length > 0 ? messages[0].created_at : undefined,
      },
    };
  } catch (error) {
    console.error("[ChatService] getMessages error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 조회 실패",
    };
  }
}

/**
 * 메시지 삭제
 */
export async function deleteMessage(
  messageId: string,
  userId: string
): Promise<ChatActionResult<void>> {
  try {
    await repository.deleteMessage(messageId, userId);
    return { success: true };
  } catch (error) {
    console.error("[ChatService] deleteMessage error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 삭제 실패",
    };
  }
}

/**
 * 읽음 처리
 */
export async function markRoomAsRead(
  roomId: string,
  userId: string,
  userType: ChatUserType
): Promise<ChatActionResult<void>> {
  try {
    await repository.markAsRead(roomId, userId, userType);
    return { success: true };
  } catch (error) {
    console.error("[ChatService] markRoomAsRead error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "읽음 처리 실패",
    };
  }
}

// ============================================
// 멤버 서비스
// ============================================

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

    // 새로 추가할 멤버들 필터링
    const newMembers: Array<{
      room_id: string;
      user_id: string;
      user_type: ChatUserType;
      role: "member";
      last_read_at: string;
    }> = [];

    for (let i = 0; i < memberIds.length; i++) {
      const key = `${memberIds[i]}_${memberTypes[i]}`;
      if (!existingMembers.has(key)) {
        newMembers.push({
          room_id: roomId,
          user_id: memberIds[i],
          user_type: memberTypes[i],
          role: "member",
          // 이전 대화를 볼 수 있도록 last_read_at을 epoch으로 설정
          last_read_at: "1970-01-01T00:00:00Z",
        });
      }
    }

    // 배치로 멤버 추가 (N+1 → 1 쿼리)
    if (newMembers.length > 0) {
      await repository.insertMembersBatch(newMembers);
    }

    // 시스템 메시지 추가
    const inviterInfo = await getUserInfo(inviterId, inviterType);
    await repository.insertMessage({
      room_id: roomId,
      sender_id: inviterId,
      sender_type: inviterType,
      message_type: "system",
      content: `${inviterInfo?.name ?? "사용자"}님이 새 멤버를 초대했습니다`,
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

    // left_at 설정
    await repository.updateMember(roomId, userId, userType, {
      left_at: new Date().toISOString(),
    });

    // 시스템 메시지
    const userInfo = await getUserInfo(userId, userType);
    await repository.insertMessage({
      room_id: roomId,
      sender_id: userId,
      sender_type: userType,
      message_type: "system",
      content: `${userInfo?.name ?? "사용자"}님이 채팅방을 나갔습니다`,
    });

    return { success: true };
  } catch (error) {
    console.error("[ChatService] leaveRoom error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "채팅방 나가기 실패",
    };
  }
}

// ============================================
// 차단/신고 서비스
// ============================================

/**
 * 사용자 차단
 */
export async function blockUser(
  blockerId: string,
  blockerType: ChatUserType,
  blockedId: string,
  blockedType: ChatUserType
): Promise<ChatActionResult<void>> {
  try {
    // 이미 차단했는지 확인
    const alreadyBlocked = await repository.isBlocked(
      blockerId,
      blockerType,
      blockedId,
      blockedType
    );

    if (alreadyBlocked) {
      return { success: false, error: "이미 차단한 사용자입니다" };
    }

    await repository.insertBlock({
      blocker_id: blockerId,
      blocker_type: blockerType,
      blocked_id: blockedId,
      blocked_type: blockedType,
    });

    return { success: true };
  } catch (error) {
    console.error("[ChatService] blockUser error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "차단 실패",
    };
  }
}

/**
 * 차단 해제
 */
export async function unblockUser(
  blockerId: string,
  blockerType: ChatUserType,
  blockedId: string,
  blockedType: ChatUserType
): Promise<ChatActionResult<void>> {
  try {
    await repository.deleteBlock(blockerId, blockerType, blockedId, blockedType);
    return { success: true };
  } catch (error) {
    console.error("[ChatService] unblockUser error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "차단 해제 실패",
    };
  }
}

/**
 * 메시지 신고
 */
export async function reportMessage(
  reporterId: string,
  reporterType: ChatUserType,
  messageId: string,
  reason: string,
  description?: string
): Promise<ChatActionResult<void>> {
  try {
    await repository.insertReport({
      reporter_id: reporterId,
      reporter_type: reporterType,
      reported_message_id: messageId,
      reason: reason as "spam" | "harassment" | "inappropriate" | "hate_speech" | "other",
      description: description ?? null,
    });

    return { success: true };
  } catch (error) {
    console.error("[ChatService] reportMessage error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "신고 실패",
    };
  }
}

// ============================================
// 메시지 편집 서비스
// ============================================

/** 메시지 수정 가능 시간 (5분) */
const MAX_EDIT_TIME_MS = 5 * 60 * 1000;

/**
 * 메시지 편집
 * - 본인 메시지만 수정 가능
 * - 전송 후 5분 이내만 수정 가능
 */
export async function editMessage(
  userId: string,
  userType: ChatUserType,
  messageId: string,
  newContent: string
): Promise<ChatActionResult<ChatMessage>> {
  try {
    // 1. 메시지 조회
    const message = await repository.findMessageById(messageId);
    if (!message) {
      return { success: false, error: "메시지를 찾을 수 없습니다" };
    }

    // 2. 본인 메시지인지 확인
    if (message.sender_id !== userId || message.sender_type !== userType) {
      return { success: false, error: "본인 메시지만 수정할 수 있습니다" };
    }

    // 3. 삭제된 메시지인지 확인
    if (message.is_deleted) {
      return { success: false, error: "삭제된 메시지는 수정할 수 없습니다" };
    }

    // 4. 시스템 메시지인지 확인
    if (message.message_type === "system") {
      return { success: false, error: "시스템 메시지는 수정할 수 없습니다" };
    }

    // 5. 수정 가능 시간 확인 (5분 이내)
    const createdAt = new Date(message.created_at).getTime();
    if (Date.now() - createdAt > MAX_EDIT_TIME_MS) {
      return { success: false, error: "메시지 수정 가능 시간(5분)이 지났습니다" };
    }

    // 6. 내용 검증
    const trimmedContent = newContent.trim();
    if (!trimmedContent) {
      return { success: false, error: "메시지 내용을 입력해주세요" };
    }
    if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
      return {
        success: false,
        error: `메시지는 ${MAX_MESSAGE_LENGTH}자를 초과할 수 없습니다`,
      };
    }

    // 7. 수정 실행
    const updated = await repository.updateMessageContent(messageId, trimmedContent);

    return { success: true, data: updated };
  } catch (error) {
    console.error("[ChatService] editMessage error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 수정 실패",
    };
  }
}

// ============================================
// 메시지 검색 서비스
// ============================================

/**
 * 메시지 검색
 * - 채팅방 멤버만 검색 가능
 * - 발신자 정보 포함
 */
export async function searchMessages(
  userId: string,
  userType: ChatUserType,
  options: SearchMessagesOptions
): Promise<ChatActionResult<SearchMessagesResult>> {
  try {
    const { roomId, query } = options;

    // 검색어 검증
    if (!query.trim()) {
      return { success: false, error: "검색어를 입력해주세요" };
    }

    // 멤버십 확인
    const membership = await repository.findMember(roomId, userId, userType);
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    // 검색 실행
    const { messages, total } = await repository.searchMessagesByRoom(options);

    // 발신자 정보 배치 조회
    const senderKeys = messages.map((m) => ({
      id: m.sender_id,
      type: m.sender_type,
    }));
    const senderMap = await repository.findSendersByIds(senderKeys);

    // 메시지에 발신자 정보 매핑
    const messagesWithSender: ChatMessageWithSender[] = messages.map((message) => {
      const key = `${message.sender_id}_${message.sender_type}`;
      const senderInfo = senderMap.get(key);

      return {
        ...message,
        sender: senderInfo
          ? {
              id: senderInfo.id,
              type: message.sender_type,
              name: senderInfo.name,
              profileImageUrl: senderInfo.profileImageUrl,
            }
          : {
              id: message.sender_id,
              type: message.sender_type,
              name: "알 수 없음",
            },
      };
    });

    return {
      success: true,
      data: {
        messages: messagesWithSender,
        total,
        query: query.trim(),
      },
    };
  } catch (error) {
    console.error("[ChatService] searchMessages error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 검색 실패",
    };
  }
}

// ============================================
// 읽음 표시 서비스
// ============================================

/**
 * 리액션 목록을 요약으로 변환
 */
function convertReactionsToSummaries(
  reactions: MessageReaction[],
  currentUserId: string,
  currentUserType: ChatUserType
): ReactionSummary[] {
  // 이모지별 그룹핑
  const emojiMap = new Map<string, { count: number; hasReacted: boolean }>();

  for (const reaction of reactions) {
    const existing = emojiMap.get(reaction.emoji) ?? { count: 0, hasReacted: false };
    existing.count += 1;
    if (reaction.user_id === currentUserId && reaction.user_type === currentUserType) {
      existing.hasReacted = true;
    }
    emojiMap.set(reaction.emoji, existing);
  }

  // ReactionSummary 배열로 변환
  const summaries: ReactionSummary[] = [];
  for (const [emoji, data] of emojiMap) {
    summaries.push({
      emoji: emoji as ReactionSummary["emoji"],
      count: data.count,
      hasReacted: data.hasReacted,
    });
  }

  return summaries;
}

/**
 * 메시지 목록 조회 (읽음 상태 + 리액션 + 답장 원본 포함)
 * - 본인 메시지에 대해서만 안 읽은 멤버 수 계산
 * - 차단한 사용자 메시지 필터링
 * - 각 메시지의 리액션 요약 포함
 * - 답장 메시지의 원본 정보 포함
 */
export async function getMessagesWithReadStatus(
  userId: string,
  userType: ChatUserType,
  options: GetMessagesOptions
): Promise<ChatActionResult<MessagesWithReadStatusResult>> {
  try {
    const { roomId, limit = 50 } = options;

    // 멤버십 확인
    const membership = await repository.findMember(roomId, userId, userType);
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    // 병렬로 차단 목록 + 메시지 + 읽음 상태 조회
    const [blocks, { messages, readCounts }] = await Promise.all([
      repository.findBlocksByUser(userId, userType),
      repository.findMessagesWithReadCounts(options, userId),
    ]);

    const blockedIds = new Set(blocks.map((b) => `${b.blocked_id}_${b.blocked_type}`));

    // 차단되지 않은 메시지만 필터링
    const filteredMessages = messages.filter(
      (m) => !blockedIds.has(`${m.sender_id}_${m.sender_type}`)
    );

    // 필터링된 메시지의 readCounts만 유지
    const filteredReadCounts: Record<string, number> = {};
    for (const msg of filteredMessages) {
      filteredReadCounts[msg.id] = readCounts[msg.id] ?? 0;
    }

    // 메시지 ID 목록 + 답장 원본 ID 수집
    const messageIds = filteredMessages.map((m) => m.id);
    const replyToIds = filteredMessages
      .map((m) => m.reply_to_id)
      .filter((id): id is string => id !== null);

    // 병렬로 발신자 + 리액션 + 답장 원본 조회
    const [senderMap, reactionsMap, replyTargetsMap] = await Promise.all([
      repository.findSendersByIds(
        filteredMessages.map((m) => ({ id: m.sender_id, type: m.sender_type }))
      ),
      repository.findReactionsByMessageIds(messageIds),
      repository.findReplyTargetsByIds(replyToIds),
    ]);

    // 답장 원본 발신자 정보도 배치 조회
    const replyTargetSenderKeys = Array.from(replyTargetsMap.values()).map((t) => ({
      id: t.sender_id,
      type: t.sender_type,
    }));
    const replyTargetSenderMap = await repository.findSendersByIds(replyTargetSenderKeys);

    // 메시지에 발신자 정보 + 리액션 + 답장 원본 매핑
    const messagesWithAll = filteredMessages.map((message) => {
      const key = `${message.sender_id}_${message.sender_type}`;
      const senderInfo = senderMap.get(key);
      const messageReactions = reactionsMap.get(message.id) ?? [];

      // 답장 원본 정보 매핑
      let replyTarget: { id: string; content: string; senderName: string; isDeleted: boolean } | null = null;
      if (message.reply_to_id) {
        const target = replyTargetsMap.get(message.reply_to_id);
        if (target) {
          const targetSenderInfo = replyTargetSenderMap.get(`${target.sender_id}_${target.sender_type}`);
          replyTarget = {
            id: target.id,
            content: target.is_deleted ? "삭제된 메시지입니다" : target.content,
            senderName: targetSenderInfo?.name ?? "알 수 없음",
            isDeleted: target.is_deleted,
          };
        }
      }

      return {
        ...message,
        sender: senderInfo
          ? {
              id: senderInfo.id,
              type: message.sender_type,
              name: senderInfo.name,
              profileImageUrl: senderInfo.profileImageUrl,
            }
          : {
              id: message.sender_id,
              type: message.sender_type,
              name: "알 수 없음",
            },
        reactions: convertReactionsToSummaries(messageReactions, userId, userType),
        replyTarget,
      };
    });

    return {
      success: true,
      data: {
        messages: messagesWithAll,
        readCounts: filteredReadCounts,
        hasMore: messages.length === limit,
      },
    };
  } catch (error) {
    console.error("[ChatService] getMessagesWithReadStatus error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 조회 실패",
    };
  }
}

// ============================================
// 리액션 서비스
// ============================================

/**
 * 리액션 토글
 * - 리액션이 없으면 추가, 있으면 삭제
 * - 채팅방 멤버만 리액션 가능
 * - 삭제된 메시지에는 리액션 불가
 */
export async function toggleReaction(
  userId: string,
  userType: ChatUserType,
  input: ReactionToggleInput
): Promise<ChatActionResult<{ added: boolean }>> {
  try {
    const { messageId, emoji } = input;

    // 1. 메시지 조회
    const message = await repository.findMessageById(messageId);
    if (!message) {
      return { success: false, error: "메시지를 찾을 수 없습니다" };
    }

    // 2. 삭제된 메시지인지 확인
    if (message.is_deleted) {
      return { success: false, error: "삭제된 메시지에는 리액션할 수 없습니다" };
    }

    // 3. 채팅방 멤버십 확인
    const membership = await repository.findMember(message.room_id, userId, userType);
    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    // 4. 기존 리액션 존재 여부 확인
    const hasExisting = await repository.hasReaction({
      messageId,
      userId,
      userType,
      emoji,
    });

    // 5. 토글 실행
    if (hasExisting) {
      // 기존 리액션 삭제
      await repository.deleteReaction({
        messageId,
        userId,
        userType,
        emoji,
      });
      return { success: true, data: { added: false } };
    } else {
      // 새 리액션 추가
      await repository.insertReaction({
        messageId,
        userId,
        userType,
        emoji,
      });
      return { success: true, data: { added: true } };
    }
  } catch (error) {
    console.error("[ChatService] toggleReaction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "리액션 처리 실패",
    };
  }
}

// ============================================
// 고정 메시지 서비스
// ============================================

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

// ============================================
// 공지 서비스
// ============================================

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
