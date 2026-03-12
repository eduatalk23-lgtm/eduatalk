/**
 * 예약 메시지 발송 프로세서
 *
 * pg_cron → API Route에서 매분 호출.
 * pending 상태이며 scheduled_at이 도래한 메시지를 조회하여 발송합니다.
 */

import { getAdminClientForChat } from "../repository/_shared";
import * as repository from "../repository";
import { routeNotification } from "@/lib/domains/notification/router";
import type {
  ScheduledMessage,
  ScheduledMessageValidation,
  ChatMessage,
  ChatUserType,
} from "../types";

/** 한 cycle에서 처리할 최대 건수 */
const BATCH_LIMIT = 50;
/** 같은 사용자의 메시지를 한 cycle에서 최대 발송 수 */
const PER_USER_BATCH_LIMIT = 10;

export interface ProcessResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * 발송 대기 중인 예약 메시지를 처리합니다.
 *
 * 동시 실행 방지: status를 'sending'으로 원자적 전환하여 처리 중인 메시지를
 * 다른 프로세스가 가져가지 않도록 합니다.
 */
export async function processScheduledMessages(): Promise<ProcessResult> {
  const client = getAdminClientForChat();
  const result: ProcessResult = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  // 1. 발송 대상을 조회하면서 동시에 status → 'sending'으로 전환 (원자적)
  //    RPC로 FOR UPDATE SKIP LOCKED 패턴 구현
  const { data: pending, error: fetchError } = await client
    .rpc("claim_pending_scheduled_messages", {
      batch_limit: BATCH_LIMIT,
    });

  if (fetchError) {
    console.error("[scheduled-messages] 조회 실패:", fetchError.message);
    throw fetchError;
  }

  if (!pending || pending.length === 0) {
    return result;
  }

  console.log("[scheduled-messages] 발송 대상:", {
    claimed: pending.length,
  });

  // 2. 사용자별 배치 제한 적용
  const userCounts = new Map<string, number>();
  const toProcess: ScheduledMessage[] = [];
  const skippedIds: string[] = [];

  for (const msg of pending as ScheduledMessage[]) {
    const count = userCounts.get(msg.sender_id) ?? 0;
    if (count >= PER_USER_BATCH_LIMIT) {
      skippedIds.push(msg.id);
      result.skipped++;
      continue;
    }
    userCounts.set(msg.sender_id, count + 1);
    toProcess.push(msg);
  }

  // 2-1. 스킵된 메시지는 pending으로 복구 (claim에서 sending + attempts+1 됨)
  if (skippedIds.length > 0) {
    await client
      .from("scheduled_messages")
      .update({ status: "pending" })
      .in("id", skippedIds);

    console.log("[scheduled-messages] 사용자별 배치 제한 초과, pending 복구:", {
      skippedCount: skippedIds.length,
    });
  }

  // 3. 각 메시지 처리
  for (const scheduled of toProcess) {
    result.processed++;

    try {
      // 3-1. status는 이미 claim_pending_scheduled_messages에서 'sending'으로 전환됨

      // 3-2. 유효성 재검증
      const validation = await validateScheduledMessage(scheduled);
      if (!validation.valid) {
        console.warn("[scheduled-messages] 유효성 실패:", {
          id: scheduled.id,
          reason: validation.reason,
        });
        await markFailed(client, scheduled.id, validation.reason ?? "유효성 검증 실패");
        result.failed++;
        continue;
      }

      // 3-3. 발신자 정보 재조회 + snapshot fallback
      const senderInfo = await getSenderInfoWithFallback(scheduled);

      // 3-4. chat_messages INSERT
      const insertedMessage = await repository.insertMessage({
        room_id: scheduled.room_id,
        sender_id: scheduled.sender_id,
        sender_type: scheduled.sender_type as ChatUserType,
        content: scheduled.content,
        message_type: scheduled.message_type,
        reply_to_id: scheduled.reply_to_id ?? undefined,
        sender_name: senderInfo.name,
        sender_profile_url: senderInfo.profileImageUrl,
        metadata: scheduled.metadata,
      });

      // 3-5. 첨부파일 연결 (scheduled_message_id → message_id로 이전)
      await linkScheduledAttachments(client, scheduled.id, insertedMessage.id, scheduled.sender_id);

      // 3-6. status → sent
      await client
        .from("scheduled_messages")
        .update({
          status: "sent",
          sent_message_id: insertedMessage.id,
          sent_at: new Date().toISOString(),
        })
        .eq("id", scheduled.id);

      // 3-7. Push 알림 (fire-and-forget)
      sendScheduledMessagePush(scheduled.room_id, scheduled.sender_id, insertedMessage).catch(
        (err) =>
          console.error("[scheduled-messages] Push 실패:", {
            messageId: insertedMessage.id,
            error: err instanceof Error ? err.message : String(err),
          })
      );

      result.sent++;
    } catch (err) {
      console.error("[scheduled-messages] 발송 실패:", {
        id: scheduled.id,
        error: err instanceof Error ? err.message : String(err),
      });

      await handleSendFailure(client, scheduled, err);
      result.failed++;
    }
  }

  return result;
}

/**
 * 예약 메시지 발송 전 유효성 재검증
 */
