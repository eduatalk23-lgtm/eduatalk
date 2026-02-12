/**
 * Google OAuth 토큰 CRUD + 자동 갱신
 */

import { createOAuth2Client } from "./oauth";
import type { GoogleOAuthToken } from "./types";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";

const ACTION_CTX = { domain: "googleCalendar", action: "token" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

function tokenTable(client: SupabaseAny) {
  return client.from("google_oauth_tokens");
}

/** 관리자의 OAuth 토큰 조회 */
export async function getTokenByAdminUser(
  client: SupabaseAny,
  adminUserId: string
): Promise<GoogleOAuthToken | null> {
  const { data, error } = await tokenTable(client)
    .select("*")
    .eq("admin_user_id", adminUserId)
    .eq("sync_enabled", true)
    .maybeSingle();

  if (error) {
    logActionError(ACTION_CTX, error, { context: "토큰 조회", adminUserId });
    return null;
  }
  return data as GoogleOAuthToken | null;
}

/** 테넌트의 활성 토큰 목록 조회 (공용 캘린더 동기화용) */
export async function getTokensByTenant(
  client: SupabaseAny,
  tenantId: string
): Promise<GoogleOAuthToken[]> {
  const { data, error } = await tokenTable(client)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("sync_enabled", true);

  if (error) {
    logActionError(ACTION_CTX, error, { context: "테넌트 토큰 목록 조회", tenantId });
    return [];
  }
  return (data as GoogleOAuthToken[]) ?? [];
}

/** 토큰 저장 (upsert) */
export async function saveToken(
  client: SupabaseAny,
  params: {
    adminUserId: string;
    tenantId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    scope: string;
    googleEmail?: string;
    calendarId?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await tokenTable(client).upsert(
    {
      admin_user_id: params.adminUserId,
      tenant_id: params.tenantId,
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
      token_expires_at: params.expiresAt.toISOString(),
      scope: params.scope,
      google_email: params.googleEmail ?? null,
      calendar_id: params.calendarId ?? "primary",
      sync_enabled: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "admin_user_id" }
  );

  if (error) {
    logActionError(ACTION_CTX, error, { context: "토큰 저장", adminUserId: params.adminUserId });
    return { success: false, error: "토큰 저장에 실패했습니다." };
  }
  return { success: true };
}

/** 토큰 삭제 */
export async function deleteToken(
  client: SupabaseAny,
  adminUserId: string
): Promise<{ success: boolean }> {
  const { error } = await tokenTable(client)
    .delete()
    .eq("admin_user_id", adminUserId);

  if (error) {
    logActionError(ACTION_CTX, error, { context: "토큰 삭제", adminUserId });
    return { success: false };
  }
  return { success: true };
}

/** 캘린더 ID 업데이트 */
export async function updateCalendarId(
  client: SupabaseAny,
  adminUserId: string,
  calendarId: string
): Promise<{ success: boolean }> {
  const { error } = await tokenTable(client)
    .update({ calendar_id: calendarId, updated_at: new Date().toISOString() })
    .eq("admin_user_id", adminUserId);

  if (error) {
    logActionError(ACTION_CTX, error, { context: "캘린더 ID 업데이트", adminUserId });
    return { success: false };
  }
  return { success: true };
}

/** last_sync_at 업데이트 */
export async function updateLastSyncAt(
  client: SupabaseAny,
  adminUserId: string
): Promise<void> {
  await tokenTable(client)
    .update({ last_sync_at: new Date().toISOString() })
    .eq("admin_user_id", adminUserId);
}

/**
 * 토큰 만료 확인 + 갱신
 * 만료 5분 전부터 갱신 시도
 */
export async function refreshTokenIfNeeded(
  client: SupabaseAny,
  token: GoogleOAuthToken
): Promise<GoogleOAuthToken> {
  const expiresAt = new Date(token.token_expires_at).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  // 아직 유효하면 그대로 반환
  if (expiresAt - now > fiveMinutes) {
    return token;
  }

  logActionDebug(ACTION_CTX, "토큰 갱신 시도", {
    adminUserId: token.admin_user_id,
  });

  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: token.refresh_token,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error("갱신된 access_token이 없습니다.");
    }

    const newExpiresAt = new Date(
      credentials.expiry_date ?? Date.now() + 3600 * 1000
    );

    // DB 업데이트
    await tokenTable(client)
      .update({
        access_token: credentials.access_token,
        token_expires_at: newExpiresAt.toISOString(),
        // refresh_token이 새로 발급된 경우 업데이트
        ...(credentials.refresh_token
          ? { refresh_token: credentials.refresh_token }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", token.id);

    return {
      ...token,
      access_token: credentials.access_token,
      token_expires_at: newExpiresAt.toISOString(),
      ...(credentials.refresh_token
        ? { refresh_token: credentials.refresh_token }
        : {}),
    };
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: "토큰 갱신 실패",
      adminUserId: token.admin_user_id,
    });
    // 갱신 실패해도 기존 토큰 반환 (만료 직전이라도 시도는 가능)
    return token;
  }
}
