/**
 * 에러 타입 정의
 * 
 * Supabase 및 애플리케이션 에러 타입을 정의합니다.
 */

import type { PostgrestError } from "@supabase/supabase-js";

/**
 * PostgrestError 타입 재export
 */
export type { PostgrestError };

/**
 * PostgrestError 타입 가드
 * 
 * @param error - 검사할 에러 객체
 * @returns error가 PostgrestError인지 여부
 */
export function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    "code" in error &&
    "details" in error &&
    "hint" in error
  );
}

/**
 * Supabase 에러 응답 타입
 */
export type SupabaseErrorResponse = {
  error: PostgrestError | null;
  data: null;
};

/**
 * Supabase 성공 응답 타입
 * 
 * @template T - 데이터 타입
 */
export type SupabaseSuccessResponse<T> = {
  error: null;
  data: T;
};

/**
 * Supabase 응답 타입 (성공 또는 실패)
 * 
 * @template T - 데이터 타입
 */
export type SupabaseResponse<T> = SupabaseSuccessResponse<T> | SupabaseErrorResponse;

