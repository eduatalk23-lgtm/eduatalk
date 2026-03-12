/**
 * 첨부파일 Repository
 */

import { getAdminClientForChat, CHAT_ATTACHMENT_COLUMNS } from "./_shared";
import type {
  ChatAttachment,
  ChatAttachmentInsert,
} from "../types";

/** 첨부파일 삽입 */
export async function insertAttachment(
  input: ChatAttachmentInsert
): Promise<ChatAttachment> {
  const client = getAdminClientForChat();
  const { data, error } = await client
    .from("chat_attachments")
    .insert([input])
    .select(CHAT_ATTACHMENT_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as ChatAttachment;
}

/** 첨부파일 ID로 조회 */
export async function findAttachmentById(
  attachmentId: string
): Promise<ChatAttachment | null> {
  const client = getAdminClientForChat();
  const { data, error } = await client
    .from("chat_attachments")
    .select(CHAT_ATTACHMENT_COLUMNS)
    .eq("id", attachmentId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as ChatAttachment | null;
}

/** 여러 첨부파일 ID로 조회 */
export async function findAttachmentsByIds(
  attachmentIds: string[]
): Promise<ChatAttachment[]> {
  if (attachmentIds.length === 0) return [];

  const client = getAdminClientForChat();
  const { data, error } = await client
    .from("chat_attachments")
    .select(CHAT_ATTACHMENT_COLUMNS)
    .in("id", attachmentIds);

  if (error) throw error;
  return (data ?? []) as unknown as ChatAttachment[];
}

/** 메시지 ID 배열로 첨부파일 배치 조회 */
export async function findAttachmentsByMessageIds(
  messageIds: string[]
): Promise<Map<string, ChatAttachment[]>> {
  const result = new Map<string, ChatAttachment[]>();
  if (messageIds.length === 0) return result;

  const client = getAdminClientForChat();
  const { data, error } = await client
    .from("chat_attachments")
    .select(CHAT_ATTACHMENT_COLUMNS)
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });

  if (error) throw error;

  for (const attachment of (data ?? []) as unknown as ChatAttachment[]) {
    const list = result.get(attachment.message_id) ?? [];
    list.push(attachment);
    result.set(attachment.message_id, list);
  }

  return result;
}

/** 첨부파일들을 메시지에 연결 (message_id 업데이트) */
export async function linkAttachmentsToMessage(
  messageId: string,
  attachmentIds: string[],
  senderId: string
): Promise<void> {
  if (attachmentIds.length === 0) return;

  const client = getAdminClientForChat();
  const { error } = await client
    .from("chat_attachments")
    .update({ message_id: messageId })
    .in("id", attachmentIds)
    .eq("sender_id", senderId);

  if (error) throw error;
}

