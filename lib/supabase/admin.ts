import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service Role Key를 사용하는 Supabase Admin 클라이언트
 * 주의: 이 클라이언트는 RLS를 우회하므로 서버 사이드에서만 사용해야 합니다.
 */
export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    // Service Role Key가 없으면 null 반환 (에러를 던지지 않음)
    // 호출하는 쪽에서 null 체크 후 처리
    return null;
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

