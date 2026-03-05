/**
 * Drive Storage Helpers (server-only)
 * Private 버킷용 signed URL 생성 및 파일 업로드/삭제
 */

import { createSupabaseAdminClient, type SupabaseAdminClient } from "@/lib/supabase/admin";

const STORAGE_BUCKET = "drive-files";
const SIGNED_URL_EXPIRES_IN = 60 * 60 * 24 * 7; // 7일

function getAdminClient(): SupabaseAdminClient {
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
      console.error("[DriveStorage] createSignedUrl error:", error.message);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error("[DriveStorage] createSignedUrl unexpected error:", err);
    return null;
  }
}

/**
 * 배치 signed URL 생성
 */
export async function createSignedUrls(
  storagePaths: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (storagePaths.length === 0) return result;

  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(storagePaths, SIGNED_URL_EXPIRES_IN);

    if (error || !data) return result;

    for (const item of data) {
      if (item.signedUrl && item.path) {
        result.set(item.path, item.signedUrl);
      }
    }
  } catch (err) {
    console.error("[DriveStorage] createSignedUrls error:", err);
  }
  return result;
}

/**
 * Storage에 파일 업로드
 */
export async function uploadFile(
  storagePath: string,
  file: Buffer,
  contentType: string
): Promise<{ path: string } | null> {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error("[DriveStorage] upload error:", error.message);
      return null;
    }
    return { path: data.path };
  } catch (err) {
    console.error("[DriveStorage] upload unexpected error:", err);
    return null;
  }
}

/**
 * Storage에서 파일 삭제 (배치)
 */
export async function deleteFiles(storagePaths: string[]): Promise<boolean> {
  if (storagePaths.length === 0) return true;

  try {
    const supabase = getAdminClient();
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(storagePaths);

    if (error) {
      console.error("[DriveStorage] delete error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[DriveStorage] delete unexpected error:", err);
    return false;
  }
}