/** 첨부파일 삭제 */
export async function deleteAttachment(attachmentId: string): Promise<void> {
  const client = getAdminClientForChat();
  const { error } = await client
    .from("chat_attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) throw error;
}

/** 고아 첨부파일 조회 (message_id IS NULL, N시간 이상 경과, 예약 메시지 미연결) */
export async function findOrphanedAttachments(
  olderThanHours: number = 24,
  limit: number = 100
): Promise<Array<{ id: string; storage_path: string; thumbnail_storage_path: string | null }>> {
  const client = getAdminClientForChat();
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from("chat_attachments")
    .select("id, storage_path, thumbnail_storage_path")
    .is("message_id", null)
    .is("scheduled_message_id", null)
    .lt("created_at", cutoff)
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Array<{ id: string; storage_path: string; thumbnail_storage_path: string | null }>;
}

/** 만료된 첨부파일 조회 (N일 이상 경과, 메시지에 연결된 파일 포함, 예약 메시지 미연결) */
export async function findExpiredAttachments(
  olderThanDays: number = 7,
  limit: number = 100
): Promise<Array<{ id: string; storage_path: string; thumbnail_storage_path: string | null; message_id: string | null }>> {
  const client = getAdminClientForChat();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from("chat_attachments")
    .select("id, storage_path, thumbnail_storage_path, message_id")
    .is("scheduled_message_id", null)
    .lt("created_at", cutoff)
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Array<{ id: string; storage_path: string; thumbnail_storage_path: string | null; message_id: string | null }>;
}

/** 여러 첨부파일 ID로 일괄 삭제 */
export async function deleteAttachmentsByIds(attachmentIds: string[]): Promise<void> {
  if (attachmentIds.length === 0) return;
  const client = getAdminClientForChat();
  const { error } = await client
    .from("chat_attachments")
    .delete()
    .in("id", attachmentIds);

  if (error) throw error;
}

/** 사용자의 채팅 스토리지 사용량 조회 (bytes) */
export async function getUserStorageUsage(senderId: string): Promise<number> {
  const client = getAdminClientForChat();
  const { data, error } = await client
    .rpc("get_chat_storage_usage", { p_sender_id: senderId });

  if (error) throw error;
  return (data as number) ?? 0;
}

/** 채팅방의 첨부파일 조회 (타입별 필터, 페이지네이션) */
export async function findAttachmentsByRoom(
  roomId: string,
  options: {
    attachmentType?: string;
    attachmentTypes?: string[];
    limit?: number;
    cursor?: string; // created_at 기준 커서
  } = {}
): Promise<ChatAttachment[]> {
  const { attachmentType, attachmentTypes, limit = 30, cursor } = options;
  const client = getAdminClientForChat();

  let query = client
    .from("chat_attachments")
    .select(CHAT_ATTACHMENT_COLUMNS)
    .eq("room_id", roomId)
    .not("message_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (attachmentTypes && attachmentTypes.length > 0) {
    query = query.in("attachment_type", attachmentTypes);
  } else if (attachmentType) {
    query = query.eq("attachment_type", attachmentType);
  }

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ChatAttachment[];
}

/** 사용자별 첨부파일 숨기기 (upsert) */
export async function hideAttachmentsForUser(
  userId: string,
  attachmentIds: string[]
): Promise<void> {
  if (attachmentIds.length === 0) return;

  const client = getAdminClientForChat();
  const rows = attachmentIds.map((attachmentId) => ({
    user_id: userId,
    attachment_id: attachmentId,
  }));

  const { error } = await client
    .from("chat_attachment_hidden")
    .upsert(rows, { onConflict: "user_id,attachment_id", ignoreDuplicates: true });

  if (error) throw error;
}

/** 사용자가 특정 방에서 숨긴 첨부파일 ID 조회 */
export async function findHiddenAttachmentIds(
  userId: string,
  roomId: string
): Promise<Set<string>> {
  const client = getAdminClientForChat();

  // chat_attachment_hidden JOIN chat_attachments로 room_id 필터링
  const { data, error } = await client
    .from("chat_attachment_hidden")
    .select("attachment_id, chat_attachments!inner(room_id)")
    .eq("user_id", userId)
    .eq("chat_attachments.room_id", roomId);

  if (error) throw error;

  const ids = new Set<string>();
  for (const row of data ?? []) {
    ids.add(row.attachment_id as string);
  }
  return ids;
}

/** 채팅방 첨부파일 파일명 검색 (ILIKE) */
export async function searchAttachmentsByRoom(
  roomId: string,
  query: string,
  options: {
    attachmentTypes?: string[];
    limit?: number;
    cursor?: string;
  } = {}
): Promise<ChatAttachment[]> {
  const { attachmentTypes, limit = 30, cursor } = options;
  const client = getAdminClientForChat();

  const escapedQuery = query.replace(/[\\%_]/g, "\\$&");

  let q = client
    .from("chat_attachments")
    .select(CHAT_ATTACHMENT_COLUMNS)
    .eq("room_id", roomId)
    .not("message_id", "is", null)
    .ilike("file_name", `%${escapedQuery}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (attachmentTypes && attachmentTypes.length > 0) {
    q = q.in("attachment_type", attachmentTypes);
  }

  if (cursor) {
    q = q.lt("created_at", cursor);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ChatAttachment[];
}
