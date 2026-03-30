"use server";

/**
 * Scheduled Message Server Actions
 * 예약 메시지 생성/조회/수정/취소/즉시전송
 */

import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import * as repository from "../repository";
import { getAdminClientForChat } from "../repository/_shared";
import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import { isUUID } from "@/lib/types/guards";
import type {
  ChatActionResult,
  ChatUserType,
  ScheduledMessage,
  ScheduledMessageInsert,
  ScheduledMessageUpdate,
  ScheduledMessageStatus,
  ChatMessage,
} from "../types";
import { getUserType } from "../types";
import { routeNotification } from "@/lib/domains/notification/router";

// ============================================
// 상수
// ============================================

/** 최소 예약 시간 (현재 + 1분) */
const MIN_SCHEDULE_OFFSET_MS = 60_000;
/** 최대 예약 기간 (7일) — 첨부파일 7일 만료 정책과 정합 */
const MAX_SCHEDULE_OFFSET_MS = 7 * 24 * 60 * 60 * 1000;
/** 사용자당 최대 pending 예약 수 */
const MAX_PENDING_PER_USER = 50;
/** 같은 분에 같은 room으로 최대 예약 수 */
const MAX_SAME_MINUTE_PER_ROOM = 5;

// ============================================
// 예약 생성
// ============================================

/**
 * 메시지 예약 전송
 */
export async function scheduleMessageAction(
  roomId: string,
  content: string,
  scheduledAt: string,
  options?: {
    replyToId?: string | null;
    attachmentIds?: string[];
    timezone?: string;
  }
): Promise<ChatActionResult<ScheduledMessage>> {
  try {
    // 1. 인증
    const { userId, role, tenantId } = await getCachedUserRole();
    if (!userId || !role || !tenantId) {
      return { success: false, error: "인증이 필요합니다" };
    }

    // 2. 입력 검증
    if (!isUUID(roomId)) {
      return { success: false, error: "유효하지 않은 채팅방 ID입니다" };
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0 || trimmedContent.length > 1000) {
      return { success: false, error: "메시지는 1~1000자여야 합니다" };
    }

    // 3. 시간 검증
    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return { success: false, error: "유효하지 않은 날짜입니다" };
    }

    const now = Date.now();
    const scheduledTime = scheduledDate.getTime();

    if (scheduledTime < now + MIN_SCHEDULE_OFFSET_MS) {
      return { success: false, error: "최소 1분 후부터 예약할 수 있습니다" };
    }

    if (scheduledTime > now + MAX_SCHEDULE_OFFSET_MS) {
      return { success: false, error: "최대 7일 이내로 예약할 수 있습니다" };
    }

    // 4. reply_to_id 검증
    if (options?.replyToId && !isUUID(options.replyToId)) {
      return { success: false, error: "유효하지 않은 답장 대상입니다" };
    }

    const client = getAdminClientForChat();
    const userType = getUserType(role);

    // 5. 채팅방 멤버십 확인
    const { data: member } = await client
      .from("chat_room_members")
      .select("user_id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .is("left_at", null)
      .maybeSingle();

    if (!member) {
      return { success: false, error: "채팅방 멤버가 아닙니다" };
    }

    // 6. 예약 수 제한 체크
    const limitCheck = await checkScheduleLimits(client, userId, roomId, scheduledAt);
    if (!limitCheck.success) {
      return { success: false, error: limitCheck.error };
    }

    // 7. 발신자 스냅샷 캡처
    const senderInfo = await repository.getSenderInfoForInsert(userId, userType);

    // 8. INSERT
    const insertData: ScheduledMessageInsert & { tenant_id: string } = {
      room_id: roomId,
      sender_id: userId,
      sender_type: userType,
      content: trimmedContent,
      reply_to_id: options?.replyToId ?? undefined,
      sender_name_snapshot: senderInfo.name,
      sender_profile_url_snapshot: senderInfo.profileImageUrl,
      tenant_id: tenantId,
      scheduled_at: scheduledDate.toISOString(),
      timezone: options?.timezone ?? "Asia/Seoul",
    };

    const { data: scheduled, error: insertError } = await client
      .from("scheduled_messages")
      .insert(insertData)
      .select("*")
      .single();

    if (insertError) {
      console.error("[schedule-message] INSERT 실패:", insertError.message);
      return { success: false, error: "예약 생성에 실패했습니다" };
    }

    // 9. 첨부파일 연결
    if (options?.attachmentIds && options.attachmentIds.length > 0) {
      await client
        .from("chat_attachments")
        .update({ scheduled_message_id: scheduled.id })
        .in("id", options.attachmentIds)
        .eq("sender_id", userId);
    }

    return { success: true, data: scheduled as ScheduledMessage };
  } catch (err) {
    console.error("[schedule-message] Error:", err);
    return { success: false, error: "예약 전송 중 오류가 발생했습니다" };
  }
}

