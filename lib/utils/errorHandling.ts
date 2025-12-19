/**
 * 에러 처리 유틸리티 함수
 * 
 * Supabase 및 애플리케이션 에러를 안전하게 처리하는 유틸리티 함수
 */

import type { PostgrestError } from "@supabase/supabase-js";
import { isPostgrestError } from "@/lib/types/errors";

/**
 * Supabase 에러를 안전하게 처리
 * 
 * @param error - 처리할 에러 객체
 * @returns 에러 메시지 문자열
 */
export function handleSupabaseError(error: unknown): string {
  if (isPostgrestError(error)) {
    // PostgrestError의 경우 상세 정보 반환
    return error.message || "데이터베이스 오류가 발생했습니다.";
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return "알 수 없는 오류가 발생했습니다.";
}

/**
 * 에러에서 상세 정보 추출
 * 
 * @param error - 처리할 에러 객체
 * @returns 에러 상세 정보 객체
 */
export function extractErrorDetails(error: unknown): {
  message: string;
  code?: string;
  details?: unknown;
  hint?: string | null;
} {
  if (isPostgrestError(error)) {
    return {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint ?? null,
    };
  }
  
  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }
  
  return {
    message: "알 수 없는 오류가 발생했습니다.",
  };
}

