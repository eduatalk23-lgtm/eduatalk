"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, X, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { usePushSubscription } from "@/lib/domains/push/hooks/usePushSubscription";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const STORAGE_KEY = "push-permission-banner-dismissed";
const DENIED_STORAGE_KEY = "push-permission-denied-banner-dismissed";
const ANDROID_IMPORTANCE_KEY = "push-android-importance-dismissed";
const SNOOZE_DAYS = 7;
const DENIED_SNOOZE_DAYS = 30;
// 90일 후 다시 표시 (알림 중요도 미설정 시 반복 안내)
const ANDROID_IMPORTANCE_SNOOZE_DAYS = 90;

function isDismissed(key: string, snoozeDays: number): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(key);
  if (!raw) return false;
  const dismissedAt = parseInt(raw, 10);
  if (isNaN(dismissedAt)) return false;
  return Date.now() - dismissedAt < snoozeDays * 24 * 60 * 60 * 1000;
}

function getIsAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * 푸시 알림 권한 유도 배너.
 *
 * 두 가지 모드:
 * 1. permission === "default": 알림 허용 유도
 * 2. permission === "denied": 브라우저 설정에서 다시 켜는 방법 안내
 *    - Android: Chrome 주소창 자물쇠 → 알림 허용 안내
 *    - iOS/기타: 일반 브라우저 설정 안내
 *
 * iOS PWA에서는 홈 화면 추가 후 이 배너를 통해 최초 권한을 요청합니다.
 */
export function PushPermissionBanner() {
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<
    "request" | "denied" | "android-importance" | null
  >(null);
  const [isAndroid] = useState(getIsAndroid);
  const { requestSubscription } = usePushSubscription(userId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("PushManager" in window)) return;

    const permission = Notification.permission;

    let targetMode: "request" | "denied" | "android-importance" | null = null;
    if (permission === "default" && !isDismissed(STORAGE_KEY, SNOOZE_DAYS)) {
      targetMode = "request";
    } else if (
      permission === "denied" &&
      !isDismissed(DENIED_STORAGE_KEY, DENIED_SNOOZE_DAYS)
    ) {
      targetMode = "denied";
    } else if (
      permission === "granted" &&
      getIsAndroid() &&
      !isDismissed(ANDROID_IMPORTANCE_KEY, ANDROID_IMPORTANCE_SNOOZE_DAYS)
    ) {
      // Android에서 알림 허용됐지만 배너가 안 보일 수 있음 → 중요도 설정 안내
      targetMode = "android-importance";
    }

    if (targetMode) {
      const supabase = createSupabaseBrowserClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data.user?.id) {
          setUserId(data.user.id);
          setMode(targetMode);
        }
      });
    }
  }, []);

  const handleEnable = useCallback(async () => {
    const granted = await requestSubscription();
    if (granted) {
      setMode(null);
      // 권한 허용 직후 기존 미읽은 수를 앱 뱃지에 반영
      window.dispatchEvent(new CustomEvent("badge-needs-sync"));
    } else {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      setMode(null);
    }
  }, [requestSubscription]);

  const handleDismiss = useCallback(() => {
    if (mode === "denied") {
      localStorage.setItem(DENIED_STORAGE_KEY, String(Date.now()));
    } else if (mode === "android-importance") {
      localStorage.setItem(ANDROID_IMPORTANCE_KEY, String(Date.now()));
    } else {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }
    setMode(null);
  }, [mode]);

  if (!mode) return null;

  if (mode === "android-importance") {
    return (
      <div
        className={cn(
          "fixed top-0 left-0 right-0 z-50",
          "bg-blue-600 text-white shadow-lg",
          "animate-in slide-in-from-top duration-300"
        )}
      >
        <div className="mx-auto max-w-screen-xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Bell className="h-5 w-5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">
                  알림이 배너로 표시되지 않나요?
                </p>
                <div className="text-blue-100 text-xs mt-1 flex flex-col gap-0.5">
                  <p>Android 설정에서 알림 중요도를 높여주세요:</p>
                  <p>
                    설정 &gt; 앱 &gt; Chrome(또는 TimeLevelUp) &gt; 알림 &gt;
                    중요도를 &quot;긴급&quot; 또는 &quot;높음&quot;으로 변경
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded p-1 transition hover:bg-blue-500 shrink-0"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "denied") {
    return (
      <div
        className={cn(
          "fixed top-0 left-0 right-0 z-50",
          "bg-amber-600 text-white shadow-lg",
          "animate-in slide-in-from-top duration-300"
        )}
      >
        <div className="mx-auto max-w-screen-xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Settings className="h-5 w-5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">알림이 차단되어 있습니다</p>
                {isAndroid ? (
                  <div className="text-amber-100 text-xs mt-1 flex flex-col gap-0.5">
                    <p>알림을 다시 켜려면:</p>
                    <p>1. 주소창 왼쪽 자물쇠 아이콘을 탭</p>
                    <p>2. &quot;권한&quot; 또는 &quot;알림&quot;을 탭</p>
                    <p>3. &quot;허용&quot;으로 변경</p>
                  </div>
                ) : (
                  <p className="text-amber-100 text-xs mt-0.5">
                    브라우저 설정 &gt; 사이트 설정 &gt; 알림에서 허용으로
                    변경해주세요
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded p-1 transition hover:bg-amber-500 shrink-0"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

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
