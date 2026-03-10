"use client";

import { useEffect, useState } from "react";

/**
 * 푸시 구독 디버그 페이지 (임시)
 * /settings/push-debug
 */
export default function PushDebugPage() {
  const [info, setInfo] = useState<Record<string, unknown>>({});
  const [serverInfo, setServerInfo] = useState<Record<string, unknown> | null>(null);
  const [testResult, setTestResult] = useState<string>("");

  useEffect(() => {
    async function check() {
      const result: Record<string, unknown> = {};

      // 1. 기본 지원 여부
      result.serviceWorkerSupported = "serviceWorker" in navigator;
      result.pushManagerSupported = "PushManager" in window;
      result.notificationSupported = "Notification" in window;

      // 2. 알림 권한 상태
      result.notificationPermission = Notification.permission;

      // 3. VAPID 키
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      result.vapidKeyPresent = !!vapidKey;
      result.vapidKeyLength = vapidKey?.length ?? 0;

      // 4. 서비스워커 상태
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        result.swRegistered = !!reg;
        result.swState = reg?.active?.state ?? reg?.installing?.state ?? reg?.waiting?.state ?? "none";
        result.swScope = reg?.scope ?? "none";
      } catch (e) {
        result.swError = String(e);
      }

      // 5. Push 구독 상태
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        result.pushSubscriptionExists = !!sub;
        result.pushEndpoint = sub?.endpoint ? sub.endpoint.slice(0, 60) + "..." : "none";
        result.pushHasP256dh = !!sub?.getKey("p256dh");
        result.pushHasAuth = !!sub?.getKey("auth");
      } catch (e) {
        result.pushError = String(e);
      }

      // 6. UA
      result.userAgent = navigator.userAgent.slice(0, 100);
      result.standalone = window.matchMedia("(display-mode: standalone)").matches;

      setInfo(result);

      // 7. 서버 측 구독 정보
      try {
        const res = await fetch("/api/push/debug");
        const data = await res.json();
        setServerInfo(data);
      } catch (e) {
        setServerInfo({ error: String(e) });
      }
    }

    check();
  }, []);

  const handleTestSubscribe = async () => {
    setTestResult("구독 시도 중...");
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setTestResult("VAPID 키 없음");
        return;
      }

      // 권한 요청
      if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        setTestResult(`권한 결과: ${perm}`);
        if (perm !== "granted") return;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        const padding = "=".repeat((4 - (vapidKey.length % 4)) % 4);
        const base64 = (vapidKey + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        const key = Uint8Array.from(rawData, (c) => c.charCodeAt(0));

        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key.buffer as ArrayBuffer,
        });
        setTestResult("새 구독 생성됨. 서버 저장 시도...");
      } else {
        setTestResult("기존 구독 있음. 서버 저장 시도...");
      }

      const p256dh = sub.getKey("p256dh");
      const auth = sub.getKey("auth");
      if (!p256dh || !auth) {
        setTestResult("키 추출 실패 (p256dh/auth 없음)");
        return;
      }

      const toBase64 = (buf: ArrayBuffer) => {
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (const b of bytes) binary += String.fromCharCode(b);
        return btoa(binary);
      };

      // Server Action 대신 직접 API 호출로 테스트
      const { subscribePush } = await import("@/lib/domains/push/actions/subscription");
      const result = await subscribePush(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: toBase64(p256dh),
            auth: toBase64(auth),
          },
        },
        `Debug-${/Android/i.test(navigator.userAgent) ? "Android" : "Other"}`
      );

      setTestResult(result.success ? "구독 저장 성공!" : `저장 실패: ${result.error}`);
    } catch (e) {
      setTestResult(`에러: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 text-sm">
      <h1 className="text-lg font-bold">Push 디버그</h1>

      <section className="bg-secondary-100 dark:bg-secondary-800 rounded-lg p-3 space-y-1">
        <h2 className="font-semibold">클라이언트 상태</h2>
        {Object.entries(info).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-text-secondary truncate">{k}</span>
            <span className={`font-mono text-xs ${v === true || v === "granted" ? "text-green-600" : v === false || v === "denied" ? "text-red-600" : ""}`}>
              {String(v)}
            </span>
          </div>
        ))}
      </section>

      <section className="bg-secondary-100 dark:bg-secondary-800 rounded-lg p-3 space-y-1">
        <h2 className="font-semibold">서버 상태</h2>
        {serverInfo ? (
          Object.entries(serverInfo).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <span className="text-text-secondary truncate">{k}</span>
              <span className="font-mono text-xs break-all text-right max-w-[60%]">
                {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </span>
            </div>
          ))
        ) : (
          <p>로딩 중...</p>
        )}
      </section>

      <button
        onClick={handleTestSubscribe}
        className="w-full bg-primary-600 text-white rounded-lg py-2 font-medium"
      >
        수동 구독 테스트
      </button>

      {testResult && (
        <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 text-xs font-mono break-all">
          {testResult}
        </div>
      )}
    </div>
  );
}
