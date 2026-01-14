"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionWarn, logActionError } from "@/lib/utils/serverActionLogger";

/**
 * 에러 객체에서 안전한 정보만 추출 (민감 정보 제외)
 */
function sanitizeError(error: unknown): { message: string; code?: string } {
  if (!error) return { message: "Unknown error" };

  if (error instanceof Error) {
    return { message: error.message };
  }

  if (typeof error === "object") {
    const err = error as { message?: string; code?: string };
    return {
      message: err.message || "Unknown error",
      code: err.code,
    };
  }

  return { message: String(error) };
}

/**
 * 세션 토큰을 해시하여 저장 (보안 강화)
 * DB 탈취 시에도 토큰으로 세션을 훔칠 수 없게 함
 * 
 * @param token - 원본 세션 토큰
 * @returns 해시된 토큰 (SHA-256)
 */
async function hashSessionToken(token: string): Promise<string> {
  try {
    // Node.js 환경에서 crypto 모듈 사용
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    // 해시 앞에 "hashed:" 접두사 추가하여 원본과 구분
    return `hashed:${hash}`;
  } catch (error) {
    // crypto 모듈을 사용할 수 없는 경우 마스킹 사용 (fallback)
    logActionWarn("session.hashSessionToken", `해싱 실패, 마스킹 사용: ${sanitizeError(error).message}`);
    // 토큰의 앞 8자리 + "..." + 뒤 8자리 형태로 마스킹
    if (token.length <= 16) {
      return `masked:${"*".repeat(token.length)}`;
    }
    return `masked:${token.substring(0, 8)}...${token.substring(token.length - 8)}`;
  }
}

export interface UserSession {
  id: string;
  device_name: string | null;
  user_agent: string | null;
  ip_address: string | null;
  location: string | null;
  is_current_session: boolean;
  last_active_at: string;
  created_at: string;
  expires_at: string | null;
}

/**
 * User-Agent에서 기기 정보 파싱
 */
function parseDeviceName(userAgent: string | null): string {
  if (!userAgent) return "Unknown Device";

  let browser = "Unknown Browser";
  let os = "Unknown OS";

  // 브라우저 감지
  if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
    browser = "Chrome";
  } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
    browser = "Safari";
  } else if (userAgent.includes("Firefox")) {
    browser = "Firefox";
  } else if (userAgent.includes("Edg")) {
    browser = "Edge";
  } else if (userAgent.includes("Opera") || userAgent.includes("OPR")) {
    browser = "Opera";
  }

  // OS 감지
  if (userAgent.includes("Windows")) {
    os = "Windows";
  } else if (
    userAgent.includes("Mac OS X") ||
    userAgent.includes("Macintosh")
  ) {
    os = "macOS";
  } else if (userAgent.includes("Linux") && !userAgent.includes("Android")) {
    os = "Linux";
  } else if (userAgent.includes("Android")) {
    os = "Android";
  } else if (userAgent.includes("iPhone")) {
    os = "iPhone";
  } else if (userAgent.includes("iPad")) {
    os = "iPad";
  }

  return `${browser} on ${os}`;
}

/**
 * headers에서 안전하게 헤더 값 추출
 */
async function getHeaderValue(name: string): Promise<string | null> {
  try {
    const headersList = await headers();
    if (!headersList || typeof headersList.get !== "function") {
      return null;
    }
    return headersList.get(name);
  } catch {
    return null;
  }
}

/**
 * IP 주소 추출 (Next.js headers에서)
 */
async function getClientIP(): Promise<string | null> {
  // Vercel, Cloudflare 등 다양한 플랫폼 지원
  const cfConnectingIP = await getHeaderValue("cf-connecting-ip");
  const realIP = await getHeaderValue("x-real-ip");
  const forwardedFor = await getHeaderValue("x-forwarded-for");

  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwardedFor) {
    // x-forwarded-for는 여러 IP를 포함할 수 있음 (프록시 체인)
    return forwardedFor.split(",")[0].trim();
  }

  return null;
}

/**
 * 로그인 시 세션 정보 저장
 */
export async function saveUserSession(
  userId: string,
  sessionToken: string,
  expiresAt?: Date
): Promise<void> {
  try {
    const userAgent = await getHeaderValue("user-agent");
    const ipAddress = await getClientIP();
    const deviceName = parseDeviceName(userAgent);

    const supabase = await createSupabaseServerClient();

    // 기존 세션의 is_current_session을 false로 업데이트
    await supabase
      .from("user_sessions")
      .update({ is_current_session: false })
      .eq("user_id", userId)
      .eq("is_current_session", true);

    // 세션 토큰 해싱 (보안 강화)
    const hashedToken = await hashSessionToken(sessionToken);

    // 새 세션 저장
    const { error } = await supabase.from("user_sessions").insert({
      user_id: userId,
      session_token: hashedToken,
      device_name: deviceName,
      user_agent: userAgent,
      ip_address: ipAddress,
      is_current_session: true,
      expires_at: expiresAt?.toISOString() || null,
    });

    if (error) {
      logActionError("session.saveUserSession", `세션 저장 실패: ${sanitizeError(error).message}`);
    }
  } catch (error) {
    logActionError("session.saveUserSession", `세션 저장 예외: ${sanitizeError(error).message}`);
  }
}

