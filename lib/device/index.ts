/**
 * Device Session Module
 *
 * 멀티 디바이스 충돌 감지 및 관리를 위한 모듈입니다.
 *
 * @example
 * import {
 *   getOrCreateDeviceSessionId,
 *   getDeviceInfo,
 *   isCurrentDeviceSession,
 * } from "@/lib/device";
 *
 * // 타이머 시작 시 디바이스 세션 ID 포함
 * const deviceSessionId = getOrCreateDeviceSessionId();
 * await startPlan(planId, timestamp, deviceSessionId);
 *
 * // 다른 디바이스 세션인지 확인
 * if (!isCurrentDeviceSession(session.device_session_id)) {
 *   showConflictWarning();
 * }
 */

export {
  getOrCreateDeviceId,
  getOrCreateDeviceSessionId,
  getCurrentDeviceSessionId,
  getDeviceInfo,
  formatDeviceInfo,
  isSameDevice,
  isCurrentDeviceSession,
  type DeviceInfo,
} from "./session";

export {
  type DeviceConflict,
  type DeviceConflictResult,
} from "./types";