// ============================================
// 예약 목록 조회
// ============================================

/**
 * 예약 메시지 목록 조회
 */
export async function getScheduledMessagesAction(options?: {
  roomId?: string;
  status?: ScheduledMessageStatus | "all";
}): Promise<ChatActionResult<ScheduledMessage[]>> {
  try {
    const { userId } = await getCachedUserRole();
    if (!userId) {
      return { success: false, error: "인증이 필요합니다" };
    }

    const client = getAdminClientForChat();

    let query = client
      .from("scheduled_messages")
      .select("*")
      .eq("sender_id", userId)
      .order("scheduled_at", { ascending: true });

    if (options?.roomId) {
      query = query.eq("room_id", options.roomId);
    }

    if (options?.status && options.status !== "all") {
      query = query.eq("status", options.status);
    } else if (!options?.status) {
      // 기본: pending + failed (활성 예약만)
      query = query.in("status", ["pending", "failed"]);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: "예약 메시지 조회에 실패했습니다" };
    }

    return { success: true, data: (data ?? []) as ScheduledMessage[] };
  } catch (err) {
    console.error("[get-scheduled-messages] Error:", err);
    return { success: false, error: "조회 중 오류가 발생했습니다" };
  }
}

// ============================================
// 예약 수정
// ============================================

/**
 * 예약 메시지 수정 (pending 상태만)
 */
export async function updateScheduledMessageAction(
  id: string,
  updates: ScheduledMessageUpdate
): Promise<ChatActionResult<ScheduledMessage>> {
  try {
    const { userId } = await getCachedUserRole();
    if (!userId) {
      return { success: false, error: "인증이 필요합니다" };
    }

    if (!isUUID(id)) {
      return { success: false, error: "유효하지 않은 ID입니다" };
    }

    const client = getAdminClientForChat();

    // 기존 예약 확인
    const { data: existing } = await client
      .from("scheduled_messages")
      .select("*")
      .eq("id", id)
      .eq("sender_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (!existing) {
      return { success: false, error: "수정 가능한 예약 메시지를 찾을 수 없습니다" };
    }

    // 내용 검증
    const updateData: Record<string, unknown> = {};

    if (updates.content !== undefined) {
      const trimmed = updates.content.trim();
      if (trimmed.length === 0 || trimmed.length > 1000) {
        return { success: false, error: "메시지는 1~1000자여야 합니다" };
      }
      updateData.content = trimmed;
    }

    // 시간 검증
    if (updates.scheduled_at !== undefined) {
      const newDate = new Date(updates.scheduled_at);
      if (isNaN(newDate.getTime())) {
        return { success: false, error: "유효하지 않은 날짜입니다" };
      }

      const now = Date.now();
      if (newDate.getTime() < now + MIN_SCHEDULE_OFFSET_MS) {
        return { success: false, error: "최소 1분 후부터 예약할 수 있습니다" };
      }
      if (newDate.getTime() > now + MAX_SCHEDULE_OFFSET_MS) {
        return { success: false, error: "최대 7일 이내로 예약할 수 있습니다" };
      }

      updateData.scheduled_at = newDate.toISOString();
    }

    if (updates.timezone !== undefined) {
      updateData.timezone = updates.timezone;
    }

    if (updates.metadata !== undefined) {
      updateData.metadata = updates.metadata;
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "수정할 내용이 없습니다" };
    }

    const { data: updated, error: updateError } = await client
      .from("scheduled_messages")
      .update(updateData)
      .eq("id", id)
      .eq("sender_id", userId)
      .eq("status", "pending")
      .select("*")
      .single();

    if (updateError) {
      return { success: false, error: "수정에 실패했습니다" };
    }

    return { success: true, data: updated as ScheduledMessage };
  } catch (err) {
    console.error("[update-scheduled-message] Error:", err);
    return { success: false, error: "수정 중 오류가 발생했습니다" };
  }
}

