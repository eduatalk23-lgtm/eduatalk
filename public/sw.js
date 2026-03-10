/**
 * TimeLevelUp Service Worker
 *
 * - 오프라인 캐싱 (NetworkFirst)
 * - Push 알림 수신 및 표시
 * - 알림 클릭 시 앱 내 네비게이션 + 클릭 추적
 * - 구독 변경 시 자동 갱신 (pushsubscriptionchange)
 * - App Badging API 연동 (IndexedDB 영속 카운터)
 * - Per-tag 알림 누적 카운트 (메시지 요약 표시)
 */

const CACHE_NAME = "timelevelup-v1";
const OFFLINE_URL = "/offline";

// ============================================
// IndexedDB 헬퍼 (Badge 카운터 + per-tag 카운트)
// ============================================
const DB_NAME = "sw-data";
const DB_VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta");
      }
      if (!db.objectStoreNames.contains("tag_counts")) {
        db.createObjectStore("tag_counts");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Badge: 단일 transaction으로 read+write (race condition 방지)
async function incrementBadge() {
  try {
    const db = await openDB();
    const count = await new Promise((resolve) => {
      const tx = db.transaction("meta", "readwrite");
      const store = tx.objectStore("meta");
      const getReq = store.get("badgeCount");
      getReq.onsuccess = () => {
        const newCount = (getReq.result || 0) + 1;
        store.put(newCount, "badgeCount");
        tx.oncomplete = () => resolve(newCount);
      };
      getReq.onerror = () => resolve(1);
    });
    db.close();
    if ("setAppBadge" in navigator) {
      navigator.setAppBadge(count).catch(() => {});
    }
  } catch {
    // IDB 실패해도 push 처리 계속
  }
}

async function clearBadge() {
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction(["meta", "tag_counts"], "readwrite");
      tx.objectStore("meta").put(0, "badgeCount");
      tx.objectStore("tag_counts").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
    if ("clearAppBadge" in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  } catch {
    // 미지원 환경
  }
}

// Per-tag 카운트: 같은 tag(채팅방)의 누적 메시지 수 추적
async function incrementTagCount(tag) {
  try {
    const db = await openDB();
    const count = await new Promise((resolve) => {
      const tx = db.transaction("tag_counts", "readwrite");
      const store = tx.objectStore("tag_counts");
      const getReq = store.get(tag);
      getReq.onsuccess = () => {
        const newCount = (getReq.result || 0) + 1;
        store.put(newCount, tag);
        tx.oncomplete = () => resolve(newCount);
      };
      getReq.onerror = () => resolve(1);
    });
    db.close();
    return count;
  } catch {
    return 1;
  }
}

async function clearTagCount(tag) {
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction("tag_counts", "readwrite");
      tx.objectStore("tag_counts").delete(tag);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // 무시
  }
}

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

  // 이전 버전 IDB 정리 (sw-badge → sw-data로 마이그레이션됨)
  indexedDB.deleteDatabase("sw-badge");
});

// ============================================
// Fetch: NetworkFirst 캐싱 전략
// ============================================
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

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
// Push: 알림 수신 및 표시 + App Badge + 누적 카운트
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

  event.waitUntil(
    (async () => {
      try {
        // Per-tag 누적 카운트 증가 (채팅방별 미읽은 수)
        const tagCount = await incrementTagCount(tag);

        // 누적 메시지가 2건 이상이면 body에 카운트 표시
        // 서버에서 이미 요약한 경우(condensed) 건너뜀
        let body = data.body || "";
        if (tagCount > 1 && !data.condensed) {
          body = data.body
            ? `${data.body}\n외 ${tagCount - 1}건의 메시지`
            : `${tagCount}개의 새 메시지`;
        }

        const options = {
          body: body,
          icon: data.icon || origin + "/icons/icon-192x192.png",
          badge: data.badge || origin + "/icons/icon-72x72.png",
          tag: tag,
          renotify: true,
          vibrate: [200, 100, 200],
          timestamp: data.timestamp || Date.now(),
          data: {
            url: data.url || "/",
            type: data.type || "unknown",
            notificationLogId: data.notificationLogId || null,
            tag: tag,
          },
        };

        await self.registration.showNotification(
          data.title || "TimeLevelUp",
          options
        );
        await incrementBadge();
      } catch (err) {
        console.error("[SW] Push notification failed:", err);
      }
    })()
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
          }).catch(() => {})
        : Promise.resolve(),

      // 2. App Badge 초기화 + 해당 tag 카운트 리셋
      clearBadge(),

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
          return self.clients.openWindow(url).catch(() => {});
        }),
    ])
  );
});

// ============================================
// Notification Close (Dismiss): tag 카운트 리셋
// ============================================
self.addEventListener("notificationclose", (event) => {
  const tag = event.notification.data?.tag;
  if (tag) {
    event.waitUntil(clearTagCount(tag));
  }
});

// ============================================
// Push Subscription Change: 토큰 자동 갱신
// ============================================
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const newSubscription =
          event.newSubscription ||
          (await self.registration.pushManager.subscribe(
            event.oldSubscription?.options || { userVisibleOnly: true }
          ));

        const p256dh = newSubscription.getKey("p256dh");
        const auth = newSubscription.getKey("auth");
        if (!p256dh || !auth) return;

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
    event.waitUntil(clearBadge());
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