/**
 * 활성 세션 목록 조회
 * 현재 세션이 없으면 자동으로 현재 세션을 등록합니다.
 */
export async function getUserSessions(): Promise<UserSession[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    // 세션 정보 가져오기 (에러 발생 시 빈 배열 반환)
    let session = null;
    try {
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        // 세션이 없는 것은 정상적인 상황일 수 있음
        const isSessionMissing =
          sessionError.message?.includes("session") ||
          sessionError.message?.includes("Session") ||
          sessionError.name === "AuthSessionMissingError";

        if (!isSessionMissing) {
          logActionWarn("session.getUserSessions", `getSession 실패: ${sanitizeError(sessionError).message}`);
        }
      } else {
        session = currentSession;
      }
    } catch (error) {
      // getSession 실패 시 조용히 처리
      logActionWarn("session.getUserSessions", `getSession 예외: ${sanitizeError(error).message}`);
    }

    // 현재 세션 조회
    const { data: existingSessions, error: fetchError } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("last_active_at", { ascending: false });

    if (fetchError) {
      logActionError("session.getUserSessions", `세션 조회 실패: ${sanitizeError(fetchError).message}`);
      return [];
    }

    const sessions = (existingSessions || []) as UserSession[];
    const hasCurrentSession = sessions.some((s) => s.is_current_session);

    // 현재 세션이 없고 Supabase 세션이 있으면 현재 세션 등록
    if (!hasCurrentSession && session) {
      try {
        const userAgent = await getHeaderValue("user-agent");
        const ipAddress = await getClientIP();
        const deviceName = parseDeviceName(userAgent);

        // 기존 세션의 is_current_session을 false로 업데이트
        if (sessions.length > 0) {
          await supabase
            .from("user_sessions")
            .update({ is_current_session: false })
            .eq("user_id", user.id)
            .eq("is_current_session", true);
        }

        // 현재 세션 저장
        const expiresAt = session.expires_at
          ? new Date(session.expires_at * 1000)
          : null;

        // 세션 토큰 해싱 (보안 강화)
        const hashedToken = await hashSessionToken(session.access_token);

        const { data: newSession, error: insertError } = await supabase
          .from("user_sessions")
          .insert({
            user_id: user.id,
            session_token: hashedToken,
            device_name: deviceName,
            user_agent: userAgent,
            ip_address: ipAddress,
            is_current_session: true,
            expires_at: expiresAt?.toISOString() || null,
          })
          .select()
          .single();

        if (insertError) {
          logActionError("session.getUserSessions", `현재 세션 자동 등록 실패: ${sanitizeError(insertError).message}`);
        } else if (newSession) {
          // 새로 등록된 세션을 목록에 추가
          sessions.unshift(newSession as UserSession);
        }
      } catch (error) {
        logActionError("session.getUserSessions", `현재 세션 자동 등록 예외: ${sanitizeError(error).message}`);
      }
    }

    return sessions;
  } catch (error) {
    logActionError("session.getUserSessions", `세션 조회 예외: ${sanitizeError(error).message}`);
    return [];
  }
}

/**
 * 특정 세션 로그아웃 (삭제)
 */
export async function revokeSession(sessionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    // 세션이 해당 사용자의 것인지 확인
    const { data: session, error: fetchError } = await supabase
      .from("user_sessions")
      .select("id, is_current_session, session_token")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError || !session) {
      return { success: false, error: "세션을 찾을 수 없습니다." };
    }

    // 현재 세션인 경우 Supabase에서도 로그아웃
    if (session.is_current_session) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        logActionError("session.revokeSession", `현재 세션 로그아웃 실패: ${sanitizeError(signOutError).message}`);
      }
    }

    // 세션 삭제
    const { error: deleteError } = await supabase
      .from("user_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (deleteError) {
      return { success: false, error: "세션 삭제에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    logActionError("session.revokeSession", `세션 삭제 예외: ${sanitizeError(error).message}`);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "세션 삭제에 실패했습니다.",
    };
  }
}

/**
 * 모든 다른 세션 로그아웃 (현재 세션 제외)
 */
export async function revokeAllOtherSessions(): Promise<{
  success: boolean;
  error?: string;
  revokedCount?: number;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    // 현재 세션 제외한 모든 세션 삭제
    const { data, error } = await supabase
      .from("user_sessions")
      .delete()
      .eq("user_id", user.id)
      .eq("is_current_session", false)
      .select("id");

    if (error) {
      return { success: false, error: "세션 삭제에 실패했습니다." };
    }

    return { success: true, revokedCount: data?.length || 0 };
  } catch (error) {
    logActionError("session.revokeAllOtherSessions", `세션 일괄 삭제 예외: ${sanitizeError(error).message}`);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "세션 삭제에 실패했습니다.",
    };
  }
}

/**
 * 마지막 활동 시간 업데이트
 */
export async function updateLastActive(): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // 현재 세션의 last_active_at 업데이트
    await supabase
      .from("user_sessions")
      .update({ last_active_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("is_current_session", true);
  } catch (error) {
    // 조용히 실패 (선택적 기능)
    logActionError("session.updateLastActive", `활동 시간 업데이트 실패: ${sanitizeError(error).message}`);
  }
}
