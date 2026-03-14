/**
 * 사용자 메타데이터 조회 유틸리티
 *
 * user_profiles 테이블에서 name, email을 조회한다.
 * 기존 auth.admin.listUsers() 의존을 제거하고 DB 조회로 대체.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logActionError } from "@/lib/logging/actionLogger";

/**
 * 특정 사용자 ID 목록의 메타데이터(name, email) 조회
 *
 * user_profiles 테이블에서 직접 조회 (auth.admin.listUsers 대체)
 *
 * @param adminClient Supabase Client (Admin 또는 Server)
 * @param userIds 조회할 사용자 ID 목록
 * @returns 사용자 ID를 키로 하는 메타데이터 Map
 */
export async function getAuthUserMetadata(
  adminClient: SupabaseClient | null,
  userIds: string[]
): Promise<Map<string, { email: string | null; name: string | null }>> {
  const metadataMap = new Map<string, { email: string | null; name: string | null }>();

  if (!adminClient || userIds.length === 0) {
    return metadataMap;
  }

  try {
    const { data, error } = await adminClient
      .from("user_profiles")
      .select("id, name, email")
      .in("id", userIds);

    if (error) {
      logActionError(
        { domain: "utils", action: "getAuthUserMetadata" },
        error,
        { userIdsCount: userIds.length }
      );
      return metadataMap;
    }

    if (!data) {
      return metadataMap;
    }

    for (const row of data) {
      metadataMap.set(row.id, {
        email: row.email || null,
        name: row.name || null,
      });
    }
  } catch (error) {
    logActionError(
      { domain: "utils", action: "getAuthUserMetadata" },
      error,
      { context: "메타데이터 조회" }
    );
  }

  return metadataMap;
}

/**
 * 전체 사용자 메타데이터(name, email) 조회
 *
 * user_profiles 테이블에서 직접 조회 (auth.admin.listUsers 대체)
 *
 * @param adminClient Supabase Client (Admin 또는 Server)
 * @returns 모든 사용자의 메타데이터 Map
 */
export async function getAllAuthUserMetadata(
  adminClient: SupabaseClient | null
): Promise<Map<string, { email: string | null; name: string | null }>> {
  const metadataMap = new Map<string, { email: string | null; name: string | null }>();

  if (!adminClient) {
    return metadataMap;
  }

  try {
    const { data, error } = await adminClient
      .from("user_profiles")
      .select("id, name, email");

    if (error) {
      logActionError(
        { domain: "utils", action: "getAllAuthUserMetadata" },
        error
      );
      return metadataMap;
    }

    if (!data) {
      return metadataMap;
    }

    for (const row of data) {
      metadataMap.set(row.id, {
        email: row.email || null,
        name: row.name || null,
      });
    }
  } catch (error) {
    logActionError(
      { domain: "utils", action: "getAllAuthUserMetadata" },
      error,
      { context: "전체 메타데이터 조회" }
    );
  }

  return metadataMap;
}
