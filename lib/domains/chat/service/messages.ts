/**
 * 메시지 서비스
 */

import * as repository from "../repository";
import { getUserInfo, rejoinMember, convertReactionsToSummaries, MAX_MESSAGE_LENGTH } from "./_helpers";
import type {
  ChatMessage,
  ChatMessageWithSender,
  ChatUserType,
  SendMessageRequest,
  GetMessagesOptions,
  ChatActionResult,
  PaginatedResult,
  SearchMessagesOptions,
  SearchMessagesResult,
  MessagesWithReadStatusResult,
  ReplyTargetInfo,
} from "../types";

/**
 * 메시지 전송
 */
export async function sendMessage(
  senderId: string,
  senderType: ChatUserType,
  request: SendMessageRequest
): Promise<ChatActionResult<ChatMessage>> {
  try {
    const { roomId, content, messageType = "text", replyToId, clientMessageId, mentions } = request;

    // 메시지 길이 검증
    if (content.length > MAX_MESSAGE_LENGTH) {
      return {
        success: false,
        error: `메시지는 ${MAX_MESSAGE_LENGTH}자를 초과할 수 없습니다`,
      };
    }

    // 빈 메시지 검증 (image/file/mixed 타입은 첨부파일이 있으므로 빈 content 허용)
    if (content.trim().length === 0 && messageType === "text") {
      return { success: false, error: "메시지 내용을 입력해주세요" };
    }

    // 방 정보 조회 (Auto-rejoin 로직을 위해)
    const room = await repository.findRoomById(roomId);
    if (!room) {
      return { success: false, error: "채팅방을 찾을 수 없습니다" };
    }

    // 1:1 채팅방인 경우 상대방 자동 재참여 처리
    if (room.type === "direct") {
      const otherMember = await repository.findOtherMemberInDirectRoom(
        roomId,
        senderId,
        senderType
      );

      if (otherMember && otherMember.left_at !== null) {
        await rejoinMember(roomId, otherMember.user_id, otherMember.user_type);
      }
    }

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

    // 발신자 정보 조회 (비정규화 스냅샷용)
    const senderInfo = await repository.getSenderInfoForInsert(senderId, senderType);

    // 메타데이터 구성 (멘션 등)
    const metadata = mentions && mentions.length > 0 ? { mentions } : null;

    // 메시지 생성 (발신자 스냅샷 포함)
    const message = await repository.insertMessage({
      ...(clientMessageId && { id: clientMessageId }),
      room_id: roomId,
      sender_id: senderId,
      sender_type: senderType,
      message_type: messageType,
      content: content.trim(),
      reply_to_id: replyToId ?? null,
      sender_name: senderInfo.name,
      sender_profile_url: senderInfo.profileImageUrl,
      metadata,
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
 * 비정규화된 스냅샷 사용으로 N+1 문제 완전 해결 (4쿼리 → 3쿼리)
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

    // 병렬로 차단 목록 + 메시지 조회 (visible_from 필터 적용)
    const [blocks, messages] = await Promise.all([
      repository.findBlocksByUser(userId, userType),
      repository.findMessagesByRoom({ ...options, visibleFrom: membership.visible_from }),
    ]);

    const blockedIds = new Set(blocks.map((b) => `${b.blocked_id}_${b.blocked_type}`));

    // 차단되지 않은 메시지만 필터링
    const filteredMessages = messages.filter(
      (m) => !blockedIds.has(`${m.sender_id}_${m.sender_type}`)
    );

    // 첨부파일/링크 프리뷰 배치 조회
    const messageIds = filteredMessages.map((m) => m.id);
    const [attachmentsMap, linkPreviewsMap] = await Promise.all([
      repository.findAttachmentsByMessageIds(messageIds),
      repository.findLinkPreviewsByMessageIds(messageIds),
    ]);

    // 비정규화된 스냅샷 데이터를 sender 필드에 직접 매핑 (별도 조회 불필요)
    const messagesWithSender: ChatMessageWithSender[] = filteredMessages.map((message) => ({
      ...message,
      sender: {
        id: message.sender_id,
        type: message.sender_type,
        name: message.sender_name,
        profileImageUrl: message.sender_profile_url,
      },
      attachments: attachmentsMap.get(message.id) ?? [],
      linkPreviews: linkPreviewsMap.get(message.id) ?? [],
    }));

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
    // 1. 메시지 존재 여부 확인
    const message = await repository.findMessageById(messageId);
    if (!message) {
      return { success: false, error: "메시지를 찾을 수 없습니다" };
    }

    // 2. 본인 메시지인지 확인
    if (message.sender_id !== userId) {
      return { success: false, error: "본인의 메시지만 삭제할 수 있습니다" };
    }

    // 3. 이미 삭제된 메시지인지 확인
    if (message.is_deleted) {
      return { success: false, error: "이미 삭제된 메시지입니다" };
    }

    // 4. 삭제 실행
    await repository.deleteMessage(messageId, userId);
    return { success: true };
  } catch (error) {
    console.error("[ChatService] deleteMessage error:", error);
    // RLS 에러 처리
    if (error instanceof Error && error.message.includes("row-level security")) {
      return { success: false, error: "메시지 삭제 권한이 없습니다" };
    }
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
  newContent: string,
  expectedUpdatedAt?: string
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

    // 7. 수정 실행 (낙관적 잠금 적용)
    const updated = await repository.updateMessageContent(
      messageId,
      trimmedContent,
      expectedUpdatedAt
    );

    // 8. 충돌 감지
    if (!updated) {
      return {
        success: false,
        error: "다른 사용자가 이미 메시지를 수정했습니다. 최신 내용을 확인해주세요.",
        code: "CONFLICT_EDIT",
      };
    }

    return { success: true, data: updated };
  } catch (error) {
    console.error("[ChatService] editMessage error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "메시지 수정 실패",
    };
  }
}

/**
 * 메시지 검색
 * - 채팅방 멤버만 검색 가능
 * - 비정규화된 스냅샷으로 발신자 정보 포함
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

    // 검색 실행 (visible_from 필터 적용)
    const { messages, total } = await repository.searchMessagesByRoom({
      ...options,
      visibleFrom: membership.visible_from,
    });

    // 비정규화된 스냅샷 데이터를 sender 필드에 직접 매핑 (별도 조회 불필요)
    const messagesWithSender: ChatMessageWithSender[] = messages.map((message) => ({
      ...message,
      sender: {
        id: message.sender_id,
        type: message.sender_type,
        name: message.sender_name,
        profileImageUrl: message.sender_profile_url,
      },
    }));

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

/**
 * 메시지 목록 조회 (읽음 상태 + 리액션 + 답장 원본 포함)
 * - 본인 메시지에 대해서만 안 읽은 멤버 수 계산
 * - 차단한 사용자 메시지 필터링
 * - 각 메시지의 리액션 요약 포함
 * - 답장 메시지의 원본 정보 포함
 * - 비정규화된 스냅샷 사용으로 발신자 조회 최적화
 */
export async function getMessagesWithReadStatus(
  userId: string,
  userType: ChatUserType,
  options: GetMessagesOptions
): Promise<ChatActionResult<MessagesWithReadStatusResult>> {
  try {
    const { roomId, limit = 50 } = options;

    // 개발 환경에서 디버깅 로그
    if (process.env.NODE_ENV === "development") {
      console.log("[ChatService] getMessagesWithReadStatus called:", {
        userId,
        userType,
        roomId,
        limit,
        before: options.before,
      });
    }

    // 멤버십 확인
    const membership = await repository.findMember(roomId, userId, userType);

    // 개발 환경에서 멤버십 결과 로그
    if (process.env.NODE_ENV === "development") {
      console.log("[ChatService] Membership check result:", {
        roomId,
        userId,
        userType,
        found: !!membership,
        membershipId: membership?.id,
        leftAt: membership?.left_at,
      });
    }

    if (!membership) {
      return { success: false, error: "채팅방에 참여하지 않았습니다" };
    }

    // 병렬로 차단 목록 + 메시지 + 읽음 상태 조회 (visible_from 필터 적용)
    const [blocks, { messages, readCounts }] = await Promise.all([
      repository.findBlocksByUser(userId, userType),
      repository.findMessagesWithReadCounts({ ...options, visibleFrom: membership.visible_from }, userId),
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

    // 병렬로 리액션 + 답장 원본 + 첨부파일 + 링크 프리뷰 조회
    const [reactionsMap, replyTargetsMap, attachmentsMap, linkPreviewsMap] = await Promise.all([
      repository.findReactionsByMessageIds(messageIds),
      repository.findReplyTargetsByIds(replyToIds),
      repository.findAttachmentsByMessageIds(messageIds),
      repository.findLinkPreviewsByMessageIds(messageIds),
    ]);

    // 메시지에 발신자 정보(스냅샷) + 리액션 + 답장 원본 매핑
    const messagesWithAll = filteredMessages.map((message) => {
      const messageReactions = reactionsMap.get(message.id) ?? [];

      // 답장 원본 정보 매핑 (원본 메시지의 스냅샷 데이터 사용)
      let replyTarget: ReplyTargetInfo | null = null;
      if (message.reply_to_id) {
        const target = replyTargetsMap.get(message.reply_to_id);
        if (target) {
          // message_type → attachmentType 변환
          const attachmentType =
            target.message_type === "image" ? "image" as const
            : target.message_type === "file" ? "file" as const
            : target.message_type === "mixed" ? "mixed" as const
            : undefined;

          replyTarget = {
            id: target.id,
            content: target.is_deleted ? "삭제된 메시지입니다" : target.content,
            senderName: target.sender_name ?? "알 수 없음",
            isDeleted: target.is_deleted,
            attachmentType,
          };
        }
      }

      return {
        ...message,
        // 비정규화된 스냅샷 데이터 직접 사용
        sender: {
          id: message.sender_id,
          type: message.sender_type,
          name: message.sender_name,
          profileImageUrl: message.sender_profile_url,
        },
        reactions: convertReactionsToSummaries(messageReactions, userId, userType),
        replyTarget,
        attachments: attachmentsMap.get(message.id) ?? [],
        linkPreviews: linkPreviewsMap.get(message.id) ?? [],
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
    // Supabase 에러는 { code, message, details, hint } 형태의 객체
    // Error 인스턴스가 아니므로 별도 처리 필요
    const errorMessage = error instanceof Error
      ? error.message
      : (error as { message?: string })?.message ?? "메시지 조회 실패";

    console.error("[ChatService] getMessagesWithReadStatus error:", {
      message: errorMessage,
      code: (error as { code?: string })?.code,
      details: (error as { details?: string })?.details,
      hint: (error as { hint?: string })?.hint,
      raw: JSON.stringify(error),
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}
