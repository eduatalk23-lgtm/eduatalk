/**
 * Chat Attachment Cleanup Service
 *
 * 1. 고아 첨부파일: 업로드 후 24시간 내 메시지에 연결되지 않은 파일
 * 2. 만료 첨부파일: 7일 이상 경과한 모든 첨부파일 (Storage + DB 삭제)
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import * as repository from "./repository";

const STORAGE_BUCKET = "chat-attachments";
const BATCH_SIZE = 50;
const ORPHAN_THRESHOLD_HOURS = 24;
const EXPIRY_THRESHOLD_DAYS = 7;

interface CleanupResult {
  success: boolean;
  orphanedDeleted: number;
  expiredDeleted: number;
  storageDeletedCount: number;
  errors: string[];
}

export async function cleanupChatAttachments(): Promise<CleanupResult> {
  const errors: string[] = [];
  let orphanedDeleted = 0;
  let expiredDeleted = 0;
  let totalStorageDeleted = 0;

  try {
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return { success: false, orphanedDeleted: 0, expiredDeleted: 0, storageDeletedCount: 0, errors: ["Admin client not available"] };
    }

    // Phase 1: 고아 첨부파일 정리 (24시간)
    let hasMore = true;
    while (hasMore) {
      const orphaned = await repository.findOrphanedAttachments(ORPHAN_THRESHOLD_HOURS, BATCH_SIZE);
      if (orphaned.length === 0) { hasMore = false; break; }

      const deleted = await deleteAttachmentBatch(supabase, orphaned, errors);
      orphanedDeleted += deleted.dbCount;
      totalStorageDeleted += deleted.storageCount;

      if (orphaned.length < BATCH_SIZE) hasMore = false;
    }

    // Phase 2: 만료 첨부파일 정리 (7일)
    hasMore = true;
    while (hasMore) {
      const expired = await repository.findExpiredAttachments(EXPIRY_THRESHOLD_DAYS, BATCH_SIZE);
      if (expired.length === 0) { hasMore = false; break; }

      // 메시지에 연결된 첨부파일의 message_id를 수집하여 메시지 타입 갱신
      const affectedMessageIds = [
        ...new Set(expired.filter((a) => a.message_id).map((a) => a.message_id!)),
      ];

      const deleted = await deleteAttachmentBatch(supabase, expired, errors);
      expiredDeleted += deleted.dbCount;
      totalStorageDeleted += deleted.storageCount;

      // 삭제 후: 해당 메시지에 남은 첨부파일이 없으면 message_type을 'text'로 전환
      for (const msgId of affectedMessageIds) {
        try {
          const remaining = await repository.findAttachmentsByMessageIds([msgId]);
          const remainingList = remaining.get(msgId) ?? [];
          if (remainingList.length === 0) {
            await supabase
              .from("chat_messages")
              .update({ message_type: "text" })
              .eq("id", msgId);
          }
        } catch (msgErr) {
          errors.push(`Message type update error (${msgId}): ${msgErr instanceof Error ? msgErr.message : String(msgErr)}`);
        }
      }

      if (expired.length < BATCH_SIZE) hasMore = false;
    }

    return {
      success: errors.length === 0,
      orphanedDeleted,
      expiredDeleted,
      storageDeletedCount: totalStorageDeleted,
      errors,
    };
  } catch (err) {
    return {
      success: false,
      orphanedDeleted,
      expiredDeleted,
      storageDeletedCount: totalStorageDeleted,
      errors: [...errors, err instanceof Error ? err.message : String(err)],
    };
  }
}

/** Storage 파일 + DB 레코드 배치 삭제 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deleteAttachmentBatch(
  supabase: any,
  attachments: Array<{ id: string; storage_path: string; thumbnail_storage_path: string | null }>,
  errors: string[]
): Promise<{ dbCount: number; storageCount: number }> {
  let storageCount = 0;

  // Storage 경로 수집
  const storagePaths: string[] = [];
  for (const att of attachments) {
    storagePaths.push(att.storage_path);
    if (att.thumbnail_storage_path) {
      storagePaths.push(att.thumbnail_storage_path);
    }
  }

  // Storage 파일 삭제
  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(storagePaths);

    if (storageError) {
      errors.push(`Storage delete error: ${storageError.message}`);
    } else {
      storageCount = storagePaths.length;
    }
  }

  // DB 레코드 삭제
  const ids = attachments.map((a) => a.id);
  await repository.deleteAttachmentsByIds(ids);

  return { dbCount: ids.length, storageCount };
}

/** 하위 호환: 기존 cron route에서 호출하는 함수명 */
export const cleanupOrphanedAttachments = cleanupChatAttachments;
