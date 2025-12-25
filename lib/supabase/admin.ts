import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Admin 클라이언트 타입 (Database 타입 포함)
 * SupabaseServerClient와 호환되어 이중 단언(as unknown as) 불필요
 */
export type SupabaseAdminClient = SupabaseClient<Database>;

/**
 * Service Role Key를 사용하는 Supabase Admin 클라이언트
 * 주의: 이 클라이언트는 RLS를 우회하므로 서버 사이드에서만 사용해야 합니다.
 *
 * @returns Database 타입이 적용된 Admin 클라이언트 또는 null
 */
export function createSupabaseAdminClient(): SupabaseAdminClient | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    // Service Role Key가 없으면 null 반환 (에러를 던지지 않음)
    // 호출하는 쪽에서 null 체크 후 처리
    return null;
  }

  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

