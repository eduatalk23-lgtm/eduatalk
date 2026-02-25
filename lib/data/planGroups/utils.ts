/**
 * 플랜 그룹 공통 유틸리티 함수
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Supabase 클라이언트 생성 (Admin 모드 지원)
 */
export async function getSupabaseClient(useAdminClient: boolean = false): Promise<SupabaseClient> {
  if (useAdminClient) {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[getSupabaseClient] Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용");
      }
      return await createSupabaseServerClient();
    }
    return adminClient;
  }
  return await createSupabaseServerClient();
}
