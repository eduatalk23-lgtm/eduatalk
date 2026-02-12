/**
 * Google OAuth 콜백
 * GET /api/auth/google/callback?code=...&state=...
 *
 * 코드 → 토큰 교환 후 DB 저장, 설정 페이지로 리다이렉트
 */

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import {
  exchangeCodeForTokens,
  parseOAuthState,
  saveToken,
} from "@/lib/domains/googleCalendar";
import { createAuthenticatedClient } from "@/lib/domains/googleCalendar/oauth";

const SETTINGS_URL = "/admin/settings/google-calendar";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");

  // 사용자가 동의 거부
  if (errorParam) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=consent_denied`, request.url)
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=missing_params`, request.url)
    );
  }

  // state 검증 (CSRF 방지)
  const state = parseOAuthState(stateParam);
  if (!state) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=invalid_state`, request.url)
    );
  }

  // 현재 로그인 사용자와 state의 adminUserId 일치 확인
  const { userId } = await getCurrentUserRole();
  if (!userId || userId !== state.adminUserId) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=user_mismatch`, request.url)
    );
  }

  try {
    // 코드 → 토큰 교환
    const tokens = await exchangeCodeForTokens(code);

    // Google 이메일 조회
    const auth = createAuthenticatedClient({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    const oauth2 = google.oauth2({ version: "v2", auth });
    const { data: userInfo } = await oauth2.userinfo.get();

    // DB 저장 (Admin Client 사용 - RLS 우회)
    const adminClient = await getSupabaseClientForRLSBypass({
      forceAdmin: true,
      fallbackToServer: false,
    });

    if (!adminClient) {
      return NextResponse.redirect(
        new URL(`${SETTINGS_URL}?error=server_error`, request.url)
      );
    }

    const result = await saveToken(adminClient, {
      adminUserId: state.adminUserId,
      tenantId: state.tenantId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expiry_date),
      scope: tokens.scope,
      googleEmail: userInfo.email ?? undefined,
    });

    if (!result.success) {
      return NextResponse.redirect(
        new URL(`${SETTINGS_URL}?error=save_failed`, request.url)
      );
    }

    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?success=connected`, request.url)
    );
  } catch (error) {
    console.error("[api/auth/google/callback] 오류:", error);
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=exchange_failed`, request.url)
    );
  }
}
