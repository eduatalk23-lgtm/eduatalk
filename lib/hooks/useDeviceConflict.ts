"use client";

/**
 * Device Conflict Management Hook
 *
 * 멀티 디바이스 충돌을 감지하고 관리하는 React 훅입니다.
 *
 * @example
 * function PlanTimer({ planId }: { planId: string }) {
 *   const {
 *     hasConflict,
 *     conflictInfo,
 *     checkForConflict,
 *     takeover,
 *     dismiss,
 *   } = useDeviceConflict(planId);
 *
 *   if (hasConflict && conflictInfo) {
 *     return (
 *       <ConflictWarning
 *         deviceDescription={conflictInfo.deviceDescription}
 *         onTakeover={takeover}
 *         onDismiss={dismiss}
 *       />
 *     );
 *   }
 *
 *   return <TimerDisplay />;
 * }
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  getOrCreateDeviceSessionId,
  getDeviceInfo,
} from "@/lib/device";
import {
  checkDeviceConflict,
  updateSessionHeartbeat,
  takeoverSession,
  setSessionDeviceInfo,
  type DeviceConflictInfo,
} from "@/lib/domains/today";

// Heartbeat 간격 (30초)
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

export type UseDeviceConflictOptions = {
  /** 플랜 ID */
  planId: string;
  /** 자동 heartbeat 활성화 여부 */
  enableHeartbeat?: boolean;
  /** 충돌 발생 시 콜백 */
  onConflictDetected?: (conflict: DeviceConflictInfo) => void;
  /** 충돌 해결 시 콜백 */
  onConflictResolved?: () => void;
};

export type UseDeviceConflictReturn = {
  /** 충돌 발생 여부 */
  hasConflict: boolean;
  /** 충돌 정보 */
  conflictInfo: DeviceConflictInfo | null;
  /** 현재 디바이스 세션 ID */
  deviceSessionId: string;
  /** 충돌 확인 진행 중 */
  isChecking: boolean;
  /** 인수 진행 중 */
  isTakingOver: boolean;
  /** 활성 세션 ID */
  activeSessionId: string | null;
  /** 충돌 확인 */
  checkForConflict: () => Promise<boolean>;
  /** 세션 인수 (다른 디바이스에서 가져오기) */
  takeover: () => Promise<boolean>;
  /** 충돌 경고 무시 */
  dismiss: () => void;
  /** 세션에 디바이스 정보 설정 */
  registerDevice: (sessionId: string) => Promise<boolean>;
  /** Heartbeat 전송 */
  sendHeartbeat: () => Promise<boolean>;
};

export function useDeviceConflict({
  planId,
  enableHeartbeat = true,
  onConflictDetected,
  onConflictResolved,
}: UseDeviceConflictOptions): UseDeviceConflictReturn {
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<DeviceConflictInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isTakingOver, setIsTakingOver] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const deviceSessionId = useRef<string>("");
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 초기화: 디바이스 세션 ID 가져오기
  useEffect(() => {
    deviceSessionId.current = getOrCreateDeviceSessionId();
  }, []);

  // Heartbeat 설정
  useEffect(() => {
    if (!enableHeartbeat || !activeSessionId) {
      return;
    }

    // 즉시 heartbeat 전송
    updateSessionHeartbeat(activeSessionId).catch(console.error);

    // 주기적 heartbeat
    heartbeatIntervalRef.current = setInterval(() => {
      if (activeSessionId) {
        updateSessionHeartbeat(activeSessionId).catch(console.error);
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [enableHeartbeat, activeSessionId]);

  // 충돌 확인
  const checkForConflict = useCallback(async (): Promise<boolean> => {
    if (!planId) return false;

    setIsChecking(true);
    try {
      const result = await checkDeviceConflict(planId, deviceSessionId.current);

      if (result.activeSession) {
        setActiveSessionId(result.activeSession.id);
      }

      if (result.hasConflict && result.conflict) {
        setHasConflict(true);
        setConflictInfo(result.conflict);
        onConflictDetected?.(result.conflict);
        return true;
      }

      setHasConflict(false);
      setConflictInfo(null);
      return false;
    } catch (error) {
      console.error("[useDeviceConflict] 충돌 확인 오류:", error);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [planId, onConflictDetected]);

  // 세션 인수
  const takeover = useCallback(async (): Promise<boolean> => {
    if (!activeSessionId) {
      console.warn("[useDeviceConflict] 인수할 세션이 없습니다.");
      return false;
    }

    setIsTakingOver(true);
    try {
      const result = await takeoverSession(
        activeSessionId,
        deviceSessionId.current,
        getDeviceInfo()
      );

      if (result.success) {
        setHasConflict(false);
        setConflictInfo(null);
        onConflictResolved?.();
        return true;
      }

      console.error("[useDeviceConflict] 세션 인수 실패:", result.error);
      return false;
    } catch (error) {
      console.error("[useDeviceConflict] 세션 인수 오류:", error);
      return false;
    } finally {
      setIsTakingOver(false);
    }
  }, [activeSessionId, onConflictResolved]);

  // 충돌 경고 무시
  const dismiss = useCallback(() => {
    setHasConflict(false);
    setConflictInfo(null);
  }, []);

  // 세션에 디바이스 정보 등록
  const registerDevice = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const result = await setSessionDeviceInfo(
        sessionId,
        deviceSessionId.current,
        getDeviceInfo()
      );

      if (result.success) {
        setActiveSessionId(sessionId);
        return true;
      }

      console.error("[useDeviceConflict] 디바이스 등록 실패:", result.error);
      return false;
    } catch (error) {
      console.error("[useDeviceConflict] 디바이스 등록 오류:", error);
      return false;
    }
  }, []);

  // Heartbeat 전송
  const sendHeartbeat = useCallback(async (): Promise<boolean> => {
    if (!activeSessionId) {
      return false;
    }

    try {
      const result = await updateSessionHeartbeat(activeSessionId);
      return result.success;
    } catch (error) {
      console.error("[useDeviceConflict] Heartbeat 전송 오류:", error);
      return false;
    }
  }, [activeSessionId]);

  return {
    hasConflict,
    conflictInfo,
    deviceSessionId: deviceSessionId.current,
    isChecking,
    isTakingOver,
    activeSessionId,
    checkForConflict,
    takeover,
    dismiss,
    registerDevice,
    sendHeartbeat,
  };
}
