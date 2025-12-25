/**
 * Device Session Management
 *
 * 각 디바이스/브라우저 탭에 고유한 세션 ID를 부여하여
 * 멀티 디바이스 충돌을 감지합니다.
 */

const DEVICE_SESSION_KEY = "timelevelup_device_session_id";
const DEVICE_ID_KEY = "timelevelup_device_id";

export type DeviceInfo = {
  userAgent: string;
  platform: string;
  language: string;
  screenWidth: number;
  screenHeight: number;
  timezone: string;
};

/**
 * 디바이스 ID 생성 또는 조회
 *
 * localStorage에 저장되어 같은 브라우저에서는 동일한 ID를 유지합니다.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId = `device_${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

/**
 * 디바이스 세션 ID 생성 또는 조회
 *
 * sessionStorage에 저장되어 탭/창마다 다른 ID를 가집니다.
 */
export function getOrCreateDeviceSessionId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  let sessionId = sessionStorage.getItem(DEVICE_SESSION_KEY);

  if (!sessionId) {
    const deviceId = getOrCreateDeviceId();
    const tabId = crypto.randomUUID().slice(0, 8);
    sessionId = `${deviceId}_tab_${tabId}`;
    sessionStorage.setItem(DEVICE_SESSION_KEY, sessionId);
  }

  return sessionId;
}

/**
 * 현재 디바이스 세션 ID 조회 (없으면 null)
 */
export function getCurrentDeviceSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return sessionStorage.getItem(DEVICE_SESSION_KEY);
}

/**
 * 디바이스 정보 수집
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === "undefined") {
    return {
      userAgent: "server",
      platform: "server",
      language: "ko",
      screenWidth: 0,
      screenHeight: 0,
      timezone: "Asia/Seoul",
    };
  }

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: screen.width,
    screenHeight: screen.height,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * 디바이스 정보를 읽기 쉬운 문자열로 변환
 */
export function formatDeviceInfo(info: DeviceInfo): string {
  const browser = detectBrowser(info.userAgent);
  const os = detectOS(info.userAgent, info.platform);

  return `${browser} on ${os}`;
}

/**
 * User-Agent에서 브라우저 감지
 */
function detectBrowser(userAgent: string): string {
  if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
    return "Chrome";
  }
  if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
    return "Safari";
  }
  if (userAgent.includes("Firefox")) {
    return "Firefox";
  }
  if (userAgent.includes("Edg")) {
    return "Edge";
  }
  return "Unknown Browser";
}

/**
 * User-Agent/Platform에서 OS 감지
 */
function detectOS(userAgent: string, platform: string): string {
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
    return "iOS";
  }
  if (userAgent.includes("Android")) {
    return "Android";
  }
  if (platform.includes("Mac")) {
    return "macOS";
  }
  if (platform.includes("Win")) {
    return "Windows";
  }
  if (platform.includes("Linux")) {
    return "Linux";
  }
  return "Unknown OS";
}

/**
 * 두 디바이스 세션이 같은 디바이스인지 확인
 *
 * 같은 device_id를 가지면 같은 디바이스 (다른 탭)
 */
export function isSameDevice(
  sessionId1: string | null,
  sessionId2: string | null
): boolean {
  if (!sessionId1 || !sessionId2) {
    return false;
  }

  const deviceId1 = sessionId1.split("_tab_")[0];
  const deviceId2 = sessionId2.split("_tab_")[0];

  return deviceId1 === deviceId2;
}

/**
 * 현재 디바이스 세션인지 확인
 */
export function isCurrentDeviceSession(sessionId: string | null): boolean {
  const currentSessionId = getCurrentDeviceSessionId();
  return sessionId === currentSessionId;
}
