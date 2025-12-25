"use server";

/**
 * Device Conflict Detection Actions
 *
 * 멀티 디바이스 충돌 감지 및 세션 소유권 관리
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import type { DeviceConflictInfo } from "../types";

// Heartbeat 유효 시간 (2분)
const HEARTBEAT_VALIDITY_SECONDS = 120;

/**
 * 디바이스 정보에서 읽기 쉬운 설명 생성
 */
function formatDeviceDescription(deviceInfo: Record<string, unknown> | null): string {
  if (!deviceInfo) {
    return "알 수 없는 디바이스";
  }

  const userAgent = String(deviceInfo.userAgent || "");
  const platform = String(deviceInfo.platform || "");

  // 브라우저 감지
  let browser = "브라우저";
  if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
    browser = "Chrome";
  } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
    browser = "Safari";
  } else if (userAgent.includes("Firefox")) {
    browser = "Firefox";
  } else if (userAgent.includes("Edg")) {
    browser = "Edge";
  }

  // OS 감지
  let os = "";
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
    os = "iOS";
  } else if (userAgent.includes("Android")) {
    os = "Android";
  } else if (platform.includes("Mac")) {
    os = "macOS";
  } else if (platform.includes("Win")) {
    os = "Windows";
  } else if (platform.includes("Linux")) {
    os = "Linux";
  }

  return os ? `${browser} (${os})` : browser;
}

/**
 * 같은 디바이스인지 확인
 */
function isSameDevice(sessionId1: string | null, sessionId2: string | null): boolean {
  if (!sessionId1 || !sessionId2) {
    return false;
  }

  const deviceId1 = sessionId1.split("_tab_")[0];
  const deviceId2 = sessionId2.split("_tab_")[0];

  return deviceId1 === deviceId2;
}

/**
 * 플랜의 활성 세션에 대한 디바이스 충돌 확인
 */
export async function checkDeviceConflict(
  planId: string,
  currentDeviceSessionId: string
): Promise<{
  hasConflict: boolean;
  conflict?: DeviceConflictInfo;
  activeSession?: {
    id: string;
    device_session_id: string | null;
    last_heartbeat: string | null;
  };
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { hasConflict: false };
  }

  const supabase = await createSupabaseServerClient();

  // 활성 세션 조회
  const { data: activeSession, error } = await supabase
    .from("student_study_sessions")
    .select("id, device_session_id, device_info, last_heartbeat")
    .eq("plan_id", planId)
    .eq("student_id", user.userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !activeSession) {
    return { hasConflict: false };
  }

  // 같은 디바이스 세션이면 충돌 없음
  if (activeSession.device_session_id === currentDeviceSessionId) {
    return {
      hasConflict: false,
      activeSession: {
        id: activeSession.id,
        device_session_id: activeSession.device_session_id,
        last_heartbeat: activeSession.last_heartbeat,
      },
    };
  }

  // 다른 디바이스 세션 - heartbeat 유효성 확인
  if (activeSession.last_heartbeat) {
    const lastHeartbeat = new Date(activeSession.last_heartbeat);
    const now = new Date();
    const secondsSinceHeartbeat = (now.getTime() - lastHeartbeat.getTime()) / 1000;

    // Heartbeat가 만료되었으면 충돌로 처리하지 않음 (세션 인수 가능)
    if (secondsSinceHeartbeat > HEARTBEAT_VALIDITY_SECONDS) {
      return {
        hasConflict: false,
        activeSession: {
          id: activeSession.id,
          device_session_id: activeSession.device_session_id,
          last_heartbeat: activeSession.last_heartbeat,
        },
      };
    }
  }

  // 충돌 발생
  const deviceInfo = activeSession.device_info as Record<string, unknown> | null;

  return {
    hasConflict: true,
    conflict: {
      deviceSessionId: activeSession.device_session_id || "",
      deviceInfo: deviceInfo
        ? {
            userAgent: String(deviceInfo.userAgent || ""),
            platform: String(deviceInfo.platform || ""),
          }
        : null,
      deviceDescription: formatDeviceDescription(deviceInfo),
      lastHeartbeat: activeSession.last_heartbeat || new Date().toISOString(),
      isSameDevice: isSameDevice(activeSession.device_session_id, currentDeviceSessionId),
    },
    activeSession: {
      id: activeSession.id,
      device_session_id: activeSession.device_session_id,
      last_heartbeat: activeSession.last_heartbeat,
    },
  };
}

/**
 * 세션의 heartbeat 업데이트
 */
export async function updateSessionHeartbeat(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "인증이 필요합니다." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("student_study_sessions")
    .update({ last_heartbeat: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("student_id", user.userId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 세션 소유권 인수 (다른 디바이스에서 takeover)
 */
export async function takeoverSession(
  sessionId: string,
  newDeviceSessionId: string,
  deviceInfo: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "인증이 필요합니다." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("student_study_sessions")
    .update({
      device_session_id: newDeviceSessionId,
      device_info: deviceInfo,
      last_heartbeat: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("student_id", user.userId)
    .is("ended_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 세션에 디바이스 정보 설정
 */
export async function setSessionDeviceInfo(
  sessionId: string,
  deviceSessionId: string,
  deviceInfo: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "인증이 필요합니다." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("student_study_sessions")
    .update({
      device_session_id: deviceSessionId,
      device_info: deviceInfo,
      last_heartbeat: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("student_id", user.userId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
