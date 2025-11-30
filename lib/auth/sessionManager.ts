"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  } else if (userAgent.includes("Mac OS X") || userAgent.includes("Macintosh")) {
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
function getHeaderValue(name: string): string | null {
  try {
    const headersList = headers();
    if (!headersList || typeof headersList.get !== 'function') {
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
function getClientIP(): string | null {
  // Vercel, Cloudflare 등 다양한 플랫폼 지원
  const cfConnectingIP = getHeaderValue("cf-connecting-ip");
  const realIP = getHeaderValue("x-real-ip");
  const forwardedFor = getHeaderValue("x-forwarded-for");

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
    const userAgent = getHeaderValue("user-agent");
    const ipAddress = getClientIP();
    const deviceName = parseDeviceName(userAgent);

    const supabase = await createSupabaseServerClient();

    // 기존 세션의 is_current_session을 false로 업데이트
    await supabase
      .from("user_sessions")
      .update({ is_current_session: false })
      .eq("user_id", userId)
      .eq("is_current_session", true);

    // 새 세션 저장
    const { error } = await supabase.from("user_sessions").insert({
      user_id: userId,
      session_token: sessionToken,
      device_name: deviceName,
      user_agent: userAgent,
      ip_address: ipAddress,
      is_current_session: true,
      expires_at: expiresAt?.toISOString() || null,
    });

    if (error) {
      console.error("[session] 세션 저장 실패:", error);
    }
  } catch (error) {
    console.error("[session] 세션 저장 예외:", error);
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
          console.warn("[session] getSession 실패:", sessionError.message);
        }
      } else {
        session = currentSession;
      }
    } catch (error) {
      // getSession 실패 시 조용히 처리
      console.warn("[session] getSession 예외:", error);
    }

    // 현재 세션 조회
    const { data: existingSessions, error: fetchError } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("last_active_at", { ascending: false });

    if (fetchError) {
      console.error("[session] 세션 조회 실패:", fetchError);
      return [];
    }

    const sessions = (existingSessions || []) as UserSession[];
    const hasCurrentSession = sessions.some((s) => s.is_current_session);

    // 현재 세션이 없고 Supabase 세션이 있으면 현재 세션 등록
    if (!hasCurrentSession && session) {
      try {
        const userAgent = getHeaderValue("user-agent");
        const ipAddress = getClientIP();
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

        const { data: newSession, error: insertError } = await supabase
          .from("user_sessions")
          .insert({
            user_id: user.id,
            session_token: session.access_token,
            device_name: deviceName,
            user_agent: userAgent,
            ip_address: ipAddress,
            is_current_session: true,
            expires_at: expiresAt?.toISOString() || null,
          })
          .select()
          .single();

        if (insertError) {
          console.error("[session] 현재 세션 자동 등록 실패:", insertError);
        } else if (newSession) {
          // 새로 등록된 세션을 목록에 추가
          sessions.unshift(newSession as UserSession);
        }
      } catch (error) {
        console.error("[session] 현재 세션 자동 등록 예외:", error);
      }
    }

    return sessions;
  } catch (error) {
    console.error("[session] 세션 조회 예외:", error);
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
        console.error("[session] 현재 세션 로그아웃 실패:", signOutError);
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
    console.error("[session] 세션 삭제 예외:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "세션 삭제에 실패했습니다.",
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
    console.error("[session] 세션 일괄 삭제 예외:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "세션 삭제에 실패했습니다.",
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
    console.error("[session] 활동 시간 업데이트 실패:", error);
  }
}

