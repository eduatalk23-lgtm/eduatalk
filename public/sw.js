/**
 * TimeLevelUp Service Worker
 *
 * - 오프라인 캐싱 (NetworkFirst)
 * - Push 알림 수신 및 표시
 * - 알림 클릭 시 앱 내 네비게이션
 */

const CACHE_NAME = "timelevelup-v1";
const OFFLINE_URL = "/offline";

// ============================================
// Install: 오프라인 페이지 프리캐시
// ============================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
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
// Push: 알림 수신 및 표시
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
    data: {
      url: data.url || "/",
      type: data.type || "unknown",
      timestamp: Date.now(),
    },
  };

  event.waitUntil(
    // 같은 tag의 기존 알림을 먼저 닫고 새로 표시 (유령 알림 방지)
    self.registration
      .getNotifications({ tag: tag })
      .then((existing) => {
        existing.forEach((n) => n.close());
        return self.registration.showNotification(
          data.title || "TimeLevelUp",
          options
        );
      })
      .catch((err) => {
        console.error("[SW] Push notification failed:", err);
      })
  );
});

// ============================================
// Notification Click: 앱 내 네비게이션
// ============================================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // 이미 열린 앱 창이 있으면 포커스 + 네비게이션
        for (const client of clients) {
          if ("focus" in client) {
            client.focus();
            client.postMessage({ type: "PUSH_NAVIGATE", url });
            return;
          }
        }
        // 없으면 새 창
        return self.clients.openWindow(url);
      })
  );
});
