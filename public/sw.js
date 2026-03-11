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
        // 포그라운드 중복 방지: 포커스된 클라이언트가 해당 URL에 있으면 silent 처리
        let foregroundSilent = false;
        const targetUrl = data.url || "/";
        try {
          const allClients = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
          });
          foregroundSilent = allClients.some((client) => {
            if (!client.focused || client.visibilityState !== "visible")
              return false;
            // 채팅 알림이면 해당 채팅방 URL과 비교
            try {
              const clientPath = new URL(client.url).pathname;
              return clientPath === targetUrl;
            } catch {
              return false;
            }
          });
        } catch {
          // clients.matchAll 실패 시 무시
        }

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

        // 알림 타입별 액션 버튼 (Android에서 표시)
        const actions = [];
        const type = data.type || "unknown";
        if (type === "chat_message" || type === "chat") {
          actions.push(
            { action: "mark-read", title: "읽음 처리" }
          );
        }

        // 알림 타입별 진동 패턴
        const vibratePatterns = {
          chat_message: [100, 50, 100],
          chat: [100, 50, 100],
          study_reminder: [200, 100, 200, 100, 200],
          payment: [300, 100, 300, 100, 300],
        };
        const vibrate = vibratePatterns[type] || [200, 100, 200];

        // silent 판단: 사용자 설정(data.silent) 또는 포그라운드 중복(foregroundSilent)
        const isSilent = !!data.silent || foregroundSilent;

        const options = {
          body: body,
          icon: data.icon || origin + "/icons/icon-192x192.png",
          badge: data.badge || origin + "/icons/icon-72x72.png",
          tag: tag,
          renotify: !isSilent,
          silent: isSilent,
          vibrate: isSilent ? [] : vibrate,
          timestamp: data.timestamp || Date.now(),
          actions: actions,
          // 중요 알림(결제, 상담)은 사용자가 반드시 확인하도록
          requireInteraction: type === "payment" || type === "consultation",
          data: {
            url: data.url || "/",
            type: type,
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

  const action = event.action;
  const url = event.notification.data?.url || "/";
  const notificationLogId = event.notification.data?.notificationLogId;

  // "읽음 처리" 액션: 알림 닫기 + 뱃지 갱신 (실제 서버 읽음 처리는 앱 진입 시 수행)
  if (action === "mark-read") {
    event.waitUntil(
      Promise.all([
        notificationLogId
          ? fetch(self.location.origin + "/api/push/click", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notificationLogId }),
            }).catch(() => {})
          : Promise.resolve(),
        clearTagCount(event.notification.data?.tag),
        // 메인 스레드에 뱃지 재계산 요청
        self.clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then((clients) => {
            for (const client of clients) {
              client.postMessage({ type: "BADGE_NEEDS_SYNC" });
            }
          }),
      ])
    );
    return;
  }

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

      // 2. 해당 tag 카운트만 리셋 (전체 clear 대신)
      clearTagCount(event.notification.data?.tag),

      // 3. 앱 내 네비게이션 + 뱃지 재계산 요청
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) => {
          for (const client of clients) {
            if ("focus" in client) {
              client.focus();
              client.postMessage({ type: "PUSH_NAVIGATE", url });
              // 메인 스레드에서 실제 미읽은 수 기반으로 뱃지 재계산 요청
              client.postMessage({ type: "BADGE_NEEDS_SYNC" });
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
// Badge Sync: 메인 스레드의 실제 미읽은 수로 동기화
// ============================================
async function syncBadgeCount(count) {
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction("meta", "readwrite");
      tx.objectStore("meta").put(count, "badgeCount");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
    if ("setAppBadge" in navigator) {
      if (count > 0) {
        navigator.setAppBadge(count).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  } catch {
    // IDB 실패해도 무시
  }
}

// ============================================
// Message: 메인 스레드 ↔ SW 통신
// ============================================
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_BADGE") {
    event.waitUntil(clearBadge());
  }
  // 메인 스레드에서 실제 미읽은 수로 동기화
  if (event.data?.type === "SYNC_BADGE") {
    const count = event.data.count || 0;
    event.waitUntil(syncBadgeCount(count));
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
