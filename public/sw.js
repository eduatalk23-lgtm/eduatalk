/**
 * TimeLevelUp Service Worker
 *
 * - 오프라인 캐싱 (NetworkFirst)
 * - Push 알림 수신 및 표시
 * - 알림 클릭 시 앱 내 네비게이션 + 클릭 추적
 * - 구독 변경 시 자동 갱신 (pushsubscriptionchange)
 * - App Badging API 연동
 */

const CACHE_NAME = "timelevelup-v1";
const OFFLINE_URL = "/offline";

// App Badge 카운트 (SW 생존 주기 동안 유지)
let badgeCount = 0;

// ============================================
// Install: 핵심 에셋 프리캐시
// ============================================
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/splash/eduatalk.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ============================================
// Activate: 오래된 캐시 정리
// ============================================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ============================================
// Fetch: NetworkFirst 캐싱 전략
// ============================================
self.addEventListener("fetch", (event) => {
  // navigation 요청만 캐시 폴백 처리
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // 정적 에셋: Cache First
  if (
    event.request.destination === "image" ||
    event.request.destination === "font" ||
    event.request.destination === "style"
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
              });
            }
            return response;
          })
      )
    );
    return;
  }
});

// ============================================
// Push: 알림 수신 및 표시 + App Badge
// ============================================
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "새 알림", body: event.data.text() };
  }

  const origin = self.location.origin;
  const tag = data.tag || "notification-" + Date.now();

  const options = {
    body: data.body || "",
    icon: data.icon || origin + "/icons/icon-192x192.png",
    badge: data.badge || origin + "/icons/icon-72x72.png",
    tag: tag,
    renotify: true,
    requireInteraction: true, // Android: heads-up 배너 유지 (auto-dismiss 방지)
    silent: false, // 명시적으로 소리/진동 허용
    vibrate: [200, 100, 200], // Android: 진동 패턴 → heads-up 배너 트리거
    data: {
      url: data.url || "/",
      type: data.type || "unknown",
      notificationLogId: data.notificationLogId || null,
      timestamp: Date.now(),
    },
  };

  event.waitUntil(
    self.registration
      .getNotifications({ tag: tag })
      .then((existing) => {
        existing.forEach((n) => n.close());
        return self.registration.showNotification(
          data.title || "TimeLevelUp",
          options
        );
      })
      .then(() => {
        // App Badging: 카운트 증가 후 뱃지 업데이트
        // getNotifications()는 방금 표시한 알림을 바로 포함하지 않을 수 있으므로
        // 별도 카운터로 관리
        badgeCount++;
        try {
          if ("setAppBadge" in navigator) {
            return navigator.setAppBadge(badgeCount).catch(() => {});
          }
        } catch {
          // setAppBadge 미지원 환경 (iOS Safari 등)
        }
      })
      .catch((err) => {
        console.error("[SW] Push notification failed:", err);
      })
  );
});

// ============================================
// Notification Click: 앱 내 네비게이션 + 클릭 추적
// ============================================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";
  const notificationLogId = event.notification.data?.notificationLogId;

  event.waitUntil(
    Promise.all([
      // 1. 클릭 추적 API 호출 (fire-and-forget)
      notificationLogId
        ? fetch(self.location.origin + "/api/push/click", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notificationLogId }),
          }).catch(() => {
            // 추적 실패해도 네비게이션은 진행
          })
        : Promise.resolve(),

      // 2. App Badge 초기화
      (() => {
        badgeCount = Math.max(0, badgeCount - 1);
        try {
          if ("setAppBadge" in navigator) {
            return badgeCount > 0
              ? navigator.setAppBadge(badgeCount).catch(() => {})
              : navigator.clearAppBadge().catch(() => {});
          }
        } catch {
          // 미지원 환경
        }
        return Promise.resolve();
      })(),

      // 3. 앱 내 네비게이션
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) => {
          for (const client of clients) {
            if ("focus" in client) {
              client.focus();
              client.postMessage({ type: "PUSH_NAVIGATE", url });
              return;
            }
          }
          return self.clients.openWindow(url);
        })
        .catch(() => {
          // 네비게이션 실패 시 새 창으로 폴백
          return self.clients.openWindow(url).catch(() => {});
        }),
    ])
  );
});

// ============================================
// Push Subscription Change: 토큰 자동 갱신
// ============================================
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        // 이전 구독의 옵션(applicationServerKey 포함)으로 재구독 시도
        // event.newSubscription이 있으면 브라우저가 이미 재구독한 것
        const newSubscription =
          event.newSubscription ||
          (await self.registration.pushManager.subscribe(
            event.oldSubscription?.options || { userVisibleOnly: true }
          ));

        const p256dh = newSubscription.getKey("p256dh");
        const auth = newSubscription.getKey("auth");
        if (!p256dh || !auth) return;

        // 서버에 새 구독 전달 (SW에서는 Server Action 호출 불가 → API 사용)
        // 이전 구독 비활성화 + 새 구독 등록을 서버가 처리
        await fetch(self.location.origin + "/api/push/resubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oldEndpoint: event.oldSubscription?.endpoint || null,
            newSubscription: {
              endpoint: newSubscription.endpoint,
              keys: {
                p256dh: arrayBufferToBase64(p256dh),
                auth: arrayBufferToBase64(auth),
              },
            },
          }),
        });
      } catch (err) {
        console.error("[SW] pushsubscriptionchange failed:", err);
      }
    })()
  );
});

// ============================================
// Message: 메인 스레드 ↔ SW 통신
// ============================================
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_BADGE") {
    badgeCount = 0;
    try {
      if ("clearAppBadge" in navigator) {
        navigator.clearAppBadge().catch(() => {});
      }
    } catch {
      // 미지원 환경
    }
  }
});

// --- 유틸리티 ---
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