async function validateScheduledMessage(
  msg: ScheduledMessage
): Promise<ScheduledMessageValidation> {
  const client = getAdminClientForChat();

  // 1. 채팅방 존재 + 아카이브 확인
  const { data: room } = await client
    .from("chat_rooms")
    .select("id, archived_at, is_active")
    .eq("id", msg.room_id)
    .maybeSingle();

  if (!room) {
    return { valid: false, reason: "채팅방이 존재하지 않습니다" };
  }
  if (room.archived_at) {
    return { valid: false, reason: "채팅방이 아카이브되었습니다" };
  }
  if (room.is_active === false) {
    return { valid: false, reason: "비활성 채팅방입니다" };
  }

  // 2. 발신자 멤버십 확인
  const { data: member } = await client
    .from("chat_room_members")
    .select("user_id, left_at")
    .eq("room_id", msg.room_id)
    .eq("user_id", msg.sender_id)
    .maybeSingle();

  if (!member) {
    return { valid: false, reason: "채팅방 멤버가 아닙니다" };
  }
  if (member.left_at) {
    return { valid: false, reason: "채팅방에서 퇴장한 상태입니다" };
  }

  return { valid: true };
}

/**
 * 발신자 정보 재조회, 실패 시 스냅샷 사용
 */
async function getSenderInfoWithFallback(
  msg: ScheduledMessage
): Promise<{ name: string; profileImageUrl: string | null }> {
  try {
    const info = await repository.getSenderInfoForInsert(
      msg.sender_id,
      msg.sender_type as ChatUserType
    );
    return info;
  } catch {
    // 탈퇴/삭제 등으로 조회 실패 시 스냅샷 사용
    return {
      name: msg.sender_name_snapshot,
      profileImageUrl: msg.sender_profile_url_snapshot,
    };
  }
}

/**
 * 예약 메시지의 첨부파일을 실제 메시지에 연결
 */
async function linkScheduledAttachments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  scheduledMessageId: string,
  messageId: string,
  senderId: string
): Promise<void> {
  const { data: attachments } = await client
    .from("chat_attachments")
    .select("id")
    .eq("scheduled_message_id", scheduledMessageId);

  if (!attachments || attachments.length === 0) return;

  const attachmentIds = attachments.map((a: { id: string }) => a.id);
  await repository.linkAttachmentsToMessage(messageId, attachmentIds, senderId);

  // scheduled_message_id 해제 (cleanup 대상 복귀)
  await client
    .from("chat_attachments")
    .update({ scheduled_message_id: null })
    .eq("scheduled_message_id", scheduledMessageId);
}

/**
 * 예약 메시지 발송 후 Push 알림 전송
 * sendChatPushNotification과 동일한 로직
 */
async function sendScheduledMessagePush(
  roomId: string,
  senderId: string,
  message: ChatMessage
): Promise<void> {
  const room = await repository.findRoomById(roomId);
  if (!room) return;

  const members = await repository.findMembersByRoom(roomId);
  const recipientIds = members
    .filter((m) => m.user_id !== senderId && !m.left_at)
    .map((m) => m.user_id);

  if (recipientIds.length === 0) return;

  const isDirect = room.type === "direct";
  const title = isDirect
    ? (message.sender_name ?? "새 메시지")
    : (room.name ?? "그룹 채팅");
  const body = isDirect
    ? message.content.slice(0, 100)
    : `${message.sender_name ?? "알 수 없음"}: ${message.content.slice(0, 100)}`;

  // 멘션 분리
  const mentionedUserIds = new Set(
    (message.metadata?.mentions ?? [])
      .map((m) => m.userId)
      .filter((id) => id !== senderId && recipientIds.includes(id))
  );

  const normalRecipientIds = recipientIds.filter((id) => !mentionedUserIds.has(id));

  if (normalRecipientIds.length > 0) {
    await routeNotification({
      type: isDirect ? "chat_message" : "chat_group_message",
      recipientIds: normalRecipientIds,
      payload: {
        title,
        body,
        url: `/chat/${roomId}`,
        tag: `chat-${roomId}`,
      },
      priority: "normal",
      source: "server_action",
      referenceId: `${roomId}:${message.id}`,
      messageCreatedAt: message.created_at,
    });
  }

  if (mentionedUserIds.size > 0) {
    const senderName = message.sender_name ?? "알 수 없음";
    await routeNotification({
      type: "chat_mention",
      recipientIds: Array.from(mentionedUserIds),
      payload: {
        title: isDirect ? senderName : (room.name ?? "그룹 채팅"),
        body: `${senderName}님이 회원님을 언급했습니다: ${message.content.slice(0, 80)}`,
        url: `/chat/${roomId}`,
        tag: `chat-mention-${roomId}`,
      },
      priority: "high",
      source: "server_action",
      referenceId: `${roomId}:${message.id}:mention`,
      messageCreatedAt: message.created_at,
    });
  }
}

/**
 * 발송 실패 처리: attempts 초과 시 failed, 아니면 pending으로 복구
 */
async function handleSendFailure(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  msg: ScheduledMessage,
  err: unknown
): Promise<void> {
  const errorMessage = err instanceof Error ? err.message : String(err);
  // attempts는 claim RPC의 RETURNING *으로 이미 +1된 값이 반환됨
  const currentAttempts = msg.attempts;

  if (currentAttempts >= msg.max_attempts) {
    await markFailed(client, msg.id, `최대 재시도 횟수 초과: ${errorMessage}`);
  } else {
    // pending으로 복구 → 다음 cycle에서 재시도
    await client
      .from("scheduled_messages")
      .update({
        status: "pending",
        last_error: errorMessage,
      })
      .eq("id", msg.id);
  }
}

/**
 * 예약 메시지를 failed 상태로 전환
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function markFailed(client: any, id: string, reason: string): Promise<void> {
  await client
    .from("scheduled_messages")
    .update({ status: "failed", last_error: reason })
    .eq("id", id);
}
