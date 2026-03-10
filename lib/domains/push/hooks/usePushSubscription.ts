"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  subscribePush,
  unsubscribePush,
} from "../actions/subscription";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/**
 * Push 구독을 자동으로 관리하는 훅.
 *
 * - 마운트 시 기존 구독 확인
 * - 구독이 없으면 자동 등록 (사용자가 이미 권한 허용한 경우)
 * - iOS 구독 풀림 대비 매 방문 시 체크
 * - 권한 미요청 상태면 아무것도 하지 않음 (Phase 5에서 UI로 유도)
 */
export function usePushSubscription(userId: string | null) {
  const subscribedRef = useRef(false);
  const retryCountRef = useRef(0);
  const lastEndpointRef = useRef<string | null>(null);

  const syncSubscription = useCallback(async () => {
    if (!userId || subscribedRef.current) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!VAPID_PUBLIC_KEY) return;

    // 권한이 이미 granted인 경우에만 자동 구독
    if (Notification.permission !== "granted") return;

    try {
      // SW ready 대기 (타임아웃 10초 — 모바일에서 느릴 수 있음)
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("SW ready timeout")), 10000)
        ),
      ]);
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // iOS 구독 풀림 등으로 없는 경우 → 재구독
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
        });
      }

      const p256dhKey = subscription.getKey("p256dh");
      const authKey = subscription.getKey("auth");
      if (!p256dhKey || !authKey) return;

      const endpoint = subscription.endpoint;
      const result = await subscribePush(
        {
          endpoint,
          keys: {
            p256dh: arrayBufferToBase64(p256dhKey),
            auth: arrayBufferToBase64(authKey),
          },
        },
        detectDeviceLabel()
      );

      if (result.success) {
        subscribedRef.current = true;
        lastEndpointRef.current = endpoint;
        retryCountRef.current = 0;
      } else {
        console.warn("[Push] subscribePush failed:", result.error);
      }
    } catch (err) {
      console.error("[Push] Subscription sync failed:", err);

      // 서버 저장 실패 시 최대 2회 자동 재시도 (3초, 6초 후)
      if (retryCountRef.current < 2) {
        retryCountRef.current++;
        const delay = retryCountRef.current * 3000;
        setTimeout(() => {
          subscribedRef.current = false;
          syncSubscription();
        }, delay);
      }
    }
  }, [userId]);

  const prevUserIdRef = useRef<string | null>(null);

  /** 브라우저 Push 구독 해제 + 서버 비활성화 */
  const revokeCurrentSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker?.ready;
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) {
        await unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
      }
    } catch {
      // 실패해도 무시 — 서버에서 이미 비활성화됨
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      // 로그아웃: 이전 유저가 있었다면 브라우저 Push 구독도 해제
      if (prevUserIdRef.current) {
        revokeCurrentSubscription();
      }
      subscribedRef.current = false;
      prevUserIdRef.current = null;
      return;
    }

    // 계정 전환: 이전 유저와 다른 유저로 로그인 시 이전 구독 해제 후 새 구독
    if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
      revokeCurrentSubscription().then(() => {
        prevUserIdRef.current = userId;
        subscribedRef.current = false;
        syncSubscription();
      });
      return;
    }

    prevUserIdRef.current = userId;
    subscribedRef.current = false;
    syncSubscription();
  }, [syncSubscription, revokeCurrentSubscription, userId]);

  // 앱 포커스 시 구독 재확인
  // - 구독이 풀린 경우 (iOS)
  // - endpoint가 조용히 변경된 경우 (Chrome pushsubscriptionchange 불안정)
  useEffect(() => {
    if (!userId) return;

    const handleVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      if (Notification.permission !== "granted") return;

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          // 구독 풀림 → 재등록
          subscribedRef.current = false;
          syncSubscription();
        } else if (
          lastEndpointRef.current &&
          subscription.endpoint !== lastEndpointRef.current
        ) {
          // endpoint 변경 감지 → 서버에 새 endpoint 등록
          subscribedRef.current = false;
          syncSubscription();
        }
      } catch {
        // SW not ready 등 — 무시
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [userId, syncSubscription]);

  /**
   * 명시적 구독 요청 (설정 UI에서 사용).
   * Notification.requestPermission() 포함.
   */
  const requestSubscription = useCallback(async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    subscribedRef.current = false; // 재시도 허용
    await syncSubscription();
    return subscribedRef.current;
  }, [syncSubscription]);

  /**
   * 구독 해제 (설정 UI에서 사용).
   */
  const cancelSubscription = useCallback(async (): Promise<boolean> => {
    try {
      await revokeCurrentSubscription();
      subscribedRef.current = false;
      return true;
    } catch {
      return false;
    }
  }, [revokeCurrentSubscription]);

  return { requestSubscription, cancelSubscription };
}

// --- 유틸리티 ---

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function detectDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iOS Safari";
  if (/Android/.test(ua)) return "Android Chrome";
  if (/Mac/.test(ua)) return "macOS Desktop";
  if (/Windows/.test(ua)) return "Windows Desktop";
  if (/Linux/.test(ua)) return "Linux Desktop";
  return "Unknown Device";
}
