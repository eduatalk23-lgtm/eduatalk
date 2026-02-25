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

  const syncSubscription = useCallback(async () => {
    if (!userId || subscribedRef.current) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!VAPID_PUBLIC_KEY) return;

    // 권한이 이미 granted인 경우에만 자동 구독
    if (Notification.permission !== "granted") return;

    try {
      const registration = await navigator.serviceWorker.ready;
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

      const result = await subscribePush(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(p256dhKey),
            auth: arrayBufferToBase64(authKey),
          },
        },
        detectDeviceLabel()
      );

      if (result.success) {
        subscribedRef.current = true;
      }
    } catch (err) {
      console.error("[Push] Subscription sync failed:", err);
    }
  }, [userId]);

  useEffect(() => {
    syncSubscription();
  }, [syncSubscription]);

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
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      subscribedRef.current = false;
      return true;
    } catch {
      return false;
    }
  }, []);

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
