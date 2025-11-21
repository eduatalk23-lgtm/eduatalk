import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/**
 * Supabase Browser Client 생성
 * 브라우저에서 쿠키를 자동으로 관리합니다.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// 기본 export (기존 코드 호환성 유지)
export const supabase = createSupabaseBrowserClient();
