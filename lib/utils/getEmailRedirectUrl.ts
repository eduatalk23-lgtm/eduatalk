/**
 * 이메일 인증 리다이렉트 URL 유틸리티
 * Supabase 이메일 인증 링크의 리다이렉트 URL을 생성합니다.
 */

import { headers } from "next/headers";
import { getBaseUrl } from "./getBaseUrl";

/**
 * 이메일 인증 리다이렉트 URL 생성
 * 
 * 프로덕션 환경에서 이메일 인증 링크가 올바른 도메인으로 리다이렉트되도록 합니다.
 * 
 * @returns 이메일 인증 콜백 URL (예: https://yourdomain.com/auth/callback)
 */
export async function getEmailRedirectUrl(): Promise<string> {
  const headersList = await headers();
  const baseUrl = getBaseUrl(headersList);
  return `${baseUrl}/auth/callback`;
}

