/**
 * Chat Storage Helpers (server-only)
 * Private 버킷용 signed URL 생성 유틸리티
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const STORAGE_BUCKET = "chat-attachments";

/** Signed URL 유효 기간 (초) - 7일 */
const SIGNED_URL_EXPIRES_IN = 60 * 60 * 24 * 7;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdminClient(): any {
  const client = createSupabaseAdminClient();
  if (!client) throw new Error("Admin client not available");
  return client;
}

/**
 * 단일 파일의 signed URL 생성 (7일 만료)
 */
export async function createSignedUrl(
  storagePath: string,
  expiresIn: number = SIGNED_URL_EXPIRES_IN
): Promise<string | null> {
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error("[ChatStorage] createSignedUrl error:", error.message);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error("[ChatStorage] createSignedUrl unexpected error:", err);
    return null;
  }
}

/**
 * 만료된 첨부파일 URL 갱신 (배치)
 * signed URL을 재생성하고 DB도 업데이트
 */
export async function refreshExpiredAttachmentUrls(
  attachments: Array<{ id: string; storage_path: string; thumbnail_storage_path: string | null }>
): Promise<Map<string, { publicUrl: string; thumbnailUrl: string | null }>> {
  const result = new Map<string, { publicUrl: string; thumbnailUrl: string | null }>();
  if (attachments.length === 0) return result;

  try {
    const supabase = getAdminClient();

    // 모든 path 수집
    const allPaths: string[] = [];
    for (const a of attachments) {
      allPaths.push(a.storage_path);
      if (a.thumbnail_storage_path) {
        allPaths.push(a.thumbnail_storage_path);
      }
    }

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(allPaths, SIGNED_URL_EXPIRES_IN);

    if (error || !data) return result;

    const urlMap = new Map<string, string>();
    for (const item of data) {
      if (item.signedUrl && item.path) {
        urlMap.set(item.path, item.signedUrl);
      }
    }

    // 각 첨부파일의 DB 업데이트 + 결과 매핑
    for (const a of attachments) {
      const publicUrl = urlMap.get(a.storage_path);
      if (!publicUrl) continue;

      const thumbnailUrl = a.thumbnail_storage_path
        ? (urlMap.get(a.thumbnail_storage_path) ?? null)
        : null;

      // DB 업데이트
      const updateData: Record<string, string> = { public_url: publicUrl };
      if (thumbnailUrl) updateData.thumbnail_url = thumbnailUrl;

      await supabase
        .from("chat_attachments")
        .update(updateData)
        .eq("id", a.id);

      result.set(a.id, { publicUrl, thumbnailUrl });
    }
  } catch (err) {
    console.error("[ChatStorage] refreshExpiredAttachmentUrls error:", err);
  }

  return result;
}
