"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { usePushSubscription } from "@/lib/domains/push/hooks/usePushSubscription";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const STORAGE_KEY = "push-permission-banner-dismissed";
const SNOOZE_DAYS = 7;

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const dismissedAt = parseInt(raw, 10);
  if (isNaN(dismissedAt)) return false;
  return Date.now() - dismissedAt < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * 푸시 알림 권한 유도 배너.
 *
 * 표시 조건:
 * - Notification API + PushManager 지원 브라우저
 * - Notification.permission === "default" (아직 허용/거부 안 함)
 * - 로그인 상태
 * - 7일 이내 닫기를 누르지 않음
 *
 * iOS PWA에서는 홈 화면 추가 후 이 배너를 통해 최초 권한을 요청합니다.
 * 권한이 한 번 허용되면 iPhone 설정 > 알림에 앱이 나타납니다.
 */
export function PushPermissionBanner() {
  const [userId, setUserId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const { requestSubscription } = usePushSubscription(userId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return;
    if (isDismissed()) return;

    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) {
        setUserId(data.user.id);
        setVisible(true);
      }
    });
  }, []);

  const handleEnable = useCallback(async () => {
    const granted = await requestSubscription();
    if (granted) {
      setVisible(false);
    } else {
      // 거부 시 7일간 미표시
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      setVisible(false);
    }
  }, [requestSubscription]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50",
        "bg-primary-600 text-white shadow-lg",
        "animate-in slide-in-from-top duration-300"
      )}
    >
      <div className="mx-auto max-w-screen-xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Bell className="h-5 w-5 shrink-0" />
            <p className="text-sm truncate">
              채팅 및 학습 알림을 받으려면 알림을 허용해주세요
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleEnable}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-primary-600 transition hover:bg-primary-50"
            >
              허용
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded p-1 transition hover:bg-primary-500"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
