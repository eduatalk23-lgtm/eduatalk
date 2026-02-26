/**
 * 링크 프리뷰 Repository
 */

import { getAdminClientForChat, CHAT_LINK_PREVIEW_COLUMNS } from "./_shared";
import type {
  ChatLinkPreview,
  ChatLinkPreviewInsert,
} from "../types";

/** 링크 프리뷰 삽입 */
export async function insertLinkPreview(
  input: ChatLinkPreviewInsert
): Promise<ChatLinkPreview> {
  const client = getAdminClientForChat();
  const { data, error } = await client
    .from("chat_link_previews")
    .insert([input])
    .select(CHAT_LINK_PREVIEW_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as ChatLinkPreview;
}

/** 메시지 ID 배열로 링크 프리뷰 배치 조회 */
export async function findLinkPreviewsByMessageIds(
  messageIds: string[]
): Promise<Map<string, ChatLinkPreview[]>> {
  const result = new Map<string, ChatLinkPreview[]>();
  if (messageIds.length === 0) return result;

  const client = getAdminClientForChat();
  const { data, error } = await client
    .from("chat_link_previews")
    .select(CHAT_LINK_PREVIEW_COLUMNS)
    .in("message_id", messageIds)
    .order("fetched_at", { ascending: true });

  if (error) throw error;

  for (const preview of (data ?? []) as unknown as ChatLinkPreview[]) {
    const list = result.get(preview.message_id) ?? [];
    list.push(preview);
    result.set(preview.message_id, list);
  }

  return result;
}
