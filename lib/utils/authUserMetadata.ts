/**
 * Auth 사용자 메타데이터 조회 유틸리티
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 특정 사용자 ID 목록의 메타데이터만 조회 (전체 조회 대신)
 * 
 * @param adminClient Supabase Admin Client (Service Role Key 필요)
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
    // Supabase Auth에서 사용자 정보 조회
    // 전체 사용자 목록을 조회하되, 필요한 ID만 필터링
    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers();

    if (authError) {
      console.error("[authUserMetadata] Auth 사용자 조회 실패:", authError);
      return metadataMap;
    }

    if (!authData?.users) {
      return metadataMap;
    }

    // 요청된 사용자 ID만 필터링하여 메타데이터 맵 생성
    const userIdSet = new Set(userIds);
    authData.users.forEach((user) => {
      if (userIdSet.has(user.id)) {
        metadataMap.set(user.id, {
          email: user.email || null,
          name: (user.user_metadata?.display_name as string) || null,
        });
      }
    });
  } catch (error) {
    console.error("[authUserMetadata] 사용자 메타데이터 조회 중 오류:", error);
  }

  return metadataMap;
}

/**
 * 전체 Auth 사용자 목록에서 메타데이터 조회 (기존 방식, 하위 호환성 유지)
 * 
 * @param adminClient Supabase Admin Client
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
    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers();

    if (authError) {
      console.error("[authUserMetadata] Auth 사용자 조회 실패:", authError);
      return metadataMap;
    }

    if (!authData?.users) {
      return metadataMap;
    }

    authData.users.forEach((user) => {
      metadataMap.set(user.id, {
        email: user.email || null,
        name: (user.user_metadata?.display_name as string) || null,
      });
    });
  } catch (error) {
    console.error("[authUserMetadata] 전체 사용자 메타데이터 조회 중 오류:", error);
  }

  return metadataMap;
}

