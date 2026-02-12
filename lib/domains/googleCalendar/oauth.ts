/**
 * Google OAuth2 클라이언트 생성 및 인증 URL 관리
 */

import { google } from "googleapis";
import type { OAuthStatePayload } from "./types";
import { GOOGLE_CALENDAR_SCOPES } from "./types";

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google Calendar OAuth 환경 변수가 설정되지 않았습니다.");
  }

  return { clientId, clientSecret, redirectUri };
}

/** 새 OAuth2Client 인스턴스 생성 */
export function createOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** 토큰으로 인증된 OAuth2Client 생성 */
export function createAuthenticatedClient(tokens: {
  access_token: string;
  refresh_token: string;
}) {
  const client = createOAuth2Client();
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
  return client;
}

/** Google 동의 화면 URL 생성 */
export function generateAuthUrl(state: OAuthStatePayload): string {
  const client = createOAuth2Client();
  const stateString = Buffer.from(JSON.stringify(state)).toString("base64url");

  return client.generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_CALENDAR_SCOPES,
    state: stateString,
    prompt: "consent", // 항상 refresh_token 발급을 위해 consent 요청
  });
}

/** authorization code → 토큰 교환 */
export async function exchangeCodeForTokens(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("토큰 교환 결과에 access_token 또는 refresh_token이 없습니다.");
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date ?? Date.now() + 3600 * 1000,
    scope: tokens.scope ?? GOOGLE_CALENDAR_SCOPES.join(" "),
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** OAuth state 파라미터 파싱 + 검증 */
export function parseOAuthState(stateString: string): OAuthStatePayload | null {
  try {
    const decoded = Buffer.from(stateString, "base64url").toString("utf-8");
    const payload = JSON.parse(decoded) as OAuthStatePayload;

    // 10분 내 state만 유효
    if (Date.now() - payload.timestamp > 10 * 60 * 1000) {
      return null;
    }

    if (!payload.adminUserId || !payload.tenantId || !payload.target) {
      return null;
    }

    // UUID 형식 검증
    if (!UUID_REGEX.test(payload.adminUserId) || !UUID_REGEX.test(payload.tenantId)) {
      return null;
    }

    if (payload.target !== "personal" && payload.target !== "shared") {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