// ============================================
// 예약 취소
// ============================================

/**
 * 예약 메시지 취소
 */
export async function cancelScheduledMessageAction(
  id: string
): Promise<ChatActionResult> {
  try {
    const { userId } = await getCachedUserRole();
    if (!userId) {
      return { success: false, error: "인증이 필요합니다" };
    }

    if (!isUUID(id)) {
      return { success: false, error: "유효하지 않은 ID입니다" };
    }

    const client = getAdminClientForChat();

    // pending 상태만 취소 가능
    const { data: updated, error } = await client
      .from("scheduled_messages")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("sender_id", userId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error || !updated) {
      return { success: false, error: "취소할 수 있는 예약 메시지를 찾을 수 없습니다" };
    }

    // 첨부파일 연결 해제 (cleanup 대상 복귀)
    await client
      .from("chat_attachments")
      .update({ scheduled_message_id: null })
      .eq("scheduled_message_id", id);

    return { success: true };
  } catch (err) {
    console.error("[cancel-scheduled-message] Error:", err);
    return { success: false, error: "취소 중 오류가 발생했습니다" };
  }
}

// ============================================
// 즉시 전송
// ============================================

/**
 * 예약 메시지 즉시 전송
 */
export async function sendScheduledMessageNowAction(
  id: string
): Promise<ChatActionResult<ChatMessage>> {
  try {
    const { userId, role } = await getCachedUserRole();
    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다" };
    }

    if (!isUUID(id)) {
      return { success: false, error: "유효하지 않은 ID입니다" };
    }

    const client = getAdminClientForChat();
    const userType = getUserType(role);

    // pending 상태 확인 + claim
    const { data: scheduled, error: fetchError } = await client
      .from("scheduled_messages")
      .select("*")
      .eq("id", id)
      .eq("sender_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (fetchError || !scheduled) {
      return { success: false, error: "즉시 전송할 수 있는 예약 메시지를 찾을 수 없습니다" };
    }

    const msg = scheduled as ScheduledMessage;

    // status → sending
    await client
      .from("scheduled_messages")
      .update({ status: "sending" })
      .eq("id", id);

    // 발신자 정보 재조회
    let senderName = msg.sender_name_snapshot;
    let senderProfileUrl = msg.sender_profile_url_snapshot;
    try {
      const info = await repository.getSenderInfoForInsert(userId, userType);
      senderName = info.name;
      senderProfileUrl = info.profileImageUrl;
    } catch {
      // snapshot fallback
    }

    // chat_messages INSERT
    const insertedMessage = await repository.insertMessage({
      room_id: msg.room_id,
      sender_id: userId,
      sender_type: userType,
      content: msg.content,
      message_type: msg.message_type,
      reply_to_id: msg.reply_to_id ?? undefined,
      sender_name: senderName,
      sender_profile_url: senderProfileUrl,
      metadata: msg.metadata,
    });

    // 첨부파일 이전
    const { data: attachments } = await client
      .from("chat_attachments")
      .select("id")
      .eq("scheduled_message_id", id);

    if (attachments && attachments.length > 0) {
      const attachmentIds = attachments.map((a: { id: string }) => a.id);
      await repository.linkAttachmentsToMessage(insertedMessage.id, attachmentIds, userId);
      await client
        .from("chat_attachments")
        .update({ scheduled_message_id: null })
        .eq("scheduled_message_id", id);
    }

    // status → sent
    await client
      .from("scheduled_messages")
      .update({
        status: "sent",
        sent_message_id: insertedMessage.id,
        sent_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Push 알림 (fire-and-forget)
    sendPushForMessage(msg.room_id, userId, insertedMessage).catch((err) =>
      console.error("[send-now] Push 실패:", err instanceof Error ? err.message : String(err))
    );

    return { success: true, data: insertedMessage };
  } catch (err) {
    console.error("[send-now] Error:", err);
    return { success: false, error: "즉시 전송 중 오류가 발생했습니다" };
  }
}

// ============================================
// 예약 메시지 삭제 (failed/cancelled 정리)
// ============================================

/**
 * 실패/취소된 예약 메시지 삭제
 */
export async function deleteScheduledMessageAction(
  id: string
): Promise<ChatActionResult> {
  try {
    const { userId } = await getCachedUserRole();
    if (!userId) {
      return { success: false, error: "인증이 필요합니다" };
    }

    if (!isUUID(id)) {
      return { success: false, error: "유효하지 않은 ID입니다" };
    }

    const client = getAdminClientForChat();

    // 첨부파일 연결 해제
    await client
      .from("chat_attachments")
      .update({ scheduled_message_id: null })
      .eq("scheduled_message_id", id);

    // 삭제 (pending/failed/cancelled만 — RLS에서도 제한)
    const { error } = await client
      .from("scheduled_messages")
      .delete()
      .eq("id", id)
      .eq("sender_id", userId)
      .in("status", ["pending", "failed", "cancelled"]);

    if (error) {
      return { success: false, error: "삭제에 실패했습니다" };
    }

    return { success: true };
  } catch (err) {
    console.error("[delete-scheduled-message] Error:", err);
    return { success: false, error: "삭제 중 오류가 발생했습니다" };
  }
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 예약 수 제한 체크
 */
async function checkScheduleLimits(
  client: SupabaseAdminClient,
  userId: string,
  roomId: string,
  scheduledAt: string
): Promise<ChatActionResult> {
  // 1. 사용자당 최대 pending 예약 수
  const { count: pendingCount } = await client
    .from("scheduled_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", userId)
    .eq("status", "pending");

  if ((pendingCount ?? 0) >= MAX_PENDING_PER_USER) {
    return { success: false, error: `최대 ${MAX_PENDING_PER_USER}개까지 예약할 수 있습니다` };
  }

  // 2. 같은 분에 같은 room으로 최대 예약 수
  const scheduledDate = new Date(scheduledAt);
  const minuteStart = new Date(scheduledDate);
  minuteStart.setSeconds(0, 0);
  const minuteEnd = new Date(minuteStart.getTime() + 60_000);

  const { count: sameMinuteCount } = await client
    .from("scheduled_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", userId)
    .eq("room_id", roomId)
    .eq("status", "pending")
    .gte("scheduled_at", minuteStart.toISOString())
    .lt("scheduled_at", minuteEnd.toISOString());

  if ((sameMinuteCount ?? 0) >= MAX_SAME_MINUTE_PER_ROOM) {
    return { success: false, error: `같은 시각에 최대 ${MAX_SAME_MINUTE_PER_ROOM}개까지 예약할 수 있습니다` };
  }

  return { success: true };
}

/**
 * 메시지 발송 후 Push 알림 (즉시전송용)
 */
async function sendPushForMessage(
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

  await routeNotification({
    type: isDirect ? "chat_message" : "chat_group_message",
    recipientIds,
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
