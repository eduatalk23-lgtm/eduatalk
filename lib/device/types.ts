/**
 * Device Conflict Types
 *
 * 멀티 디바이스 충돌 감지 관련 타입 정의
 */

export type DeviceConflict = {
  /** 충돌이 발생한 세션 ID */
  conflictingSessionId: string;
  /** 충돌 디바이스 정보 */
  conflictingDeviceInfo: {
    userAgent?: string;
    platform?: string;
  } | null;
  /** 충돌 디바이스의 읽기 쉬운 설명 */
  conflictingDeviceDescription: string;
  /** 마지막 heartbeat 시각 */
  lastHeartbeat: string;
  /** 같은 디바이스의 다른 탭인지 */
  isSameDevice: boolean;
};

export type DeviceConflictResult =
  | { hasConflict: false }
  | { hasConflict: true; conflict: DeviceConflict };

/**
 * Heartbeat 상태
 */
export type HeartbeatStatus = {
  /** 활성 상태인지 (최근 2분 이내 heartbeat) */
  isActive: boolean;
  /** 마지막 heartbeat 시각 */
  lastHeartbeat: string | null;
  /** 마지막 heartbeat 이후 경과 시간 (초) */
  secondsSinceLastHeartbeat: number | null;
};

/**
 * 세션 소유권 상태
 */
export type SessionOwnership = {
  /** 현재 디바이스가 소유자인지 */
  isOwner: boolean;
  /** 소유자 디바이스 세션 ID */
  ownerDeviceSessionId: string | null;
  /** 소유자 디바이스 정보 */
  ownerDeviceInfo: {
    userAgent?: string;
    platform?: string;
  } | null;
  /** 소유자 디바이스 설명 */
  ownerDeviceDescription: string | null;
};
