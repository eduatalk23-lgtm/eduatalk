/**
 * 공통 로더 타입 정의
 *
 * @module loaders/types
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Supabase 서버 클라이언트 타입
 */
export type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
