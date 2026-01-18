import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
 * 참고: 스크립트 환경에서도 동작하도록 process.env를 직접 사용합니다.
 * (env 모듈은 모듈 로드 시점에 캐시되어 동적 환경변수 로딩 시 문제 발생)
 *
 * @returns Database 타입이 적용된 Admin 클라이언트 또는 null
 */
export function createSupabaseAdminClient(): SupabaseAdminClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    // 필수 환경변수가 없으면 null 반환 (에러를 던지지 않음)
    // 호출하는 쪽에서 null 체크 후 처리
    return null;
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

